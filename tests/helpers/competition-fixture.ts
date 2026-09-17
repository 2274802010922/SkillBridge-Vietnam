import { createServer, type Server } from "node:http";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import bs58 from "bs58";
import { address, getProgramDerivedAddress } from "gill";
import {
  getAttestationEncoder,
  deriveAttestationPda,
  getSchemaEncoder,
  getCredentialEncoder,
  serializeAttestationData,
  SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS as SAS,
} from "sas-lib";
import { disc, hashBytes } from "../../solana/client/challenge-escrow.ts";
import { GATE_PROGRAM } from "../../solana/client/opportunity-verification.ts";
import { createIsolatedDatabaseForTests } from "../../backend/database/adapters/d1-adapter.ts";
import { ensureCoreSchema } from "../../backend/database/schema/core-schema.ts";
import {
  RUBRIC,
  DEMO_EVIDENCE,
  makeFixtureAssessment,
} from "../../shared/validation/assessment-contract.ts";
const key = (n: number) => address(bs58.encode(new Uint8Array(32).fill(n)));
export async function competitionFixture() {
  const directory = await mkdtemp(
      path.join(tmpdir(), "skillbridge-competition-"),
    ),
    dbUrl = "file:" + path.join(directory, "test.db").replaceAll("\\", "/");
  const { db, close } = createIsolatedDatabaseForTests(dbUrl);
  await ensureCoreSchema(db);
  const wallets = {
    student: String(key(21)),
    reviewer: String(key(22)),
    employer: String(key(23)),
    outsider: String(key(24)),
  };
  const cookies: Record<string, string> = {};
  for (const [role, wallet] of Object.entries(wallets)) {
    const token = "test-session-" + crypto.randomUUID();
    cookies[role] = "skillbridge_session=" + token;
    await db
      .prepare("INSERT INTO users(id,display_name) VALUES(?,?)")
      .bind(role, role === "student" ? "Minh Anh · QA" : role)
      .run();
    await db
      .prepare("INSERT INTO wallets(address,user_id) VALUES(?,?)")
      .bind(wallet, role)
      .run();
    await db
      .prepare(
        "INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES(?,?,?,?)",
      )
      .bind(
        role,
        role,
        createHash("sha256").update(token).digest("hex"),
        new Date(Date.now() + 3600000).toISOString(),
      )
      .run();
  }
  await db
    .prepare(
      "INSERT INTO organizations(id,slug,name,kind,created_by_user_id) VALUES('issuer','issuer','Đơn vị A · dữ liệu QA','business','reviewer'),('employer','employer','Doanh nghiệp B · dữ liệu QA','business','employer')",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO memberships(id,organization_id,user_id,role) VALUES('ma','issuer','reviewer','business_admin'),('mb','employer','employer','business_admin')",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO challenges(id,organization_id,reviewer_organization_id,created_by_user_id,title,brief,rubric_json,reward,status,access_type) VALUES('qa-challenge','issuer','issuer','reviewer','Chiến lược tăng trưởng có bằng chứng','Bài làm mẫu phục vụ kiểm thử giao diện và quyền truy cập.',?,'Huy hiệu','published','public')",
    )
    .bind(JSON.stringify(RUBRIC))
    .run();
  await db
    .prepare(
      "INSERT INTO participations(id,challenge_id,student_user_id,state) VALUES('qp','qa-challenge','student','in_review')",
    )
    .run();
  await db
    .prepare(
      "INSERT INTO submissions(id,participation_id,state,reflection,submitted_at) VALUES('qa-submission','qp','in_review','Bài nộp QA: kế hoạch nghiên cứu và thử nghiệm.',CURRENT_TIMESTAMP)",
    )
    .run();
  const evidenceText = DEMO_EVIDENCE.map((e) => e.content).join("\n\n"),
    hash = createHash("sha256").update(evidenceText).digest("hex"),
    storageKey = "qa-competition-" + crypto.randomUUID() + ".md";
  await mkdir(".data/evidence", { recursive: true });
  await writeFile(path.join(".data/evidence", storageKey), evidenceText, {
    flag: "wx",
  });
  await db
    .prepare(
      "INSERT INTO submission_files(id,submission_id,r2_key,original_name,content_type,size_bytes,sha256,uploaded_by_user_id) VALUES('qa-file','qa-submission',?,'evidence.md','text/markdown',?,?,'student')",
    )
    .bind(storageKey, String(Buffer.byteLength(evidenceText)), hash)
    .run();
  const draft = makeFixtureAssessment();
  const evidence = DEMO_EVIDENCE.map((s) => ({
    ...s,
    locator: "evidence.md · toàn bộ file",
    fileId: "qa-file",
    fileHash: hash,
  }));
  for (const criterion of draft.rubric)
    for (const citation of criterion.citations)
      citation.locator = "evidence.md · toàn bộ file";
  await db
    .prepare(
      "INSERT INTO assessments(id,submission_id,provider,model,schema_version,assessment_json,status,ai_result_hash) VALUES('qa-assessment','qa-submission','skillbridge-fixture','QA fixture','skillbridge.assessment.v1',?,'in_review','qa-hash')",
    )
    .bind(
      JSON.stringify({
        draft,
        evidence,
        provenance: {
          mode: "fixture",
          provider: "skillbridge-fixture",
          model: "QA fixture",
        },
      }),
    )
    .run();
  const fields = [
      "studentWallet",
      "challengeId",
      "overallScore",
      "evidenceHash",
      "reviewerRole",
      "humanApproved",
    ],
    joined = Buffer.concat(
      fields.map((f) => {
        const b = Buffer.from(f),
          size = Buffer.alloc(4);
        size.writeUInt32LE(b.length);
        return Buffer.concat([size, b]);
      }),
    );
  const issuerKey = key(30),
    schemaKey = key(31),
    authority = key(33),
    receipt = key(34);
  const [attestation]=await deriveAttestationPda({credential:issuerKey,schema:schemaKey,nonce:key(35)});
  const schema = {
    discriminator: 2,
    credential: issuerKey,
    name: Buffer.from("PROOF-OF-SKILL"),
    description: Buffer.from("QA"),
    fieldNames: joined,
    layout: new Uint8Array([12, 12, 0, 12, 12, 10]),
    version: 1,
    isPaused: false,
  };
  const attestationBytes = getAttestationEncoder().encode({
    discriminator: 0,
    nonce: key(35),
    credential: issuerKey,
    schema: schemaKey,
    data: serializeAttestationData(schema, {
      studentWallet: wallets.student,
      challengeId: "qa-challenge",
      overallScore: 87,
      evidenceHash: hash,
      reviewerRole: "HUMAN",
      humanApproved: true,
    }),
    signer: authority,
    expiry: BigInt(Math.floor(Date.now() / 1000) + 3600),
    tokenAccount: key(36),
  });
  const policyId = await hashBytes("qa-opportunity"),
    [policy] = await getProgramDerivedAddress({
      programAddress: address(GATE_PROGRAM),
      seeds: [Buffer.from("policy"), bs58.decode(authority), policyId],
    });
  const policyData = Buffer.concat([
    await disc("account:Policy"),
    Buffer.from(bs58.decode(authority)),
    policyId,
    Buffer.from(bs58.decode(issuerKey)),
    Buffer.from(bs58.decode(schemaKey)),
    Buffer.from(bs58.decode(authority)),
    Buffer.from([80, 0, 1, 255]),
  ]);
  const map = new Map<string, { owner: string; data: [string, string] }>([
    [
      String(policy),
      { owner: GATE_PROGRAM, data: [policyData.toString("base64"), "base64"] },
    ],
  ]);
  const sas = (data: ArrayLike<number>) => ({
    owner: String(SAS),
    data: [Buffer.from(data).toString("base64"), "base64"] as [string, string],
  });
  map.set(String(attestation), sas(attestationBytes));
  map.set(String(schemaKey), sas(getSchemaEncoder().encode(schema)));
  map.set(
    String(issuerKey),
    sas(
      getCredentialEncoder().encode({
        discriminator: 1,
        authority,
        name: Buffer.from("SKILLBRIDGE-QA"),
        authorizedSigners: [authority],
      }),
    ),
  );
  let revoked = false;
  const rpcServer = createServer(async (req, res) => {
    let data = "";
    for await (const chunk of req) data += chunk;
    const body = JSON.parse(data || "{}");
    let result: unknown;
    if (body.method === "getGenesisHash")
      result = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
    else if (body.method === "getAccountInfo")
      result = {
        context: { slot: 1 },
        value:
          revoked && body.params[0] === String(attestation)
            ? null
            : map.get(body.params[0]) || null,
      };
    else if(body.method === "getMultipleAccounts")result={context:{slot:1},value:body.params[0].map((key:string)=>revoked&&key===String(attestation)?null:map.get(key)||null)};
    else {
      res.writeHead(400);
      res.end(
        JSON.stringify({
          error: { message: "Unexpected test RPC: " + body.method },
        }),
      );
      return;
    }
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }));
  });
  await new Promise<void>((resolve) =>
    rpcServer.listen(0, "127.0.0.1", resolve),
  );
  const rpc = `http://127.0.0.1:${(rpcServer.address() as { port: number }).port}`;
  await db
    .prepare(
      "INSERT INTO credential_issuers(organization_id,credential_name,credential_address,schema_name,schema_address,authorized_signer_address,bootstrap_tx) VALUES('issuer','QA',?,'PROOF-OF-SKILL',?,?,'qa')",
    )
    .bind(String(issuerKey), String(schemaKey), String(authority))
    .run();
  await db
    .prepare(
      "INSERT INTO opportunities(id,organization_id,created_by_user_id,title,description,required_issuer_organization_id,minimum_score,policy_address,status) VALUES('qa-opportunity','employer','employer','Thực tập sinh phân tích sản phẩm','Cơ hội QA để kiểm tra ứng tuyển bằng chứng nhận.','issuer','80',?,'active')",
    )
    .bind(String(policy))
    .run();
  await db
    .prepare(
      "INSERT INTO opportunity_details(opportunity_id,requirements) VALUES('qa-opportunity','Có bằng chứng nghiên cứu và đánh giá của con người.')",
    )
    .run();
  async function addCredential() {
    await db
      .prepare(
        "INSERT OR IGNORE INTO skill_credentials(id,assessment_id,challenge_id,student_user_id,student_wallet,issuer_organization_id,nonce_address,attestation_address,schema_address,score,evidence_hash,status,expires_at) VALUES('qa-credential','qa-assessment','qa-challenge','student',?,'issuer','qa',?,?,'87',?,'active','2099-01-01')",
      )
      .bind(wallets.student, String(attestation), String(schemaKey), hash)
      .run();
    await db
      .prepare(
        "INSERT INTO access_grants(id,opportunity_id,credential_id,user_id,wallet_address,decision,reason,verification_json,receipt_address,record_tx) VALUES('qa-grant','qa-opportunity','qa-credential','student',?,'granted','TEST_FIXTURE','{}',?,'qa')",
      )
      .bind(wallets.student, String(receipt))
      .run();
  }
  return {
    db,
    dbUrl,
    rpc,
    cookies,
    draft,
    evidence,
    storageKey,
    addCredential,
    revoke: () => {
      revoked = true;
    },
    stop: async () => {
      await new Promise<void>((resolve, reject) =>
        rpcServer.close((e) => (e ? reject(e) : resolve())),
      );
      close();
    },
    rpcServer: rpcServer as Server,
  };
}

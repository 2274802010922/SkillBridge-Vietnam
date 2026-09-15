// Explicitly funded Devnet test; never executed by the default test suite.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import nacl from "tweetnacl";
import bs58 from "bs58";
import {
  createKeyPairSignerFromBytes,
  createSolanaClient,
  createTransaction,
  signTransactionMessageWithSigners,
  getTransactionEncoder,
  getTransactionDecoder,
  type Instruction,
  type TransactionSigner,
  type SignatureBytes,
} from "gill";
import { getTransferSolInstruction } from "gill/programs";
import {
  assertEscrowDevnet,
  escrowRpc,
  escrowAddress,
  escrowInstructions,
  hashBytes,
  SYSTEM,
  type EscrowConfig,
  type EscrowAction,
} from "../../solana/client/challenge-escrow.ts";
import { inspectReward } from "../../solana/client/independent-claim.ts";
import {
  buildSponsoredClaim,
  coSignSponsoredClaim,
} from "../../solana/server/sponsored-claim.ts";
const rpc = "https://api.devnet.solana.com";
assert.ok(
  process.env.ESCROW_PROOF_PAYER_PATH,
  "Set ESCROW_PROOF_PAYER_PATH to a dedicated Devnet payer",
);
const secret = await readFile(process.env.ESCROW_PROOF_PAYER_PATH, "utf8");
const payer = await createKeyPairSignerFromBytes(
  Uint8Array.from(JSON.parse(secret)),
);
await assertEscrowDevnet(rpc);
const runId = process.env.SPONSOR_PROOF_RUN_ID || crypto.randomUUID();
assert.match(runId, /^[a-zA-Z0-9-]+$/);
const recoveredKeys = process.env.SPONSOR_PROOF_RUN_ID
  ? JSON.parse(await readFile(`.data/sponsor-live-keys-${runId}.json`, "utf8"))
  : null;
const generated = Object.fromEntries(
  ["student", "reviewer", "registrar", "backup"].map((name) => [
    name,
    recoveredKeys
      ? nacl.sign.keyPair.fromSecretKey(Uint8Array.from(recoveredKeys[name]))
      : nacl.sign.keyPair(),
  ]),
) as Record<"student" | "reviewer" | "registrar" | "backup", nacl.SignKeyPair>;
await mkdir(".data", { recursive: true });
if (!recoveredKeys)
  await writeFile(
    `.data/sponsor-live-keys-${runId}.json`,
    JSON.stringify(
      Object.fromEntries(
        Object.entries(generated).map(([k, v]) => [k, [...v.secretKey]]),
      ),
    ),
    { flag: "wx", mode: 0o600 },
  );
const [student, reviewer, registrar, backup] = await Promise.all(
  Object.values(generated).map((k) =>
    createKeyPairSignerFromBytes(k.secretKey),
  ),
);
const signers = [payer, student, reviewer, registrar, backup],
  client = createSolanaClient({ urlOrMoniker: "devnet" });
const recoveredProgress = process.env.SPONSOR_PROOF_RUN_ID
  ? JSON.parse(
      await readFile(`.data/sponsor-live-progress-${runId}.json`, "utf8"),
    )
  : null;
const transactions: Record<string, string> =
  recoveredProgress?.transactions || {};
let config: EscrowConfig | null = recoveredProgress?.config || null;
async function checkpoint() {
  await writeFile(
    `.data/sponsor-live-progress-${runId}.json`,
    JSON.stringify(
      { runId, config, student: String(student.address), transactions },
      null,
      2,
    ),
  );
}
async function wait(signature: string, commitment = "confirmed") {
  for (let i = 0; i < 60; i++) {
    try {
      const s = await escrowRpc<{
        value: ({ err: unknown; confirmationStatus: string } | null)[];
      }>(rpc, "getSignatureStatuses", [
        [signature],
        { searchTransactionHistory: true },
      ]);
      if (s.value[0]?.err)
        throw Error("Transaction failed: " + JSON.stringify(s.value[0].err));
      if (
        s.value[0] &&
        (s.value[0].confirmationStatus === "finalized" ||
          (commitment === "confirmed" &&
            s.value[0].confirmationStatus === "confirmed"))
      )
        return;
    } catch (e) {
      if (!(e instanceof Error) || !/429|Too many|rate limit/i.test(e.message))
        throw e;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw Error(
    "Confirmation timeout; inspect the saved signature before retrying.",
  );
}
async function send(
  stage: string,
  instructions: Instruction[],
  feePayer: TransactionSigner = payer,
) {
  if (transactions[stage]) {
    await wait(transactions[stage]);
    return transactions[stage];
  }
  const { value: latestBlockhash } = await client.rpc
    .getLatestBlockhash({ commitment: "confirmed" })
    .send();
  const message = createTransaction({
    version: "legacy",
    feePayer,
    instructions: instructions.map((ix) => ({
      ...ix,
      accounts: ix.accounts?.map((a) => {
        const signer =
          a.role >= 2
            ? signers.find((s) => s.address === a.address)
            : undefined;
        return signer ? { ...a, signer } : a;
      }),
    })),
    latestBlockhash,
    computeUnitLimit: 300000,
  });
  const signed = await signTransactionMessageWithSigners(message),
    signature = bs58.encode(signed.signatures[feePayer.address]!);
  transactions[stage] = signature;
  await checkpoint();
  await escrowRpc(rpc, "sendTransaction", [
    Buffer.from(getTransactionEncoder().encode(signed)).toString("base64"),
    { encoding: "base64", preflightCommitment: "confirmed" },
  ]);
  await wait(signature);
  console.log(stage + ": " + signature);
  return signature;
}
await send("student_setup", [
  getTransferSolInstruction({
    source: payer,
    destination: student.address,
    amount: BigInt(4000000),
  }),
]);
const now = Math.floor(Date.now() / 1000),
  terms = "Dedicated sponsored claim test: 0.001 SOL Devnet, one recipient.";
if (!config)
  config = {
    challengeId: "sponsor-proof-" + runId,
    funder: String(payer.address),
    reviewer: String(reviewer.address),
    backup: String(backup.address),
    registrar: String(registrar.address),
    mint: SYSTEM,
    amount: "1000000",
    slots: 1,
    submitDeadline: now + 50,
    reviewDeadline: now + 600,
    termsText: terms,
    termsHash: (await hashBytes(terms)).toString("hex"),
  };
const extra = {
  student: String(student.address),
  submissionId: "submission-" + runId,
  evidenceHash: (await hashBytes("test-only evidence")).toString("hex"),
  resultHash: (await hashBytes("human-approved test result")).toString("hex"),
  eligible: true,
};
async function run(action: EscrowAction, actor: TransactionSigner = payer) {
  await send(
    action + "-" + actor.address,
    await escrowInstructions(config!, String(actor.address), action, extra),
  );
}
await run("initialize");
await run("accept_role", reviewer);
await run("accept_role", backup);
await run("publish");
await run("register_submission", student);
while (Date.now() < (config.submitDeadline + 3) * 1000)
  await new Promise((r) => setTimeout(r, 1000));
const actingReviewer =
  Date.now() / 1000 > config.reviewDeadline ? backup : reviewer;
await run("record_result", actingReviewer);
await run("allocate_award", actingReviewer);
await wait(
  transactions["allocate_award-" + actingReviewer.address],
  "finalized",
);
const balance = (
  await client.rpc
    .getBalance(student.address, { commitment: "confirmed" })
    .send()
).value;
await send("empty_student_wallet", [
  getTransferSolInstruction({
    source: student,
    destination: payer.address,
    amount: balance,
  }),
]);
await wait(transactions.empty_student_wallet, "finalized");
const before = (
  await client.rpc
    .getBalance(student.address, { commitment: "finalized" })
    .send()
).value;
assert.equal(before, BigInt(0));
const escrow = await escrowAddress(config),
  prepared = await buildSponsoredClaim(
    rpc,
    escrow,
    String(student.address),
    String(payer.address),
  );
const unsigned = getTransactionDecoder().decode(
  Buffer.from(prepared.unsignedBase64, "base64"),
);
const studentSignature = nacl.sign.detached(
  Uint8Array.from(unsigned.messageBytes),
  generated.student.secretKey,
);
const partiallySigned = Buffer.from(
  getTransactionEncoder().encode({
    ...unsigned,
    signatures: {
      ...unsigned.signatures,
      [student.address]: studentSignature as SignatureBytes,
    },
  }),
).toString("base64");
const signed = coSignSponsoredClaim(
  prepared.messageBase64,
  partiallySigned,
  String(student.address),
  secret,
);
transactions.sponsored_claim = signed.signature;
await checkpoint();
await escrowRpc(rpc, "sendTransaction", [
  signed.transaction,
  { encoding: "base64", preflightCommitment: "confirmed" },
]);
await wait(signed.signature, "finalized");
const after = (
  await client.rpc
    .getBalance(student.address, { commitment: "finalized" })
    .send()
).value;
assert.equal(after, BigInt(1000000));
assert.equal(
  (await inspectReward(rpc, escrow, String(student.address))).submission?.paid,
  true,
);
const chain = await escrowRpc<{
  meta: { err: unknown; fee: number };
  transaction: { message: { accountKeys: string[] } };
}>(rpc, "getTransaction", [
  signed.signature,
  {
    encoding: "json",
    commitment: "finalized",
    maxSupportedTransactionVersion: 0,
  },
]);
assert.equal(chain.meta.err, null);
assert.equal(chain.transaction.message.accountKeys[0], String(payer.address));
await writeFile(
  "docs/solana/evidence/sponsored-claim-proof.json",
  JSON.stringify(
    {
      network: "Solana Devnet",
      escrow,
      recipient: String(student.address),
      feePayer: String(payer.address),
      claimTx: signed.signature,
      recipientLamportsBefore: String(before),
      recipientLamportsAfter: String(after),
      feeLamports: chain.meta.fee,
      status: "finalized",
      verifiedAt: new Date().toISOString(),
      scope:
        "Live SOL sponsored claim via production transaction builder/co-signer. Not a live USDC claim.",
    },
    null,
    2,
  ),
);
console.log(
  "Verified: zero-SOL recipient received 0.001 SOL; sponsor paid network fees.",
);

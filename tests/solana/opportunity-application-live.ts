// Dedicated Devnet integration proof. Uses test credentials and revokes only its own test attestation.
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import {
  bootstrapIssuer,
  issueAttestation,
  revokeAttestation,
} from "../../solana/server/solana-credentials.ts";
import {
  initializeOpportunityPolicy,
  recordOpportunityAccess,
} from "../../solana/server/opportunity-gate.ts";
import { checkOpportunityCredential } from "../../solana/client/opportunity-verification.ts";
import { escrowRpc } from "../../solana/client/challenge-escrow.ts";
assert.ok(process.env.ESCROW_PROOF_PAYER_PATH);
assert.ok(process.env.DEVNET_STUDENT_ADDRESS);
const rpc = "https://api.devnet.solana.com",
  secret = await readFile(process.env.ESCROW_PROOF_PAYER_PATH, "utf8"),
  wallet = process.env.DEVNET_STUDENT_ADDRESS;
const environment = {
  SOLANA_RPC_URL: rpc,
  SOLANA_FEE_PAYER_SECRET: secret,
  SOLANA_ISSUER_SECRET: secret,
  SOLANA_AUTHORIZED_SIGNER_SECRET: secret,
};
const baseFetch = globalThis.fetch;
let lastStatus = 0;
globalThis.fetch = (async (url, init) => {
  const method = JSON.parse(String(init?.body || "{}")).method;
  if (method === "getSignatureStatuses") {
    const delay = lastStatus + 2200 - Date.now();
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    lastStatus = Date.now();
  }
  return baseFetch(url, init);
}) as typeof fetch;
const id = crypto.randomUUID(),
  challengeId = "competition-" + id,
  opportunityId = "external-employer-" + id;
const proof: Record<string, unknown> = {
  network: "Solana Devnet",
  wallet,
  challengeId,
  opportunityId,
};
async function save() {
  await writeFile(
    ".data/opportunity-live-progress.json",
    JSON.stringify(proof, null, 2),
  );
}
async function finalized(signature: string | null) {
  if (!signature) return;
  for (let i = 0; i < 50; i++) {
    try {
      const status = await escrowRpc<{
        value: ({ err: unknown; confirmationStatus: string } | null)[];
      }>(rpc, "getSignatureStatuses", [
        [signature],
        { searchTransactionHistory: true },
      ]);
      if (status.value[0]?.err) throw Error("Transaction failed");
      if (status.value[0]?.confirmationStatus === "finalized") return;
    } catch (e) {
      if (!(e instanceof Error) || !/Too many|429|rate limit/i.test(e.message))
        throw e;
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  throw Error("Finalization pending; inspect progress before another run");
}
const issuer = await bootstrapIssuer(environment, "issuer-" + id);
proof.issuer = issuer;
await save();
console.log("Test issuer ready");
const credential = await issueAttestation(environment, {
  credentialAddress: String(issuer.credentialAddress),
  schemaAddress: String(issuer.schemaAddress),
  studentWallet: wallet,
  challengeId,
  score: 87,
  evidenceHash: "test-evidence-" + id,
  reviewerRole: "BUSINESS_HUMAN_REVIEWER",
  nonceSeed: id,
  expiryUnix: Math.floor(Date.now() / 1000) + 3600,
});
proof.credential = credential;
await save();
await finalized(credential.signature);
const policy = await initializeOpportunityPolicy(environment, {
  opportunityId,
  credentialAddress: String(issuer.credentialAddress),
  schemaAddress: String(issuer.schemaAddress),
  minimumScore: 80,
});
proof.policy = policy;
await save();
await finalized(policy.signature);
const accepted = await checkOpportunityCredential(
  rpc,
  policy.policyAddress,
  opportunityId,
  wallet,
  credential.attestationAddress,
);
assert.equal(accepted.valid, true);
proof.accepted = accepted;
console.log("Credential accepted against the on-chain opportunity policy");
const receipt = await recordOpportunityAccess(environment, {
  policyAddress: policy.policyAddress,
  attestationAddress: credential.attestationAddress,
  subjectWallet: wallet,
  score: 87,
  verificationPayload: JSON.stringify(accepted),
});
proof.receipt = receipt;
await save();
await finalized(receipt.signature);
const revokedTx = await revokeAttestation(
  environment,
  String(issuer.credentialAddress),
  credential.attestationAddress,
);
proof.revokedTx = revokedTx;
await save();
await finalized(revokedTx);
const denied = await checkOpportunityCredential(
  rpc,
  policy.policyAddress,
  opportunityId,
  wallet,
  credential.attestationAddress,
);
assert.equal(denied.valid, false);
assert.equal(denied.reason, "CREDENTIAL_REVOKED");
proof.afterRevocation = denied;
proof.verifiedAt = new Date().toISOString();
proof.scope =
  "Live credential, opportunity policy and historical verification receipt; fresh check denies revoked credential. This is a protocol integration test, not evidence of customer adoption.";
await writeFile(
  "docs/solana/evidence/opportunity-application-proof.json",
  JSON.stringify(proof, null, 2),
);
console.log("Verified: eligible before revocation, denied after revocation.");

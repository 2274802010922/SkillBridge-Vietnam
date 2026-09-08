import assert from "node:assert/strict";
import { address } from "gill";
import {
  bootstrapIssuer,
  issueAttestation,
  solanaClient,
  verifyAttestation,
} from "../../solana/server/solana-credentials.ts";
import {
  initializeOpportunityPolicy,
  recordOpportunityAccess,
} from "../../solana/server/opportunity-gate.ts";

const environment = {
  SOLANA_RPC_URL: process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
  SOLANA_FEE_PAYER_SECRET: process.env.SOLANA_FEE_PAYER_SECRET,
  SOLANA_ISSUER_SECRET: process.env.SOLANA_ISSUER_SECRET,
  SOLANA_AUTHORIZED_SIGNER_SECRET: process.env.SOLANA_AUTHORIZED_SIGNER_SECRET,
};

const studentWallet = process.env.DEVNET_STUDENT_ADDRESS;
assert.ok(studentWallet, "DEVNET_STUDENT_ADDRESS is required");

const runId = crypto.randomUUID();
const challengeId = `challenge-${runId}`;
const opportunityId = `opportunity-${runId}`;
const issuer = await bootstrapIssuer(environment, `smoke-${runId}`);
const attestation = await issueAttestation(environment, {
  credentialAddress: String(issuer.credentialAddress),
  schemaAddress: String(issuer.schemaAddress),
  studentWallet,
  challengeId,
  score: 87,
  evidenceHash: "sha256:skillbridge-devnet-smoke",
  reviewerRole: "university_reviewer",
  nonceSeed: `attestation-${runId}`,
  expiryUnix: Math.floor(Date.now() / 1000) + 86_400,
});

const verification = await verifyAttestation(environment, {
  schemaAddress: String(issuer.schemaAddress),
  attestationAddress: String(attestation.attestationAddress),
  studentWallet,
  challengeId,
  minimumScore: 80,
});
assert.equal(verification.valid, true, `attestation verification failed: ${verification.reason}`);

const policy = await initializeOpportunityPolicy(environment, {
  opportunityId,
  credentialAddress: String(issuer.credentialAddress),
  schemaAddress: String(issuer.schemaAddress),
  minimumScore: 80,
});
const receipt = await recordOpportunityAccess(environment, {
  policyAddress: policy.policyAddress,
  attestationAddress: String(attestation.attestationAddress),
  subjectWallet: studentWallet,
  score: 87,
  verificationPayload: JSON.stringify({ opportunityId, verification }),
});

const rpc = solanaClient(environment).rpc;
const [policyAccount, receiptAccount] = await Promise.all([
  rpc.getAccountInfo(address(policy.policyAddress), { encoding: "base64" }).send(),
  rpc.getAccountInfo(address(receipt.receiptAddress), { encoding: "base64" }).send(),
]);
assert.ok(policyAccount.value, "policy PDA must exist on Devnet");
assert.ok(receiptAccount.value, "access receipt PDA must exist on Devnet");

console.log(JSON.stringify({
  network: "devnet",
  issuer: {
    credentialAddress: String(issuer.credentialAddress),
    schemaAddress: String(issuer.schemaAddress),
    credentialTx: issuer.credentialTx,
    schemaTx: issuer.schemaTx,
  },
  attestation: {
    address: String(attestation.attestationAddress),
    transaction: attestation.signature,
  },
  verification,
  policy,
  receipt,
}, null, 2));

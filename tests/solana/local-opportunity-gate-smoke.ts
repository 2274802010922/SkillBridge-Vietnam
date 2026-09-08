import assert from "node:assert/strict";
import { address } from "gill";
import { initializeOpportunityPolicy, recordOpportunityAccess } from "../../solana/server/opportunity-gate.ts";
import { solanaClient } from "../../solana/server/solana-credentials.ts";

const environment = {
  SOLANA_RPC_URL: process.env.SOLANA_RPC_URL,
  SOLANA_FEE_PAYER_SECRET: process.env.SOLANA_FEE_PAYER_SECRET,
  SOLANA_ISSUER_SECRET: process.env.SOLANA_ISSUER_SECRET,
  SOLANA_AUTHORIZED_SIGNER_SECRET: process.env.SOLANA_AUTHORIZED_SIGNER_SECRET,
};

const opportunityId = `local-smoke-${crypto.randomUUID()}`;
const credentialAddress = process.env.LOCAL_CREDENTIAL_ADDRESS!;
const schemaAddress = process.env.LOCAL_SCHEMA_ADDRESS!;
const subjectWallet = process.env.LOCAL_SUBJECT_ADDRESS!;
const attestationAddress = address(process.env.LOCAL_ATTESTATION_ADDRESS!);

const policy = await initializeOpportunityPolicy(environment, {
  opportunityId,
  credentialAddress,
  schemaAddress,
  minimumScore: 80,
});
const receipt = await recordOpportunityAccess(environment, {
  policyAddress: policy.policyAddress,
  attestationAddress,
  subjectWallet,
  score: 87,
  verificationPayload: JSON.stringify({ opportunityId, valid: true, score: 87 }),
});

const rpc = solanaClient(environment).rpc;
const [policyAccount, receiptAccount] = await Promise.all([
  rpc.getAccountInfo(address(policy.policyAddress), { encoding: "base64" }).send(),
  rpc.getAccountInfo(address(receipt.receiptAddress), { encoding: "base64" }).send(),
]);
assert.ok(policyAccount.value, "policy PDA must exist after initialization");
assert.ok(receiptAccount.value, "access receipt PDA must exist after verification");
console.log(JSON.stringify({ policy, receipt }, null, 2));

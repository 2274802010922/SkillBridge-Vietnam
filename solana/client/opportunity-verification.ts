import { Buffer } from "buffer";
import bs58 from "bs58";
import { address, getProgramDerivedAddress } from "gill";
import {
  getAttestationDecoder,
  getSchemaDecoder,
  getCredentialDecoder,
  deserializeAttestationData,
  SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS as SAS,
} from "sas-lib";
import {
  assertEscrowDevnet,
  escrowRpc,
  disc,
  hashBytes,
} from "./challenge-escrow.ts";
export const GATE_PROGRAM = "AuXFxfT41YMsG53euEB1tFjyUiMLKxfucQnYX4jhekCE";
type Raw = { owner: string; data: [string, string] };
async function account(rpc: string, key: string, owner: string) {
  const r = await escrowRpc<{ value: Raw | null }>(rpc, "getAccountInfo", [
    key,
    { encoding: "base64", commitment: "finalized" },
  ]);
  if (!r.value) return null;
  if (r.value.owner !== owner) throw new Error("ACCOUNT_OWNER_MISMATCH");
  return Buffer.from(r.value.data[0], "base64");
}
export type Eligibility = {
  valid: boolean;
  reason: string;
  checks: {
    wallet: boolean;
    issuer: boolean;
    active: boolean;
    score: boolean;
    approved: boolean;
  };
  score: number | null;
  checkedAt: string;
  policyAddress: string;
  attestation: string | null;
};
export async function checkOpportunityCredential(
  rpc: string,
  policyAddress: string,
  opportunityId: string,
  wallet: string,
  attestation: string | null,
): Promise<Eligibility> {
  await assertEscrowDevnet(rpc);
  address(wallet);
  const checks = {
    wallet: false,
    issuer: false,
    active: false,
    score: false,
    approved: false,
  };
  const result = (
    reason: string,
    score: number | null = null,
  ): Eligibility => ({
    valid: Object.values(checks).every(Boolean),
    reason,
    checks,
    score,
    checkedAt: new Date().toISOString(),
    policyAddress,
    attestation,
  });
  const p = await account(rpc, policyAddress, GATE_PROGRAM);
  if (
    !p ||
    p.length < 172 ||
    !p.subarray(0, 8).equals(await disc("account:Policy"))
  )
    throw new Error("POLICY_UNAVAILABLE");
  const pk = (start: number) => bs58.encode(p.subarray(start, start + 32));
  const expectedHash = await hashBytes(opportunityId);
  const [expectedPda] = await getProgramDerivedAddress({
    programAddress: address(GATE_PROGRAM),
    seeds: [Buffer.from("policy"), p.subarray(8, 40), expectedHash],
  });
  if (
    !p.subarray(40, 72).equals(expectedHash) ||
    String(expectedPda) !== policyAddress
  )
    throw new Error("POLICY_MISMATCH");
  if (p[170] !== 1) return result("OPPORTUNITY_CLOSED");
  if (!attestation) return result("NO_MATCHING_CREDENTIAL");
  const raw = await account(rpc, attestation, String(SAS));
  if (!raw) return result("CREDENTIAL_REVOKED");
  const a = getAttestationDecoder().decode(raw);
  checks.issuer =
    String(a.credential) === pk(72) && String(a.schema) === pk(104);
  if (!checks.issuer) return result("WRONG_ISSUER");
  const schemaRaw = await account(rpc, String(a.schema), String(SAS)),
    issuerRaw = await account(rpc, String(a.credential), String(SAS));
  if (!schemaRaw || !issuerRaw) return result("ISSUER_UNAVAILABLE");
  const schema = getSchemaDecoder().decode(schemaRaw),
    issuer = getCredentialDecoder().decode(issuerRaw);
  if (schema.credential !== a.credential) return result("WRONG_ISSUER");
  const data = deserializeAttestationData(
    schema,
    a.data as Uint8Array,
  ) as Record<string, unknown>;
  checks.wallet = data.studentWallet === wallet;
  checks.approved = data.humanApproved === true;
  checks.active =
    !schema.isPaused &&
    (a.expiry === BigInt(0) ||
      a.expiry > BigInt(Math.floor(Date.now() / 1000))) &&
    (issuer.authorizedSigners.includes(a.signer) ||
      issuer.authority === a.signer);
  checks.score =
    typeof data.overallScore === "number" &&
    Number.isFinite(data.overallScore) &&
    data.overallScore >= p.readUInt16LE(168) &&
    data.overallScore <= 100;
  const reason = !checks.wallet
    ? "WRONG_WALLET"
    : !checks.active
      ? "CREDENTIAL_NOT_ACTIVE"
      : !checks.approved
        ? "NOT_HUMAN_APPROVED"
        : !checks.score
          ? "SCORE_BELOW_THRESHOLD"
          : "ACTIVE_ONCHAIN_CREDENTIAL";
  return result(
    reason,
    typeof data.overallScore === "number" ? data.overallScore : null,
  );
}

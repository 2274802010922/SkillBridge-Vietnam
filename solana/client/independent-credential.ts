import { address, createSolanaClient } from "gill";
import {
  fetchAttestation,
  fetchSchema,
  fetchCredential,
  deserializeAttestationData,
  SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS,
} from "sas-lib";
import { assertEscrowDevnet, escrowRpc } from "./challenge-escrow.ts";

export function credentialPolicy(
  data: Record<string, unknown>,
  input: {
    wallet: string;
    challengeId: string;
    minimumScore: number;
    trustedIssuers: string[];
  },
  issuer: string,
  active: boolean,
  signerAuthorized: boolean,
) {
  const trusted = input.trustedIssuers.includes(issuer);
  const matches =
    Number.isFinite(input.minimumScore) &&
    input.minimumScore >= 0 &&
    input.minimumScore <= 100 &&
    data.studentWallet === input.wallet &&
    data.challengeId === input.challengeId &&
    data.humanApproved === true &&
    typeof data.overallScore === "number" &&
    Number.isFinite(data.overallScore) &&
    data.overallScore >= input.minimumScore &&
    data.overallScore <= 100;
  return {
    active,
    signerAuthorized,
    trusted,
    matches,
    accepted: active && signerAuthorized && trusted && matches,
  };
}

export async function verifyIndependentCredential(input: {
  rpc: string;
  attestation: string;
  wallet: string;
  challengeId: string;
  trustedIssuers: string[];
  minimumScore: number;
}) {
  await assertEscrowDevnet(input.rpc);
  address(input.wallet);
  if (
    !Number.isFinite(input.minimumScore) ||
    input.minimumScore < 0 ||
    input.minimumScore > 100
  )
    throw new Error("Ngưỡng điểm không hợp lệ.");
  const rpc = createSolanaClient({ urlOrMoniker: input.rpc as "devnet" }).rpc;
  const a = await fetchAttestation(rpc, address(input.attestation), {
    commitment: "finalized",
  });
  const s = await fetchSchema(rpc, a.data.schema, { commitment: "finalized" });
  const c = await fetchCredential(rpc, a.data.credential, {
    commitment: "finalized",
  });
  for (const key of [
    input.attestation,
    String(a.data.schema),
    String(a.data.credential),
  ]) {
    const raw = await escrowRpc<{ value: { owner: string } | null }>(
      input.rpc,
      "getAccountInfo",
      [key, { encoding: "base64", commitment: "finalized" }],
    );
    if (raw.value?.owner !== String(SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS))
      throw new Error("Tài khoản không thuộc SAS.");
  }
  if (s.data.credential !== a.data.credential)
    throw new Error("Schema và đơn vị phát hành không khớp.");
  const data = deserializeAttestationData(
    s.data,
    a.data.data as Uint8Array,
  ) as Record<string, unknown>;
  const active =
    !s.data.isPaused &&
    (a.data.expiry === BigInt(0) ||
      a.data.expiry > BigInt(Math.floor(Date.now() / 1000)));
  const signerAuthorized =
    c.data.authorizedSigners.includes(a.data.signer) ||
    c.data.authority === a.data.signer;
  const issuer = String(c.data.authority);
  return {
    attestation: input.attestation,
    issuer,
    signer: String(a.data.signer),
    ...credentialPolicy(data, input, issuer, active, signerAuthorized),
    data,
  };
}

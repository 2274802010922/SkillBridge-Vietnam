import { Buffer } from "buffer";
import bs58 from "bs58";
import { address } from "gill";
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
  ESCROW_PROGRAM,
  decodeSubmission,
  decodeEscrow,
  submissionAddress,
  SYSTEM,
  DEVNET_USDC,
} from "./challenge-escrow.ts";

type ChainAccount = { owner: string; data: [string, string] };
type Entry = { pubkey: string; account: ChainAccount };
async function accounts(rpc: string, keys: string[]) {
  const output = new Map<string, ChainAccount | null>();
  for (let start = 0; start < keys.length; start += 100) {
    const slice = keys.slice(start, start + 100);
    const result = await escrowRpc<{ value: (ChainAccount | null)[] }>(
      rpc,
      "getMultipleAccounts",
      [slice, { encoding: "base64", commitment: "finalized" }],
    );
    if (result.value.length !== slice.length)
      throw new Error("Incomplete RPC response");
    slice.forEach((key, i) => output.set(key, result.value[i]));
  }
  return output;
}
function bytes(account: ChainAccount | null | undefined, owner: string) {
  if (!account || account.owner !== owner)
    throw new Error("Account owner mismatch or unavailable");
  return Buffer.from(account.data[0], "base64");
}
export function formatAtomic(value: string, decimals: number) {
  const amount = BigInt(value),
    scale = BigInt(10) ** BigInt(decimals);
  const fraction = (amount % scale)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  return (amount / scale).toString() + (fraction ? "." + fraction : "");
}
export async function discoverRewards(rpc: string, wallet: string) {
  address(wallet);
  await assertEscrowDevnet(rpc);
  const rows = await escrowRpc<Entry[]>(rpc, "getProgramAccounts", [
    ESCROW_PROGRAM,
    {
      encoding: "base64",
      commitment: "finalized",
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: bs58.encode(await disc("account:Submission")),
          },
        },
        { memcmp: { offset: 40, bytes: wallet } },
      ],
    },
  ]);
  if (rows.length > 500)
    throw new Error(
      "Too many records; use advanced lookup for a specific fund.",
    );
  const receipts = await Promise.all(
    rows.map(async (row) => {
      const raw = bytes(row.account, ESCROW_PROGRAM);
      if (!raw.subarray(0, 8).equals(await disc("account:Submission")))
        throw new Error("Invalid receipt");
      const receipt = decodeSubmission(raw);
      if (
        receipt.student !== wallet ||
        (await submissionAddress(receipt.escrow, wallet)) !== row.pubkey
      )
        throw new Error("Receipt does not belong to wallet");
      return receipt;
    }),
  );
  const funds = await accounts(rpc, [
    ...new Set(receipts.map((s) => s.escrow)),
  ]);
  return Promise.all(
    receipts.map(async (receipt) => {
      const raw = bytes(funds.get(receipt.escrow), ESCROW_PROGRAM);
      if (!raw.subarray(0, 8).equals(await disc("account:Escrow")))
        throw new Error("Invalid fund");
      const state = decodeEscrow(raw);
      const supported = state.mint === SYSTEM || state.mint === DEVNET_USDC;
      return {
        escrow: receipt.escrow,
        recipient: wallet,
        state,
        submission: receipt,
        claimable:
          supported &&
          receipt.decision === 3 &&
          !receipt.paid &&
          [1, 2].includes(state.state),
        amount: formatAtomic(state.amount, state.mint === SYSTEM ? 9 : 6),
        asset:
          state.mint === SYSTEM
            ? "SOL Devnet"
            : state.mint === DEVNET_USDC
              ? "USDC Devnet"
              : "Unsupported token",
      };
    }),
  );
}

// SAS v1 header: u8 + nonce/credential/schema (3*32) + vector length (4).
// SkillBridge v1 data starts with a Borsh string: wallet length (4), then wallet UTF-8.
export const BADGE_WALLET_OFFSET = 105;
export async function discoverBadges(
  rpc: string,
  wallet: string,
  trustedIssuers: string[],
) {
  address(wallet);
  await assertEscrowDevnet(rpc);
  if (!trustedIssuers.length) throw new Error("ISSUERS_NOT_CONFIGURED");
  const rows = await escrowRpc<Entry[]>(rpc, "getProgramAccounts", [
    String(SAS),
    {
      encoding: "base64",
      commitment: "finalized",
      filters: [
        {
          memcmp: {
            offset: BADGE_WALLET_OFFSET,
            bytes: bs58.encode(Buffer.from(wallet)),
          },
        },
      ],
    },
  ]);
  if (rows.length > 500)
    throw new Error("Too many credentials; use advanced verification.");
  const attestations = rows.map((row) => ({
    address: row.pubkey,
    data: getAttestationDecoder().decode(bytes(row.account, String(SAS))),
  }));
  const schemaAccounts = await accounts(rpc, [
    ...new Set(attestations.map((a) => String(a.data.schema))),
  ]);
  const issuerAccounts = await accounts(rpc, [
    ...new Set(attestations.map((a) => String(a.data.credential))),
  ]);
  const result = [];
  for (const a of attestations) {
    const schema = getSchemaDecoder().decode(
      bytes(schemaAccounts.get(String(a.data.schema)), String(SAS)),
    );
    const issuer = getCredentialDecoder().decode(
      bytes(issuerAccounts.get(String(a.data.credential)), String(SAS)),
    );
    if (!trustedIssuers.includes(String(issuer.authority))) continue;
    if (
      new TextDecoder().decode(schema.name) !== "PROOF-OF-SKILL" ||
      schema.credential !== a.data.credential
    )
      continue;
    const data = deserializeAttestationData(
      schema,
      a.data.data as Uint8Array,
    ) as Record<string, unknown>;
    if (
      data.studentWallet !== wallet ||
      data.humanApproved !== true ||
      typeof data.challengeId !== "string" ||
      typeof data.overallScore !== "number" ||
      data.overallScore < 0 ||
      data.overallScore > 100
    )
      continue;
    const expired =
      a.data.expiry !== BigInt(0) &&
      a.data.expiry <= BigInt(Math.floor(Date.now() / 1000));
    const authorized =
      issuer.authority === a.data.signer ||
      issuer.authorizedSigners.includes(a.data.signer);
    result.push({
      address: a.address,
      challengeId: data.challengeId,
      score: data.overallScore,
      issuer: String(issuer.authority),
      issuerName: new TextDecoder().decode(issuer.name),
      expiresAt: a.data.expiry.toString(),
      status: expired
        ? "expired"
        : schema.isPaused
          ? "paused"
          : !authorized
            ? "unauthorized"
            : "active",
    });
  }
  return result;
}

import { Buffer } from "buffer";
import bs58 from "bs58";
import nacl from "tweetnacl";
import {
  address,
  createNoopSigner,
  createTransaction,
  compileTransaction,
  getTransactionDecoder,
  getTransactionEncoder,
  type SignatureBytes,
  type Blockhash,
} from "gill";
import { independentClaimInstructions } from "../client/independent-claim.ts";
import { escrowRpc, DEVNET_USDC, TOKEN } from "../client/challenge-escrow.ts";
import { getAssociatedTokenAccountAddress } from "gill/programs/token";
export function sponsorKey(raw: string) {
  const secret = raw.trim().startsWith("[")
    ? Uint8Array.from(JSON.parse(raw))
    : bs58.decode(raw);
  if (secret.length !== 64) throw new Error("Invalid sponsor key");
  const key = nacl.sign.keyPair.fromSeed(secret.slice(0, 32));
  if (!Buffer.from(key.secretKey).equals(Buffer.from(secret)))
    throw new Error("Invalid sponsor key");
  return { secret: key.secretKey, address: bs58.encode(key.publicKey) };
}
export async function buildSponsoredClaim(
  rpc: string,
  escrow: string,
  recipient: string,
  sponsor: string,
) {
  if (sponsor === recipient)
    throw new Error("Sponsor must differ from recipient");
  const instructions = await independentClaimInstructions(
    rpc,
    escrow,
    recipient,
    sponsor,
  );
  const latest = await escrowRpc<{
    value: { blockhash: string; lastValidBlockHeight: number };
  }>(rpc, "getLatestBlockhash", [{ commitment: "confirmed" }]);
  const message = createTransaction({
    version: "legacy",
    feePayer: createNoopSigner(address(sponsor)),
    instructions,
    latestBlockhash: {
      blockhash: latest.value.blockhash as Blockhash,
      lastValidBlockHeight: BigInt(latest.value.lastValidBlockHeight),
    },
    computeUnitLimit: 300000,
  });
  const tx = compileTransaction(message);
  const messageBase64 = Buffer.from(tx.messageBytes).toString("base64"),
    unsignedBase64 = Buffer.from(getTransactionEncoder().encode(tx)).toString(
      "base64",
    );
  const fee = await escrowRpc<{ value: number | null }>(
    rpc,
    "getFeeForMessage",
    [messageBase64, { commitment: "confirmed" }],
  );
  if (fee.value === null) throw new Error("Fee unavailable");
  let reserve = fee.value;
  if (instructions.length > 1) {
    const ata = String(
      await getAssociatedTokenAccountAddress(
        address(DEVNET_USDC),
        address(recipient),
        address(TOKEN),
      ),
    );
    const existing = await escrowRpc<{ value: unknown }>(
      rpc,
      "getAccountInfo",
      [ata, { encoding: "base64", commitment: "confirmed" }],
    );
    if (!existing.value)
      reserve += await escrowRpc<number>(
        rpc,
        "getMinimumBalanceForRentExemption",
        [165],
      );
  }
  const simulation = await escrowRpc<{ value: { err: unknown } }>(
    rpc,
    "simulateTransaction",
    [
      unsignedBase64,
      {
        encoding: "base64",
        sigVerify: false,
        replaceRecentBlockhash: true,
        commitment: "confirmed",
      },
    ],
  );
  if (simulation.value.err)
    throw new Error("Sponsor balance or claim simulation failed");
  return {
    messageBase64,
    unsignedBase64,
    lastValidHeight: String(latest.value.lastValidBlockHeight),
    reserve,
  };
}
export function coSignSponsoredClaim(
  expectedMessage: string,
  wire: string,
  recipient: string,
  rawKey: string,
) {
  if (wire.length > 5000) throw new Error("Invalid transaction");
  const tx = getTransactionDecoder().decode(Buffer.from(wire, "base64"));
  if (
    !Buffer.from(tx.messageBytes).equals(Buffer.from(expectedMessage, "base64"))
  )
    throw new Error("Transaction was modified");
  const sponsor = sponsorKey(rawKey);
  const keys = Object.keys(tx.signatures);
  if (
    keys.length !== 2 ||
    keys[0] !== sponsor.address ||
    !keys.includes(recipient)
  )
    throw new Error("Unexpected signers");
  const signature = tx.signatures[address(recipient)];
  if (
    !signature ||
    !nacl.sign.detached.verify(
      Uint8Array.from(tx.messageBytes),
      Uint8Array.from(signature),
      bs58.decode(recipient),
    )
  )
    throw new Error("Recipient signature invalid");
  const sponsorSignature = nacl.sign.detached(
    Uint8Array.from(tx.messageBytes),
    sponsor.secret,
  );
  const signed = {
    ...tx,
    signatures: {
      ...tx.signatures,
      [sponsor.address]: sponsorSignature as SignatureBytes,
    },
  };
  return {
    signature: bs58.encode(sponsorSignature),
    transaction: Buffer.from(getTransactionEncoder().encode(signed)).toString(
      "base64",
    ),
  };
}

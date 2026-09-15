import test from "node:test";
import assert from "node:assert/strict";
import nacl from "tweetnacl";
import bs58 from "bs58";
import {
  address,
  AccountRole,
  createNoopSigner,
  createTransaction,
  compileTransaction,
  getTransactionEncoder,
  getTransactionDecoder,
  type Blockhash,
  type SignatureBytes,
} from "gill";
import { coSignSponsoredClaim } from "../../solana/server/sponsored-claim.ts";
const sponsor = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(1)),
  student = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(2));
const sponsorAddress = address(bs58.encode(sponsor.publicKey)),
  studentAddress = address(bs58.encode(student.publicKey));
function fixture(value = 1) {
  const message = createTransaction({
    version: "legacy",
    feePayer: createNoopSigner(sponsorAddress),
    instructions: [
      {
        programAddress: address("11111111111111111111111111111111"),
        accounts: [
          { address: studentAddress, role: AccountRole.WRITABLE_SIGNER },
        ],
        data: new Uint8Array([value]),
      },
    ],
    latestBlockhash: {
      blockhash: "11111111111111111111111111111111" as Blockhash,
      lastValidBlockHeight: BigInt(500),
    },
    computeUnitLimit: 300000,
  });
  const tx = compileTransaction(message);
  const signature = nacl.sign.detached(
    Uint8Array.from(tx.messageBytes),
    student.secretKey,
  );
  return {
    message: Buffer.from(tx.messageBytes).toString("base64"),
    wire: Buffer.from(
      getTransactionEncoder().encode({
        ...tx,
        signatures: {
          ...tx.signatures,
          [studentAddress]: signature as SignatureBytes,
        },
      }),
    ).toString("base64"),
  };
}
test("sponsorship adds a valid fee-payer signature and retains recipient signature", () => {
  const f = fixture(),
    result = coSignSponsoredClaim(
      f.message,
      f.wire,
      studentAddress,
      JSON.stringify([...sponsor.secretKey]),
    );
  const tx = getTransactionDecoder().decode(
    Buffer.from(result.transaction, "base64"),
  );
  for (const [who, signature] of Object.entries(tx.signatures))
    assert.equal(
      nacl.sign.detached.verify(
        Uint8Array.from(tx.messageBytes),
        Uint8Array.from(signature!),
        bs58.decode(who),
      ),
      true,
    );
  assert.equal(result.signature, bs58.encode(tx.signatures[sponsorAddress]!));
});
test("changed instructions, wrong recipient and missing signature cannot be sponsored", () => {
  const f = fixture();
  assert.throws(
    () =>
      coSignSponsoredClaim(
        f.message,
        fixture(2).wire,
        studentAddress,
        JSON.stringify([...sponsor.secretKey]),
      ),
    /modified/,
  );
  assert.throws(
    () =>
      coSignSponsoredClaim(
        f.message,
        f.wire,
        "11111111111111111111111111111111",
        JSON.stringify([...sponsor.secretKey]),
      ),
    /signers/,
  );
  const tx = getTransactionDecoder().decode(Buffer.from(f.wire, "base64"));
  const wire = Buffer.from(
    getTransactionEncoder().encode({
      ...tx,
      signatures: { ...tx.signatures, [studentAddress]: null },
    }),
  ).toString("base64");
  assert.throws(
    () =>
      coSignSponsoredClaim(
        f.message,
        wire,
        studentAddress,
        JSON.stringify([...sponsor.secretKey]),
      ),
    /signature/,
  );
});

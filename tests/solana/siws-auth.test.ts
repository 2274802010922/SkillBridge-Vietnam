import assert from "node:assert/strict";
import test from "node:test";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { createSignInMessage, verifySignIn } from "@solana/wallet-standard-util";
import type { SolanaSignInInput, SolanaSignInOutput } from "@solana/wallet-standard-features";
import { randomAlphanumericToken } from "../../backend/auth/random-token.ts";
import { createAuthenticationSignInInput } from "../../shared/validation/siws.ts";

function fixture() {
  const keypair = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(7));
  const address = bs58.encode(keypair.publicKey);
  const input: SolanaSignInInput = createAuthenticationSignInInput({
    domain: "skillbridge.example",
    address,
    statement: "Sign in to SkillBridge Vietnam.",
    uri: "https://skillbridge.example",
    nonce: "FixedNonceForTest12345678",
    issuedAt: "2026-08-10T00:00:00.000Z",
    expirationTime: "2026-08-10T00:05:00.000Z",
    requestId: "00000000-0000-4000-8000-000000000001",
    resources: ["https://skillbridge.example/terms", "https://skillbridge.example/privacy"],
  });
  const signedMessage = createSignInMessage({ ...input, domain: input.domain!, address });
  const signature = nacl.sign.detached(signedMessage, keypair.secretKey);
  const output: SolanaSignInOutput = {
    account: { address, publicKey: keypair.publicKey, chains: ["solana:mainnet"], features: ["solana:signIn"] },
    signedMessage,
    signature,
    signatureType: "ed25519",
  };
  return { input, output };
}

test("SIWS nonce is Phantom-compatible alphanumeric text", () => {
  for (let index = 0; index < 100; index += 1) {
    assert.match(randomAlphanumericToken(24), /^[A-Za-z0-9]{24}$/);
  }
});

test("SIWS accepts a Phantom-compatible sign-in without a chain binding", () => {
  const { input, output } = fixture();
  assert.equal(input.chainId, undefined);
  assert.deepEqual(output.account.chains, ["solana:mainnet"]);
  assert.equal(verifySignIn(input, output), true);
});

test("SIWS rejects a signature replayed on another domain", () => {
  const { input, output } = fixture();
  assert.equal(verifySignIn({ ...input, domain: "attacker.example" }, output), false);
});

test("SIWS rejects a mutated signature", () => {
  const { input, output } = fixture();
  const signature = new Uint8Array(output.signature);
  signature[0] ^= 1;
  assert.equal(verifySignIn(input, { ...output, signature }), false);
});

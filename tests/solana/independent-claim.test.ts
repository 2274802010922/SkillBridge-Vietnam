import assert from "node:assert/strict";
import test from "node:test";
import {
  verifyCommittedText,
  inspectReward,
  independentClaimInstructions,
} from "../../solana/client/independent-claim.ts";
import {
  hashBytes,
  disc,
  ESCROW_PROGRAM,
  SYSTEM,
  DEVNET_USDC,
  submissionAddress,
} from "../../solana/client/challenge-escrow.ts";
import bs58 from "bs58";
import { AccountRole } from "gill";
import { credentialPolicy } from "../../solana/client/independent-credential.ts";

test("a second organization applies its own issuer and credential policy", () => {
  const policy = {
    wallet: "student",
    challengeId: "challenge",
    minimumScore: 70,
    trustedIssuers: ["issuer"],
  };
  const data = {
    studentWallet: "student",
    challengeId: "challenge",
    overallScore: 80,
    humanApproved: true,
  };
  assert.equal(
    credentialPolicy(data, policy, "issuer", true, true).accepted,
    true,
  );
  for (const [issuer, active, authorized] of [
    ["other", true, true],
    ["issuer", false, true],
    ["issuer", true, false],
  ] as const)
    assert.equal(
      credentialPolicy(data, policy, issuer, active, authorized).accepted,
      false,
    );
  for (const changed of [
    { studentWallet: "other" },
    { challengeId: "other" },
    { overallScore: 60 },
    { overallScore: 101 },
    { humanApproved: false },
  ]) {
    assert.equal(
      credentialPolicy({ ...data, ...changed }, policy, "issuer", true, true)
        .accepted,
      false,
    );
  }
});
test("committed text accepts the original bytes and rejects modified criteria", async () => {
  const text = JSON.stringify({ rubric: "Human review", slots: 1 });
  const hash = (await hashBytes(text)).toString("hex");
  assert.equal(await verifyCommittedText(text, hash), true);
  assert.equal(
    await verifyCommittedText(text.replace("slots", "winners"), hash),
    false,
  );
});

const escrow = bs58.encode(new Uint8Array(32).fill(7)),
  recipient = bs58.encode(new Uint8Array(32).fill(8));
async function mockChain(
  options: {
    paid?: boolean;
    decision?: number;
    mint?: string;
    wrongOwner?: boolean;
    wrongRecipient?: boolean;
  } = {},
) {
  const number = (value: number, size: number) => {
    const b = Buffer.alloc(size);
    b.writeUIntLE(value, 0, size);
    return b;
  };
  const n64 = (value: number) => {
    const b = Buffer.alloc(8);
    b.writeBigUInt64LE(BigInt(value));
    return b;
  };
  const state = Buffer.concat([
    await disc("account:Escrow"),
    ...Array.from({ length: 4 }, () => Buffer.from(bs58.decode(SYSTEM))),
    Buffer.from(bs58.decode(options.mint || SYSTEM)),
    Buffer.alloc(64),
    n64(1000000),
    number(1, 2),
    n64(1),
    n64(2),
    number(1, 1),
    number(3, 1),
    ...Array.from({ length: 4 }, () => n64(1000000)),
    number(1, 4),
    number(1, 4),
    number(255, 1),
  ]);
  const receipt = Buffer.concat([
    await disc("account:Submission"),
    Buffer.from(bs58.decode(escrow)),
    Buffer.from(bs58.decode(options.wrongRecipient ? SYSTEM : recipient)),
    Buffer.alloc(96),
    number(options.decision ?? 3, 1),
    number(options.paid ? 1 : 0, 1),
  ]);
  const original = globalThis.fetch;
  globalThis.fetch = (async (url, init) => {
    assert.equal(String(url), "https://rpc.invalid");
    const request = JSON.parse(String(init?.body));
    if (request.method === "getGenesisHash")
      return Response.json({
        result: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
      });
    assert.equal(request.method, "getAccountInfo");
    assert.equal(request.params[1].commitment, "finalized");
    return Response.json({
      result: {
        context: { slot: 1 },
        value: {
          owner: options.wrongOwner ? SYSTEM : ESCROW_PROGRAM,
          data: [
            (request.params[0] === escrow ? state : receipt).toString("base64"),
            "base64",
          ],
        },
      },
    });
  }) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}
test("SOL claim fixes recipient, program and receipt without a backend", async () => {
  const restore = await mockChain();
  try {
    const [ix] = await independentClaimInstructions(
      "https://rpc.invalid",
      escrow,
      recipient,
    );
    assert.equal(ix.programAddress, ESCROW_PROGRAM);
    assert.deepEqual(
      ix.accounts?.map((a) => a.address),
      [
        recipient,
        escrow,
        await submissionAddress(escrow, recipient),
        recipient,
      ],
    );
    assert.equal(ix.accounts?.[0].role, AccountRole.WRITABLE_SIGNER);
    assert.deepEqual(Buffer.from(ix.data!), await disc("global:claim_award"));
  } finally {
    restore();
  }
});
test("USDC claim creates the recipient ATA and fixes the accepted mint", async () => {
  const restore = await mockChain({ mint: DEVNET_USDC });
  try {
    const instructions = await independentClaimInstructions(
      "https://rpc.invalid",
      escrow,
      recipient,
    );
    assert.equal(instructions.length, 2);
    assert.equal(instructions[0].accounts?.[2].address, recipient);
    assert.equal(instructions[0].accounts?.[3].address, DEVNET_USDC);
    assert.equal(instructions[1].accounts?.length, 7);
  } finally {
    restore();
  }
});
test("paid, unallocated, forged owner and mismatched recipient are rejected", async () => {
  for (const options of [
    { paid: true },
    { decision: 1 },
    { wrongOwner: true },
    { wrongRecipient: true },
  ]) {
    const restore = await mockChain(options);
    try {
      await assert.rejects(() =>
        independentClaimInstructions("https://rpc.invalid", escrow, recipient),
      );
    } finally {
      restore();
    }
  }
});
test("independent tool refuses a different network before inspecting a reward", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    Response.json({ result: "mainnet" })) as typeof fetch;
  try {
    await assert.rejects(
      () =>
        inspectReward(
          "https://example.invalid",
          "11111111111111111111111111111111",
          "11111111111111111111111111111111",
        ),
      /Devnet/,
    );
  } finally {
    globalThis.fetch = original;
  }
});

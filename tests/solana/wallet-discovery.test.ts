import assert from "node:assert/strict";
import test from "node:test";
import { Buffer } from "buffer";
import bs58 from "bs58";
import { address } from "gill";
import {
  getAttestationEncoder,
  getSchemaEncoder,
  getCredentialEncoder,
  serializeAttestationData,
  SOLANA_ATTESTATION_SERVICE_PROGRAM_ADDRESS as SAS,
} from "sas-lib";
import {
  discoverBadges,
  discoverRewards,
  BADGE_WALLET_OFFSET,
  formatAtomic,
} from "../../solana/client/wallet-discovery.ts";

const key = (n: number) => address(bs58.encode(new Uint8Array(32).fill(n)));
const wallet = key(8),
  issuer = key(9),
  schemaKey = key(10),
  credentialKey = key(11);
const fields = [
  "studentWallet",
  "challengeId",
  "overallScore",
  "evidenceHash",
  "reviewerRole",
  "humanApproved",
];
const joined = Buffer.concat(
  fields.map((field) => {
    const text = Buffer.from(field),
      length = Buffer.alloc(4);
    length.writeUInt32LE(text.length);
    return Buffer.concat([length, text]);
  }),
);
async function withBadges(
  options: {
    expiry?: number;
    paused?: boolean;
    wrongOwner?: boolean;
    trusted?: string[];
  },
  run: (result: Awaited<ReturnType<typeof discoverBadges>>) => void,
) {
  const schema = {
    discriminator: 2,
    credential: credentialKey,
    name: Buffer.from("PROOF-OF-SKILL"),
    description: Buffer.from("skills"),
    layout: new Uint8Array([12, 12, 0, 12, 12, 10]),
    fieldNames: joined,
    isPaused: !!options.paused,
    version: 1,
  };
  const payload = serializeAttestationData(schema, {
    studentWallet: wallet,
    challengeId: "challenge",
    overallScore: 85,
    evidenceHash: "hash",
    reviewerRole: "HUMAN",
    humanApproved: true,
  });
  const attestation = Buffer.from(
    getAttestationEncoder().encode({
      discriminator: 0,
      nonce: key(1),
      credential: credentialKey,
      schema: schemaKey,
      data: payload,
      signer: issuer,
      expiry: options.expiry || 0,
      tokenAccount: key(2),
    }),
  );
  assert.equal(
    attestation
      .subarray(BADGE_WALLET_OFFSET, BADGE_WALLET_OFFSET + wallet.length)
      .toString(),
    wallet,
  );
  const credential = getCredentialEncoder().encode({
    discriminator: 1,
    authority: issuer,
    name: Buffer.from("SKILLBRIDGE-TEST"),
    authorizedSigners: [issuer],
  });
  const original = globalThis.fetch;
  const account = (data: ArrayLike<number>) => ({
    owner: options.wrongOwner ? key(1) : String(SAS),
    data: [Buffer.from(data).toString("base64"), "base64"],
  });
  globalThis.fetch = (async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    if (body.method === "getGenesisHash")
      return Response.json({
        result: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
      });
    if (body.method === "getProgramAccounts") {
      assert.equal(body.params[1].commitment, "finalized");
      assert.equal(
        body.params[1].filters[0].memcmp.bytes,
        bs58.encode(Buffer.from(wallet)),
      );
      return Response.json({
        result: [{ pubkey: key(12), account: account(attestation) }],
      });
    }
    assert.equal(body.method, "getMultipleAccounts");
    return Response.json({
      result: {
        value: body.params[0].map((k: string) =>
          account(
            k === schemaKey ? getSchemaEncoder().encode(schema) : credential,
          ),
        ),
      },
    });
  }) as typeof fetch;
  try {
    run(
      await discoverBadges(
        "https://rpc.invalid",
        wallet,
        options.trusted || [issuer],
      ),
    );
  } finally {
    globalThis.fetch = original;
  }
}
test("wallet lookup matches the actual SAS/Borsh wallet offset and verifies an active skill badge", async () => {
  await withBadges({}, (items) => {
    assert.equal(items.length, 1);
    assert.equal(items[0].status, "active");
    assert.equal(items[0].score, 85);
  });
});
test("expired, paused and untrusted credentials are not counted as active badges", async () => {
  await withBadges({ expiry: 1 }, (items) =>
    assert.equal(items[0].status, "expired"),
  );
  await withBadges({ paused: true }, (items) =>
    assert.equal(items[0].status, "paused"),
  );
  await withBadges({ trusted: [key(20)] }, (items) =>
    assert.equal(items.length, 0),
  );
  await assert.rejects(
    () => withBadges({ wrongOwner: true }, () => {}),
    /owner/,
  );
});
test("RPC failure stays an error rather than a zero result", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    Response.json(
      { error: { message: "Rate limited" } },
      { status: 429 },
    )) as typeof fetch;
  try {
    await assert.rejects(
      () => discoverRewards("https://rpc.invalid", wallet),
      /Rate limited/,
    );
    await assert.rejects(
      () => discoverBadges("https://rpc.invalid", wallet, [issuer]),
      /Rate limited/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("atomic totals keep precision above JavaScript's safe integer range", () => {
  assert.equal(formatAtomic("9007199254740993", 6), "9007199254.740993");
});

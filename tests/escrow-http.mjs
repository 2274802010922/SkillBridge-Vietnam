import assert from "node:assert/strict";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { createSignInMessage } from "@solana/wallet-standard-util";
const base = process.env.ESCROW_HTTP_ORIGIN || "http://localhost:3092";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
async function api(path, method = "GET", body, cookie) {
  return fetch(base + path, {
    method,
    headers: {
      origin: base,
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function json(response, code = 200) {
  assert.equal(response.status, code, await response.clone().text());
  return response.json();
}
async function login() {
  const k = nacl.sign.keyPair();
  const address = bs58.encode(k.publicKey);
  const { input, challengeId } = await json(
    await api("/api/auth/challenge", "POST", { address }),
  );
  const msg = createSignInMessage(input);
  const r = await api("/api/auth/verify", "POST", {
    address,
    challengeId,
    signedMessage: Buffer.from(msg).toString("base64url"),
    signature: Buffer.from(nacl.sign.detached(msg, k.secretKey)).toString(
      "base64url",
    ),
  });
  await json(r);
  return { address, cookie: r.headers.get("set-cookie").split(";")[0] };
}
const owner = await login(),
  backup = await login(),
  outsider = await login();
const { organization } = await json(
  await api(
    "/api/organizations",
    "POST",
    { name: "Escrow HTTP test", kind: "business" },
    owner.cookie,
  ),
  201,
);
const invitation = await json(
  await api(
    "/api/invitations",
    "POST",
    {
      organizationId: organization.id,
      role: "reviewer",
      targetWallet: backup.address,
    },
    owner.cookie,
  ),
  201,
);
await json(
  await api(
    "/api/invitations/accept",
    "POST",
    { token: invitation.invitation.joinUrl.split("/").pop() },
    backup.cookie,
  ),
);
const { challenge } = await json(
  await api(
    "/api/challenges",
    "POST",
    {
      organizationId: organization.id,
      reviewMode: "self",
      title: "Escrow HTTP integration test",
      brief:
        "A complete integration-test challenge with a bounded Devnet reward budget.",
      skills: ["Testing"],
      reward: "Devnet reward",
      rewardType: "sol",
      rewardAmountUsdc: "0.001",
      rewardSlots: 2,
      accessType: "public",
    },
    owner.cookie,
  ),
  201,
);
const url = "/api/challenges/" + challenge.id + "/escrow";
assert.equal((await api(url)).status, 401);
assert.equal((await api(url, "GET", null, outsider.cookie)).status, 403);
const setup = {
  action: "configure",
  reviewer: owner.address,
  backup: backup.address,
  submitDeadline: new Date(Date.now() + 3600000).toISOString(),
  reviewDeadline: new Date(Date.now() + 7200000).toISOString(),
};
await json(await api(url, "POST", setup, owner.cookie));
const detail = await json(await api(url, "GET", null, owner.cookie));
assert.equal(detail.config.slots, 2);
assert.equal(detail.state, null);
const built = await json(
  await api(
    url,
    "POST",
    { action: "initialize", senderWallet: owner.address },
    owner.cookie,
  ),
);
assert.ok(built.transaction);
assert.ok(built.operationId);
assert.equal(
  (
    await api(
      url,
      "POST",
      { action: "initialize", senderWallet: owner.address },
      backup.cookie,
    )
  ).status,
  403,
);
assert.equal(
  (
    await api(
      "/api/challenges/" + challenge.id,
      "PATCH",
      { action: "publish" },
      owner.cookie,
    )
  ).status,
  409,
);
assert.equal(
  (
    await api(
      "/api/challenges/" + challenge.id,
      "PATCH",
      { action: "update_draft" },
      owner.cookie,
    )
  ).status,
  409,
);
assert.equal(
  (
    await api(
      "/api/challenges/" + challenge.id + "/funding",
      "POST",
      {},
      owner.cookie,
    )
  ).status,
  409,
);
console.log(
  "Escrow HTTP passed: SIWS, memberships, create/configure, build unsigned deposit, reject cross-wallet, legacy bypass, database-only publish/edit. No funds transferred.",
);
console.log("Local challenge: " + challenge.id);

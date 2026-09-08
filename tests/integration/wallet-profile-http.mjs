// Run against an isolated local database/server only. Generates two unfunded wallets.
import assert from "node:assert/strict";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { createSignInMessage } from "@solana/wallet-standard-util";
const base = process.env.PROFILE_TEST_ORIGIN || "http://localhost:3091";
assert.ok(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "Local test server required",
);
async function call(path, method = "GET", body, session) {
  return fetch(base + path, {
    method,
    headers: {
      origin: base,
      "content-type": "application/json",
      ...(session ? { cookie: session } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function login() {
  const k = nacl.sign.keyPair();
  const address = bs58.encode(k.publicKey);
  const c = await call("/api/auth/challenge", "POST", { address });
  assert.equal(c.status, 200);
  const { input, challengeId } = await c.json();
  const signedMessage = createSignInMessage(input);
  const signature = nacl.sign.detached(signedMessage, k.secretKey);
  const v = await call("/api/auth/verify", "POST", {
    address,
    challengeId,
    signedMessage: Buffer.from(signedMessage).toString("base64url"),
    signature: Buffer.from(signature).toString("base64url"),
  });
  assert.equal(v.status, 200);
  return { address, cookie: v.headers.get("set-cookie").split(";")[0] };
}
const a = await login();
const b = await login();
assert.equal((await call("/api/profile")).status, 401);
assert.equal((await call("/api/profiles/" + a.address)).status, 404);
const bio =
  "Hồ sơ kiểm thử — nghiên cứu trải nghiệm người dùng và thiết kế sản phẩm.";
assert.equal(
  (
    await call(
      "/api/profile",
      "PATCH",
      {
        displayName: "Nguyễn Minh An · Hồ sơ kiểm thử",
        headline: "Thiết kế sản phẩm & nghiên cứu người dùng",
        bio,
        education: "Đại học Văn Lang · Dữ liệu kiểm thử",
        skills: ["Thiết kế giao diện", "Nghiên cứu", "Phân tích"],
        visibility: "unlisted",
      },
      a.cookie,
    )
  ).status,
  200,
);
assert.equal((await call("/api/profiles/" + a.address)).status, 200);
let directory = await (await call("/api/talent", "GET", null, b.cookie)).json();
assert.ok(!directory.profiles.some((p) => p.wallet_address === a.address));
await call(
  "/api/profile",
  "PATCH",
  { displayName: "Wallet B", bio: "B only", userId: "a", wallet: a.address },
  b.cookie,
);
assert.equal(
  (await (await call("/api/profile", "GET", null, a.cookie)).json()).profile
    .bio,
  bio,
);
await call("/api/profile", "PATCH", { visibility: "public" }, a.cookie);
directory = await (await call("/api/talent", "GET", null, b.cookie)).json();
assert.ok(directory.profiles.some((p) => p.wallet_address === a.address));
await call("/api/profile", "PATCH", { visibility: "private" }, a.cookie);
assert.equal(
  (await call("/api/profiles/" + a.address, "GET", null, b.cookie)).status,
  404,
);
assert.equal(
  (
    await call(
      "/api/profiles/" + a.address + "?preview=1",
      "GET",
      null,
      a.cookie,
    )
  ).status,
  404,
);
assert.equal(
  (await call("/api/profiles/" + a.address, "GET", null, a.cookie)).status,
  200,
);
assert.equal(
  (
    await call(
      "/api/profile",
      "PATCH",
      { website: "javascript:alert(1)" },
      a.cookie,
    )
  ).status,
  400,
);
await call("/api/profile", "PATCH", { visibility: "public" }, a.cookie);
console.log(
  "HTTP checks passed: SIWS, auth, owner isolation, private/unlisted/public, directory and visitor preview.",
);
console.log("Local public fixture: " + base + "/u/" + a.address);

import assert from "node:assert/strict";
import test from "node:test";
import { canJoinPublicChallenge, isChallengeAccessType } from "../lib/challenge-access.ts";

test("challenge access accepts only supported modes", () => {
  assert.equal(isChallengeAccessType("public"), true);
  assert.equal(isChallengeAccessType("invite_only"), true);
  assert.equal(isChallengeAccessType("private"), false);
});

test("published public challenge can be joined directly", () => {
  assert.equal(canJoinPublicChallenge({ status: "published", accessType: "public" }), true);
});

test("invite-only challenge always requires an invitation", () => {
  assert.equal(canJoinPublicChallenge({ status: "published", accessType: "invite_only" }), false);
});

test("closed or expired public challenge cannot be joined", () => {
  const now = new Date("2026-08-17T00:00:00.000Z");
  assert.equal(canJoinPublicChallenge({ status: "closed", accessType: "public" }, now), false);
  assert.equal(canJoinPublicChallenge({ status: "published", accessType: "public", closesAt: "2026-08-16T23:59:59.000Z" }, now), false);
});

import assert from "node:assert/strict";
import test from "node:test";
import { draftDeletionDecision, draftFinancialFieldsLocked } from "../lib/challenge-draft-policy.ts";

test("draft financial fields lock once a funding record exists", () => {
  assert.equal(draftFinancialFieldsLocked(null), false);
  assert.equal(draftFinancialFieldsLocked(undefined), false);
  assert.equal(draftFinancialFieldsLocked("fund_123"), true);
});

test("an unfunded draft can be deleted", () => {
  assert.deepEqual(draftDeletionDecision({ challengeStatus: "draft" }), { allowed: true });
  assert.deepEqual(draftDeletionDecision({ challengeStatus: "draft", fundStatus: "awaiting_payment", fundedAtomic: "0" }), { allowed: true });
});

test("a non-draft or actively verifying transaction cannot be deleted", () => {
  assert.deepEqual(draftDeletionDecision({ challengeStatus: "published" }), { allowed: false, code: "NOT_DRAFT" });
  assert.deepEqual(draftDeletionDecision({ challengeStatus: "draft", verificationState: "checking" }), { allowed: false, code: "TRANSACTION_PENDING" });
  assert.deepEqual(draftDeletionDecision({ challengeStatus: "draft", verificationState: "pending_finalization" }), { allowed: false, code: "TRANSACTION_PENDING" });
});

test("funded drafts require a refund and payout history prevents deletion", () => {
  assert.deepEqual(draftDeletionDecision({ challengeStatus: "draft", fundStatus: "funded", fundedAtomic: "100" }), { allowed: false, code: "REFUND_REQUIRED" });
  assert.deepEqual(draftDeletionDecision({ challengeStatus: "draft", fundStatus: "awaiting_payment", fundingTx: "signature" }), { allowed: false, code: "REFUND_REQUIRED" });
  assert.deepEqual(draftDeletionDecision({ challengeStatus: "draft", fundStatus: "refunded", fundingTx: "signature", fundedAtomic: "100" }), { allowed: true });
  assert.deepEqual(draftDeletionDecision({ challengeStatus: "draft", fundStatus: "refunded", disbursedAtomic: "1" }), { allowed: false, code: "PAYOUT_EXISTS" });
});

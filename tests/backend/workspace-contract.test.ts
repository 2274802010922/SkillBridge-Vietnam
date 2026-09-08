import assert from "node:assert/strict";
import test from "node:test";
import {
  WORKSPACE_TRANSITIONS,
  actionsFor,
  canPerform,
  type WorkspaceAction,
  type WorkspaceRole,
  type WorkspaceStage,
} from "../../shared/validation/workspace-contract.ts";

const roles: WorkspaceRole[] = ["business", "student", "university"];
const journey: Array<{ role: WorkspaceRole; action: WorkspaceAction; from: WorkspaceStage; to: WorkspaceStage }> = [
  { role: "business", action: "publish_challenge", from: "draft", to: "published" },
  { role: "business", action: "invite_student", from: "published", to: "invited" },
  { role: "student", action: "accept_challenge", from: "invited", to: "accepted" },
  { role: "student", action: "submit_evidence", from: "accepted", to: "submitted" },
  { role: "university", action: "generate_ai_draft", from: "submitted", to: "ai_drafted" },
  { role: "university", action: "approve_assessment", from: "ai_drafted", to: "approved" },
  { role: "university", action: "issue_credential", from: "approved", to: "issued" },
  { role: "business", action: "verify_unlock", from: "issued", to: "unlocked" },
  { role: "university", action: "revoke_credential", from: "unlocked", to: "revoked" },
];

for (const step of journey) {
  test(`workspace authorization: ${step.role} can ${step.action} from ${step.from}`, () => {
    assert.equal(canPerform(step.role, step.action, step.from), true);
    assert.equal(WORKSPACE_TRANSITIONS[step.action].to, step.to);
    assert.deepEqual(actionsFor(step.role, step.from), [step.action]);
  });

  for (const deniedRole of roles.filter((role) => role !== step.role)) {
    test(`workspace authorization: ${deniedRole} cannot ${step.action}`, () => {
      assert.equal(canPerform(deniedRole, step.action, step.from), false);
      assert.doesNotMatch(actionsFor(deniedRole, step.from).join(","), new RegExp(step.action));
    });
  }
}

test("workspace lifecycle reaches revoked without skipping a state", () => {
  let stage: WorkspaceStage = "draft";
  for (const step of journey) {
    assert.equal(stage, step.from);
    stage = WORKSPACE_TRANSITIONS[step.action].to;
  }
  assert.equal(stage, "revoked");
});

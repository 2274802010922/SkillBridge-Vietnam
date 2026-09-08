export type WorkspaceRole = "business" | "student" | "university";

export type WorkspaceStage =
  | "draft"
  | "published"
  | "invited"
  | "accepted"
  | "submitted"
  | "ai_drafted"
  | "approved"
  | "issued"
  | "unlocked"
  | "revoked";

export type WorkspaceAction =
  | "publish_challenge"
  | "invite_student"
  | "accept_challenge"
  | "submit_evidence"
  | "generate_ai_draft"
  | "approve_assessment"
  | "issue_credential"
  | "verify_unlock"
  | "revoke_credential";

export const WORKSPACE_TRANSITIONS: Record<
  WorkspaceAction,
  {
    role: WorkspaceRole;
    from: WorkspaceStage[];
    to: WorkspaceStage;
    label: string;
    detail: string;
  }
> = {
  publish_challenge: {
    role: "business",
    from: ["draft"],
    to: "published",
    label: "Challenge published",
    detail: "GreenThread Vietnam · Growth Strategy 90D",
  },
  invite_student: {
    role: "business",
    from: ["published"],
    to: "invited",
    label: "Student invited",
    detail: "VLU candidate · invitation SB-INV-001",
  },
  accept_challenge: {
    role: "student",
    from: ["invited"],
    to: "accepted",
    label: "Challenge accepted",
    detail: "Candidate committed to the 8-hour sprint",
  },
  submit_evidence: {
    role: "student",
    from: ["accepted"],
    to: "submitted",
    label: "Evidence submitted",
    detail: "Strategy deck + reflection · four immutable evidence sources",
  },
  generate_ai_draft: {
    role: "university",
    from: ["submitted"],
    to: "ai_drafted",
    label: "Assessment contract passed",
    detail: "Rubric, citation and grounding validation completed",
  },
  approve_assessment: {
    role: "university",
    from: ["ai_drafted"],
    to: "approved",
    label: "Human review approved",
    detail: "Reviewer accepted the evidence-linked result",
  },
  issue_credential: {
    role: "university",
    from: ["approved"],
    to: "issued",
    label: "Credential issued",
    detail: "Proof of Skill PS-VLU-2026-001 became active",
  },
  verify_unlock: {
    role: "business",
    from: ["issued"],
    to: "unlocked",
    label: "Opportunity unlocked",
    detail: "Active credential and score threshold verified",
  },
  revoke_credential: {
    role: "university",
    from: ["issued", "unlocked"],
    to: "revoked",
    label: "Credential revoked",
    detail: "Credential utility and opportunity access removed",
  },
};

export function canPerform(
  role: WorkspaceRole,
  action: WorkspaceAction,
  stage: WorkspaceStage,
) {
  const transition = WORKSPACE_TRANSITIONS[action];
  return transition.role === role && transition.from.includes(stage);
}

export function actionsFor(role: WorkspaceRole, stage: WorkspaceStage) {
  return (Object.entries(WORKSPACE_TRANSITIONS) as Array<
    [WorkspaceAction, (typeof WORKSPACE_TRANSITIONS)[WorkspaceAction]]
  >)
    .filter(([, transition]) => transition.role === role && transition.from.includes(stage))
    .map(([action]) => action);
}

import type { AssessmentDraft } from "./assessment-contract";

export type ManualRubricDefinition = {
  id: string;
  label: string;
  maxScore: number;
};

export type ManualRubricInput = {
  id?: string;
  score?: number;
  rationale?: string;
};

export function parseManualRubric(value: unknown): ManualRubricDefinition[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 30) return null;
  const definitions = value.map((item) => {
    const candidate = item as Partial<ManualRubricDefinition>;
    return {
      id: typeof candidate.id === "string" ? candidate.id.trim() : "",
      label: typeof candidate.label === "string" ? candidate.label.trim() : "",
      maxScore: Number(candidate.maxScore),
    };
  });
  if (definitions.some((item) => !item.id || !item.label || !Number.isFinite(item.maxScore) || item.maxScore <= 0)) return null;
  if (new Set(definitions.map((item) => item.id)).size !== definitions.length) return null;
  return definitions;
}

export function buildManualDraft(
  definitions: ManualRubricDefinition[],
  input?: { rubric?: ManualRubricInput[]; summary?: string },
): AssessmentDraft {
  const supplied = new Map((input?.rubric ?? []).map((item) => [item.id ?? "", item]));
  const rubric = definitions.map((definition) => {
    const item = supplied.get(definition.id);
    const score = Number(item?.score ?? 0);
    return {
      id: definition.id,
      label: definition.label,
      maxScore: definition.maxScore,
      score: Number.isFinite(score) ? Math.max(0, Math.min(definition.maxScore, score)) : 0,
      rationale: typeof item?.rationale === "string" ? item.rationale.trim() : "",
      citations: [],
    };
  });
  return {
    schemaVersion: "skillbridge.assessment.v1",
    rubric,
    totalScore: rubric.reduce((sum, item) => sum + item.score, 0),
    confidence: 1,
    summary: typeof input?.summary === "string" ? input.summary.trim() : "",
    strengths: [],
    reviewerFlags: [],
    grounding: { citationCoverage: 0, unsupportedClaims: [] },
    risk: { promptInjectionDetected: false, insufficientEvidence: false },
  };
}

export function validateManualDraft(
  draft: AssessmentDraft,
  definitions: ManualRubricDefinition[],
  requireRationales: boolean,
) {
  const errors: string[] = [];
  if (draft.schemaVersion !== "skillbridge.assessment.v1") errors.push("Unsupported assessment schema version.");
  if (!Array.isArray(draft.rubric) || draft.rubric.length !== definitions.length) {
    errors.push("Manual assessment must contain every rubric item exactly once.");
    return { valid: false, errors };
  }
  const byId = new Map(draft.rubric.map((item) => [item.id, item]));
  let total = 0;
  for (const definition of definitions) {
    const item = byId.get(definition.id);
    if (!item) {
      errors.push(`Missing rubric item: ${definition.id}.`);
      continue;
    }
    if (item.label !== definition.label || item.maxScore !== definition.maxScore) errors.push(`Rubric definition changed: ${definition.id}.`);
    if (!Number.isFinite(item.score) || item.score < 0 || item.score > definition.maxScore) errors.push(`Score out of range: ${definition.id}.`);
    else total += item.score;
    if (requireRationales && !item.rationale?.trim()) errors.push(`Missing rationale: ${definition.id}.`);
  }
  if (new Set(draft.rubric.map((item) => item.id)).size !== definitions.length) errors.push("Duplicate rubric item.");
  if (draft.totalScore !== total) errors.push("Total score does not equal rubric sum.");
  if (requireRationales && !draft.summary.trim()) errors.push("Assessment summary is required.");
  return { valid: errors.length === 0, errors };
}

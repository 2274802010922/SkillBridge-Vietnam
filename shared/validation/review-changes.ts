import type { AssessmentDraft } from "./assessment-contract.ts";
export function scoreChanges(ai: AssessmentDraft, final: AssessmentDraft) {
  return final.rubric.flatMap((item) => {
    const original = ai.rubric.find((r) => r.id === item.id);
    return original && original.score !== item.score
      ? [
          {
            id: item.id,
            label: item.label,
            aiScore: original.score,
            officialScore: item.score,
          },
        ]
      : [];
  });
}

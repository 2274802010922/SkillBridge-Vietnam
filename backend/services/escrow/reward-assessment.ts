import { hashBytes } from "../../../solana/client/challenge-escrow.ts";

/** Only a human's persisted final draft and the signed terms define eligibility. */
export async function rewardEligibility(input: {
  assessment_status: string | null; final_result_hash: string | null;
  review_json: string | null; termsText: string;
}): Promise<boolean | null> {
  if (input.assessment_status === "rejected") return false;
  if (input.assessment_status !== "approved" || !input.final_result_hash || !input.review_json) return null;
  try {
    const terms = JSON.parse(input.termsText) as { minimumScore?: string | number };
    const review = JSON.parse(input.review_json) as { finalDraft?: { totalScore: number } };
    const min = Number(terms.minimumScore), draft = review.finalDraft;
    if (terms.minimumScore === undefined || !Number.isFinite(min) || min < 0 || min > 100 || !draft || !Number.isFinite(draft.totalScore)) return null;
    if ((await hashBytes(JSON.stringify(draft))).toString("hex") !== input.final_result_hash) return null;
    return draft.totalScore >= min;
  } catch { return null; }
}

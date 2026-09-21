export type RewardConfig = { funder: string; reviewer: string; backup: string; amount: string; slots: number; submitDeadline: number; reviewDeadline: number };
export type FundState = { state: number; accepted: number; funded: string; allocated: string; paid: string; refunded: string; submissions: number; resolved: number };
export type RewardReceipt = { decision: number; paid: boolean };
export type RewardAction = "record_result" | "allocate_award" | "claim_award";
export type RewardProgress = {
  phase: string; action: RewardAction | null; actor: string | null;
  reason: { vi: string; en: string }; available: boolean;
};
export function rewardProgress(config: RewardConfig, state: FundState | null, receipt: RewardReceipt | null,
  assessment: string | null, eligible: boolean | null, student: string, wallet: string, now: number): RewardProgress {
  const reviewer = now > config.reviewDeadline ? config.backup : config.reviewer;
  const result = (phase: string, vi: string, en: string, action: RewardAction | null = null, actor: string | null = null): RewardProgress =>
    ({ phase, reason: { vi, en }, action, actor, available: Boolean(action && actor === wallet) });
  if (!state) return result("unknown", "Chưa đọc được quỹ. Kiểm tra lại trước khi tiếp tục.", "Fund not available. Refresh before continuing.");
  if (receipt?.paid) return result("paid", "Sinh viên đã nhận thưởng.", "Reward received.");
  if (receipt?.decision === 3 && [1, 2].includes(state.state))
    return result("allocated", "Phần thưởng đã được dành riêng. Sinh viên ký nhận thưởng.", "Reward reserved. The student can claim.", "claim_award", student);
  if (state.state === 3) return result("cancelled", "Quỹ đã hủy hoặc hoàn trước công bố.", "Fund cancelled or refunded before publication.");
  if (BigInt(state.funded) < BigInt(config.amount) * BigInt(config.slots)) return result("unfunded", "Quỹ chưa đủ ngân sách đã cam kết.", "The committed budget is not funded.");
  if (state.state === 0) return result("draft", "Cả hai reviewer cần nhận nhiệm vụ, sau đó doanh nghiệp công bố.", "Both reviewers must accept, then the business publishes.");
  if (state.state === 2) return result("closed", "Kết quả đã chốt; không thể phân bổ suất mới.", "Results finalized; no new awards can be allocated.");
  if (!receipt) return result("unregistered", "Chưa có bài nộp đã ký trên chuỗi. Kiểm tra bước xác nhận nộp bài.", "No signed submission on chain. Check submission registration.");
  if (receipt.decision === 2) return result("rejected", "Kết quả trên chuỗi: không đủ điều kiện nhận thưởng.", "On-chain result: not eligible.");
  if (now <= config.submitDeadline) return result("submission_open", "Chưa hết hạn nộp. Kết quả trên chuỗi chỉ ghi sau hạn nộp.", "Submissions are open. On-chain review starts after the deadline.");
  if (!["approved", "rejected"].includes(assessment || "")) return result("review_needed", "Cần chấm và phê duyệt hoặc từ chối bản đánh giá trước.", "Complete the official assessment first.");
  if (eligible === null) return result("reconciliation", "Chưa xác minh được điểm hoặc điều khoản đã cam kết; cần đối soát.", "The official score or committed terms need reconciliation.");
  if (receipt.decision === 0)
    return result("record_needed", eligible ? "Đã chấm đạt. Reviewer có quyền cần ký ghi kết quả." : "Bài không đạt điều kiện thưởng. Reviewer ký ghi kết quả không đạt.",
      eligible ? "Assessment passed. The active reviewer must record the result." : "Not eligible for a reward. The active reviewer must record that result.", "record_result", reviewer);
  if (!eligible) return result("reconciliation", "Kết quả trên chuỗi và đánh giá chính thức không khớp; cần đối soát.", "The on-chain result conflicts with the official assessment.");
  if (BigInt(state.allocated) + BigInt(config.amount) > BigInt(config.amount) * BigInt(config.slots))
    return result("no_slots", "Đã phân bổ hết suất thưởng.", "All award slots have been allocated.");
  return result("eligible", "Đã ghi kết quả đạt. Reviewer chọn người nhận trong các suất còn lại.", "Eligible result recorded. The reviewer can allocate an available award.", "allocate_award", reviewer);
}

export function operationSatisfied(action: string, config: RewardConfig, state: FundState | null,
  receipt?: RewardReceipt | null, actor?: string): boolean {
  if (!state) return false;
  switch (action) {
    case "initialize": return BigInt(state.funded) === BigInt(config.amount) * BigInt(config.slots);
    case "accept_role": return actor === config.reviewer ? Boolean(state.accepted & 1) : actor === config.backup && Boolean(state.accepted & 2);
    case "publish": return state.state === 1 || state.state === 2;
    case "register_submission": return Boolean(receipt);
    case "record_result": return Boolean(receipt && receipt.decision !== 0);
    case "allocate_award": return receipt?.decision === 3;
    case "claim_award": return receipt?.paid === true;
    case "finalize_results": return state.state === 2;
    case "cancel_empty": return state.state === 3;
    case "refund_unused": return BigInt(state.refunded) > BigInt(0);
    default: return false;
  }
}

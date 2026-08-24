import bs58 from "bs58";
import { env } from "@/lib/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../../../lib/auth";
import { requireChallengeManager } from "../../../../../lib/authorization";
import { auditStatement } from "../../../../../lib/audit";
import { formatSolAtomic, formatUsdcAtomic, parseSolAmount } from "../../../../../lib/payments";
import { rewardVaultAddress, solanaPayRewardUrl, type RewardAsset } from "../../../../../lib/reward-vault";

type ChallengeFundingRow = {
  id: string;
  organization_id: string;
  status: string;
  deleted_at: string | null;
  reward_type: string | null;
  reward_asset: string | null;
  reward_amount_usdc: string | null;
  reward_amount_atomic: string | null;
  reward_slots: number | null;
  funding_status: string | null;
  fund_id: string | null;
  asset: string | null;
  required_display: string | null;
  required_atomic: string | null;
  funded_atomic: string | null;
  disbursed_atomic: string | null;
  refunded_atomic: string | null;
  vault_wallet: string | null;
  reference_key: string | null;
  fund_status: string | null;
  funding_tx: string | null;
  submitted_tx: string | null;
  verification_state: string | null;
  last_verification_error_code: string | null;
  verification_checked_at: string | null;
  terms_version: string | null;
  terms_hash: string | null;
  terms_signature: string | null;
  terms_signer_wallet: string | null;
  terms_accepted_at: string | null;
  locked_at: string | null;
  refund_policy_state: string | null;
};

async function fundingRow(challengeId: string) {
  return env.DB.prepare(`
    SELECT c.id, c.organization_id, c.status, c.deleted_at, c.reward_type, c.reward_asset, c.reward_amount_usdc,
      c.reward_amount_atomic, c.reward_slots, c.funding_status,
      f.id AS fund_id, f.asset, f.required_display, f.required_atomic, f.funded_atomic,
      f.disbursed_atomic, f.refunded_atomic, f.vault_wallet, f.reference_key,
      f.status AS fund_status, f.funding_tx, f.submitted_tx, f.verification_state,
      f.last_verification_error_code, f.verification_checked_at, f.terms_version,
      f.terms_hash, f.terms_signature, f.terms_signer_wallet, f.terms_accepted_at,
      f.locked_at, f.refund_policy_state
    FROM challenges c
    LEFT JOIN challenge_funds f ON f.challenge_id = c.id
    WHERE c.id = ?
  `).bind(challengeId).first<ChallengeFundingRow>();
}

function serializeFunding(row: ChallengeFundingRow) {
  if (!row.fund_id || !row.asset || !row.required_display || !row.required_atomic || !row.vault_wallet || !row.reference_key || !row.fund_status) return null;
  const asset = row.asset as RewardAsset;
  return {
    id: row.fund_id,
    asset,
    requiredDisplay: row.required_display,
    requiredAtomic: row.required_atomic,
    fundedAtomic: row.funded_atomic ?? "0",
    disbursedAtomic: row.disbursed_atomic ?? "0",
    refundedAtomic: row.refunded_atomic ?? "0",
    status: row.fund_status,
    vaultWallet: row.vault_wallet,
    reference: row.reference_key,
    fundingTx: row.funding_tx,
    submittedTx: row.submitted_tx,
    verificationState: row.verification_state ?? "awaiting_signature",
    lastVerificationErrorCode: row.last_verification_error_code,
    verificationCheckedAt: row.verification_checked_at,
    termsVersion: row.terms_version,
    termsHash: row.terms_hash,
    termsSignature: row.terms_signature,
    termsSignerWallet: row.terms_signer_wallet,
    termsAcceptedAt: row.terms_accepted_at,
    lockedAt: row.locked_at,
    refundPolicyState: row.refund_policy_state ?? "pre_publish",
    solanaPayUrl: solanaPayRewardUrl({ recipientWallet: row.vault_wallet, amount: row.required_display, asset, reference: row.reference_key, mint: env.SOLANA_USDC_MINT }),
  };
}

function randomReference() {
  return bs58.encode(crypto.getRandomValues(new Uint8Array(32)));
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser(request);
    const { id } = await params;
    await requireChallengeManager(user.id, id);
    const row = await fundingRow(id);
    if (!row) return Response.json({ error: "Challenge không tồn tại." }, { status: 404 });
    return Response.json({ funding: serializeFunding(row) }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}

/** Prepare one tracked Devnet reward-vault funding request for a draft challenge. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const { id } = await params;
    const challenge = await requireChallengeManager(user.id, id);
    const current = await fundingRow(id);
    if (!current) return Response.json({ error: "Challenge không tồn tại." }, { status: 404 });
    if (current.deleted_at || current.status !== "draft") return Response.json({ error: "Chỉ bản nháp đang hoạt động mới có thể chuẩn bị quỹ." }, { status: 409 });
    if (current.fund_id) return Response.json({ funding: serializeFunding(current), reused: true });

    const rewardType = current.reward_type === "sol" ? "sol" : current.reward_type === "usdc" ? "usdc" : "badge";
    const rewardSlots = Math.max(1, Number(current.reward_slots ?? 1));
    let asset: RewardAsset;
    let requiredAtomic: string;
    let requiredDisplay: string;
    if (rewardType === "badge") {
      const bond = parseSolAmount(env.CHALLENGE_BADGE_BOND_SOL || "0.05");
      if (!bond) throw new Error("CHALLENGE_BADGE_BOND_SOL không hợp lệ.");
      asset = "sol";
      requiredAtomic = bond.atomic;
      requiredDisplay = bond.display;
    } else {
      if (!current.reward_amount_usdc || !current.reward_amount_atomic) return Response.json({ error: "Challenge chưa có số tiền thưởng hợp lệ." }, { status: 409 });
      asset = rewardType;
      const totalAtomic = BigInt(current.reward_amount_atomic) * BigInt(rewardSlots);
      requiredAtomic = totalAtomic.toString();
      requiredDisplay = asset === "sol" ? formatSolAtomic(requiredAtomic) : formatUsdcAtomic(requiredAtomic);
    }
    const vaultWallet = await rewardVaultAddress(env);
    const fundId = crypto.randomUUID();
    const reference = randomReference();
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO challenge_funds
          (id, challenge_id, asset, required_display, required_atomic, vault_wallet, reference_key, created_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(fundId, id, asset, requiredDisplay, requiredAtomic, vaultWallet, reference, user.id),
      env.DB.prepare(`
        UPDATE challenges SET reward_asset = ?, funding_status = 'awaiting_funding',
          funding_asset = ?, funding_amount_display = ?, funding_amount_atomic = ?,
          funding_vault_wallet = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).bind(asset, asset, requiredDisplay, requiredAtomic, vaultWallet, id),
      auditStatement(env.DB, {
        actorUserId: user.id, organizationId: challenge.organization_id, action: "challenge.funding_prepared",
        targetType: "challenge", targetId: id,
        metadata: { fundId, asset, requiredDisplay, rewardSlots, vaultWallet },
      }),
    ]);
    const row = await fundingRow(id);
    return Response.json({ funding: row ? serializeFunding(row) : null }, { status: 201 });
  } catch (error) { return jsonError(error); }
}

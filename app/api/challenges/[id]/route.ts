import { env } from "@/lib/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../../lib/auth";
import { requireChallengeManager } from "../../../../lib/authorization";
import { auditStatement, writeAuditEvent } from "../../../../lib/audit";
import { isChallengeAccessType, type ChallengeAccessType } from "../../../../lib/challenge-access";
import { normalizeChallengeContent, type ChallengeContent } from "../../../../lib/challenge-content";
import { draftDeletionDecision, draftFinancialFieldsLocked } from "../../../../lib/challenge-draft-policy";
import { parseSolAmount, parseUsdcAmount } from "../../../../lib/payments";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const row = await env.DB.prepare(`
      SELECT c.*, o.name AS organization_name,
        reviewer.name AS reviewer_organization_name, reviewer.kind AS reviewer_organization_kind,
        CASE WHEN c.reviewer_organization_id IS NULL OR c.organization_id = c.reviewer_organization_id THEN 'self' ELSE 'independent' END AS review_mode,
        f.status AS fund_status, f.asset AS fund_asset, f.required_display AS fund_required_display,
        f.funded_atomic AS fund_funded_atomic, f.vault_wallet AS fund_vault_wallet,
        f.funding_tx AS fund_funding_tx, f.terms_version AS fund_terms_version,
        f.terms_hash AS fund_terms_hash, f.terms_signature AS fund_terms_signature,
        f.locked_at AS fund_locked_at, f.refund_policy_state AS fund_refund_policy_state
      FROM challenges c JOIN organizations o ON o.id = c.organization_id
      LEFT JOIN organizations reviewer ON reviewer.id = c.reviewer_organization_id
      LEFT JOIN challenge_funds f ON f.challenge_id = c.id
      WHERE c.id = ? AND c.deleted_at IS NULL
    `).bind(id).first<Record<string, unknown>>();
    if (!row) return Response.json({ error: "Challenge không tồn tại." }, { status: 404 });
    if (row.status !== "published") {
      const user = await requireSessionUser(request);
      await requireChallengeManager(user.id, id);
    }
    return Response.json({ challenge: row }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return jsonError(error); }
}

type ChallengeMutation = {
  action?: "publish" | "close" | "set_access" | "update_draft";
  accessType?: ChallengeAccessType;
  reviewerOrganizationId?: string;
  reviewMode?: "self" | "independent";
  title?: string;
  brief?: string;
  content?: Partial<ChallengeContent>;
  skills?: string[];
  reward?: string;
  rewardType?: "usdc" | "sol" | "badge";
  rewardAmountUsdc?: string;
  badgeName?: string;
  badgeDescription?: string;
  rewardSlots?: number;
  minimumScore?: string;
  closesAt?: string | null;
};

type ChallengeConfig = {
  organization_id: string;
  status: string;
  deleted_at: string | null;
  reward_type: string;
  reward_amount_atomic: string | null;
  reward_metadata_json: string;
  reward_slots: number;
  funding_status: string;
  fund_id: string | null;
  fund_status: string | null;
  funded_atomic: string | null;
  disbursed_atomic: string | null;
  funding_tx: string | null;
  verification_state: string | null;
  terms_hash: string | null;
  terms_signature: string | null;
  terms_signer_wallet: string | null;
  locked_at: string | null;
};

async function loadChallengeConfig(id: string) {
  return env.DB.prepare(`
    SELECT c.organization_id, c.status, c.deleted_at, c.reward_type, c.reward_amount_atomic,
      c.reward_metadata_json, c.reward_slots, c.funding_status,
      f.id AS fund_id, f.status AS fund_status, f.funded_atomic, f.disbursed_atomic,
      f.funding_tx, f.verification_state, f.terms_hash,
      f.terms_signature, f.terms_signer_wallet, f.locked_at
    FROM challenges c LEFT JOIN challenge_funds f ON f.challenge_id = c.id WHERE c.id = ?
  `).bind(id).first<ChallengeConfig>();
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const { id } = await params;
    const challenge = await requireChallengeManager(user.id, id);
    const challengeConfig = await loadChallengeConfig(id);
    if (!challengeConfig || challengeConfig.deleted_at) return Response.json({ error: "Challenge không tồn tại." }, { status: 404 });
    const body = (await request.json()) as ChallengeMutation;
    if (await env.DB.prepare("SELECT challenge_id FROM challenge_escrows WHERE challenge_id=?").bind(id).first()) return Response.json({error:"Điều khoản đã gắn với quỹ on-chain. Công bố, chốt và hoàn quỹ trong mục Quỹ thưởng.",code:"ESCROW_LOCKED"},{status:409});

    if (body.action === "update_draft") {
      if (challengeConfig.status !== "draft") return Response.json({ error: "Chỉ bản nháp mới có thể chỉnh sửa." }, { status: 409 });
      const reviewMode = body.reviewMode === "self" ? "self" : "independent";
      const reviewerOrganizationId = reviewMode === "self" ? challenge.organization_id : body.reviewerOrganizationId;
      if (!reviewerOrganizationId) return Response.json({ error: "Chọn một đơn vị chịu trách nhiệm đánh giá." }, { status: 400 });
      if (reviewMode === "independent" && reviewerOrganizationId === challenge.organization_id) return Response.json({ error: "Đánh giá độc lập phải do một tổ chức khác thực hiện." }, { status: 400 });
      const reviewer = await env.DB.prepare("SELECT id FROM organizations WHERE id = ? AND kind IN ('business', 'university')").bind(reviewerOrganizationId).first();
      if (!reviewer) return Response.json({ error: "Đơn vị đánh giá không hợp lệ." }, { status: 400 });

      const title = body.title?.trim() ?? "";
      const content = normalizeChallengeContent(body.content, body.brief);
      const brief = content.summary;
      const reward = body.reward?.trim() ?? "";
      const rewardType = body.rewardType;
      const accessType = body.accessType;
      const skills = (body.skills ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 8);
      if (!isChallengeAccessType(accessType)) return Response.json({ error: "Chế độ tham gia không hợp lệ." }, { status: 400 });
      if (rewardType !== "usdc" && rewardType !== "sol" && rewardType !== "badge") return Response.json({ error: "Chọn USDC, SOL Devnet hoặc huy hiệu." }, { status: 400 });
      const rewardAmount = rewardType === "usdc" && body.rewardAmountUsdc?.trim()
        ? parseUsdcAmount(body.rewardAmountUsdc)
        : rewardType === "sol" && body.rewardAmountUsdc?.trim()
          ? parseSolAmount(body.rewardAmountUsdc)
          : null;
      if ((rewardType === "usdc" || rewardType === "sol") && !rewardAmount) return Response.json({ error: "Số tiền thưởng không hợp lệ." }, { status: 400 });
      if (rewardType === "badge" && !body.badgeName?.trim()) return Response.json({ error: "Challenge huy hiệu cần tên huy hiệu." }, { status: 400 });
      const rewardSlots = Math.max(1, Math.min(100, Math.floor(Number(body.rewardSlots ?? 1)) || 1));
      const minimumScore = body.minimumScore?.trim() || "0";
      const minimumScoreNumber = Number(minimumScore);
      if (!Number.isFinite(minimumScoreNumber) || minimumScoreNumber < 0 || minimumScoreNumber > 100) return Response.json({ error: "Điểm tối thiểu phải từ 0 đến 100." }, { status: 400 });
      if (title.length < 5 || title.length > 140 || brief.length < 40 || reward.length < 3 || skills.length < 1) return Response.json({ error: "Challenge cần tên, tóm tắt tối thiểu 40 ký tự, ít nhất một kỹ năng và kết quả mong đợi." }, { status: 400 });

      const financialLocked = draftFinancialFieldsLocked(challengeConfig.fund_id);
      if (financialLocked) {
        const amountChanged = (rewardType === "usdc" || rewardType === "sol") && rewardAmount?.atomic !== challengeConfig.reward_amount_atomic;
        let badgeChanged = false;
        if (rewardType === "badge") {
          try { badgeChanged = (JSON.parse(challengeConfig.reward_metadata_json) as { name?: string }).name !== body.badgeName?.trim(); }
          catch { badgeChanged = true; }
        }
        if (rewardType !== challengeConfig.reward_type || rewardSlots !== Number(challengeConfig.reward_slots) || amountChanged || badgeChanged) {
          return Response.json({ error: "Thông tin phần thưởng đã bị khóa sau khi chuẩn bị quỹ. Bạn vẫn có thể sửa nội dung challenge.", code: "FUNDING_LOCKED" }, { status: 409 });
        }
      }

      const rewardMetadata = rewardType === "badge" ? { name: body.badgeName!.trim().slice(0, 120), description: body.badgeDescription?.trim().slice(0, 500) ?? "" } : {};
      const statements = [financialLocked
        ? env.DB.prepare(`
            UPDATE challenges SET reviewer_organization_id = ?, title = ?, brief = ?, content_json = ?,
              skills_json = ?, reward = ?, minimum_score = ?, access_type = ?, closes_at = ?,
              version = CAST(CAST(version AS INTEGER) + 1 AS TEXT), updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'draft' AND deleted_at IS NULL
          `).bind(reviewerOrganizationId, title, brief, JSON.stringify(content), JSON.stringify(skills), reward, minimumScore, accessType, body.closesAt || null, id)
        : env.DB.prepare(`
            UPDATE challenges SET reviewer_organization_id = ?, title = ?, brief = ?, content_json = ?,
              skills_json = ?, reward = ?, reward_type = ?, reward_asset = ?, reward_metadata_json = ?,
              reward_slots = ?, minimum_score = ?, reward_amount_usdc = ?, reward_amount_atomic = ?,
              reward_mint = ?, access_type = ?, closes_at = ?,
              version = CAST(CAST(version AS INTEGER) + 1 AS TEXT), updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'draft' AND deleted_at IS NULL
          `).bind(reviewerOrganizationId, title, brief, JSON.stringify(content), JSON.stringify(skills), reward, rewardType, rewardType === "badge" ? null : rewardType, JSON.stringify(rewardMetadata), rewardSlots, minimumScore, rewardAmount?.display ?? null, rewardAmount?.atomic ?? null, rewardType === "usdc" ? env.SOLANA_USDC_MINT : null, accessType, body.closesAt || null, id),
        auditStatement(env.DB, { actorUserId: user.id, organizationId: challenge.organization_id, action: "challenge.draft_updated", targetType: "challenge", targetId: id, metadata: { reviewMode, reviewerOrganizationId, accessType, financialLocked } }),
      ];
      const termsInvalidated = Boolean(challengeConfig.fund_id && challengeConfig.terms_signature);
      if (termsInvalidated) {
        statements.push(
          env.DB.prepare(`UPDATE challenge_funds SET terms_version = NULL, terms_hash = NULL, terms_signature = NULL,
            terms_signer_wallet = NULL, terms_accepted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(challengeConfig.fund_id),
          auditStatement(env.DB, { actorUserId: user.id, organizationId: challenge.organization_id, action: "challenge.terms_invalidated", targetType: "challenge", targetId: id }),
        );
      }
      await env.DB.batch(statements);
      return Response.json({ ok: true, financialLocked, termsInvalidated });
    }

    if (body.action === "publish") {
      const rewardType = String(challengeConfig.reward_type ?? (challengeConfig.reward_amount_atomic ? "usdc" : "badge"));
      if ((rewardType === "usdc" || rewardType === "sol") && !challengeConfig.reward_amount_atomic) return Response.json({ error: `Challenge ${rewardType === "sol" ? "SOL" : "USDC"} cần số tiền thưởng trước khi công bố.` }, { status: 400 });
      if (rewardType === "badge") {
        try {
          const metadata = JSON.parse(String(challengeConfig.reward_metadata_json ?? "{}")) as { name?: string };
          if (!metadata.name?.trim()) return Response.json({ error: "Challenge huy hiệu cần tên huy hiệu trước khi công bố." }, { status: 400 });
        } catch { return Response.json({ error: "Cấu hình huy hiệu không hợp lệ." }, { status: 400 }); }
      }
      if (challengeConfig.funding_status !== "funded" || challengeConfig.fund_status !== "funded") return Response.json({ error: "Hãy nạp và xác minh quỹ thưởng Devnet trước khi công bố challenge." }, { status: 409 });
      if (!challengeConfig.fund_id || !challengeConfig.terms_hash || !challengeConfig.terms_signature || challengeConfig.terms_signer_wallet !== user.walletAddress) return Response.json({ error: "Hãy đọc và ký xác nhận điều khoản quỹ thưởng bằng đúng ví đã nạp quỹ trước khi công bố." }, { status: 409 });
      if (challengeConfig.locked_at) return Response.json({ error: "Quỹ challenge đã được khóa trước đó." }, { status: 409 });
      const [challengeUpdate, fundLock] = await env.DB.batch([
        env.DB.prepare(`UPDATE challenges SET status = 'published', published_at = CURRENT_TIMESTAMP,
          version = CAST(CAST(version AS INTEGER) + 1 AS TEXT), updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status = 'draft' AND deleted_at IS NULL`).bind(id),
        env.DB.prepare("UPDATE challenge_funds SET locked_at = CURRENT_TIMESTAMP, refund_policy_state = 'locked', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'funded' AND terms_signature = ? AND locked_at IS NULL").bind(challengeConfig.fund_id, challengeConfig.terms_signature),
      ]);
      if (!challengeUpdate.meta.changes) return Response.json({ error: "Chỉ challenge draft mới có thể publish." }, { status: 409 });
      if (!fundLock.meta.changes) return Response.json({ error: "Không thể khóa quỹ: điều khoản hoặc trạng thái quỹ đã thay đổi. Vui lòng tải lại và ký lại nếu cần." }, { status: 409 });
    } else if (body.action === "close") {
      await env.DB.prepare("UPDATE challenges SET status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'published' AND deleted_at IS NULL").bind(id).run();
    } else if (body.action === "set_access") {
      if (!isChallengeAccessType(body.accessType)) return Response.json({ error: "Chế độ tham gia không hợp lệ." }, { status: 400 });
      const result = await env.DB.prepare(`UPDATE challenges SET access_type = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status IN ('draft', 'published') AND deleted_at IS NULL`).bind(body.accessType, id).run();
      if (!result.meta.changes) return Response.json({ error: "Không thể đổi chế độ của challenge đã đóng." }, { status: 409 });
    } else return Response.json({ error: "Action không hợp lệ." }, { status: 400 });
    await writeAuditEvent(env.DB,{actorUserId:user.id,organizationId:challenge.organization_id,action:`challenge.${body.action}`,targetType:"challenge",targetId:id,metadata:body.action === "set_access" ? { accessType: body.accessType } : undefined});
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const { id } = await params;
    const challenge = await requireChallengeManager(user.id, id);
    const config = await loadChallengeConfig(id);
    if (!config) return Response.json({ error: "Challenge không tồn tại." }, { status: 404 });
    if (config.deleted_at) return Response.json({ ok: true, alreadyDeleted: true });
    if (await env.DB.prepare("SELECT challenge_id FROM challenge_escrows WHERE challenge_id=?").bind(id).first()) return Response.json({error:"Giữ lại thử thách có hồ sơ quỹ on-chain để đối soát. Hãy hủy hoặc chốt quỹ thay vì xóa."},{status:409});
    const decision = draftDeletionDecision({ challengeStatus: config.status, fundStatus: config.fund_status, fundingTx: config.funding_tx, verificationState: config.verification_state, fundedAtomic: config.funded_atomic, disbursedAtomic: config.disbursed_atomic });
    if (!decision.allowed) {
      const messages = {
        NOT_DRAFT: "Chỉ bản nháp mới có thể xóa. Challenge đã công bố cần được đóng thay vì xóa.",
        TRANSACTION_PENDING: "Không thể xóa khi giao dịch nạp quỹ đang được xác minh.",
        PAYOUT_EXISTS: "Không thể xóa challenge đã có phần thưởng được giải ngân.",
        REFUND_REQUIRED: "Hãy hoàn toàn bộ quỹ thưởng trước khi xóa bản nháp.",
      } as const;
      return Response.json({ error: messages[decision.code], code: decision.code }, { status: 409 });
    }
    const result = await env.DB.batch([
      env.DB.prepare(`UPDATE challenges SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP,
        deleted_by_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'draft' AND deleted_at IS NULL`).bind(user.id, id),
      env.DB.prepare("UPDATE challenge_invitations SET status = 'cancelled' WHERE challenge_id = ? AND status = 'active'").bind(id),
      auditStatement(env.DB, { actorUserId: user.id, organizationId: challenge.organization_id, action: "challenge.draft_deleted", targetType: "challenge", targetId: id, metadata: { fundStatus: config.fund_status, verificationState: config.verification_state } }),
    ]);
    if (!result[0].meta.changes) return Response.json({ error: "Bản nháp đã thay đổi trạng thái. Hãy tải lại trang." }, { status: 409 });
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error); }
}

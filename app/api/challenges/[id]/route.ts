import { env } from "@/lib/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../../lib/auth";
import { requireChallengeManager } from "../../../../lib/authorization";
import { writeAuditEvent } from "../../../../lib/audit";
import { isChallengeAccessType, type ChallengeAccessType } from "../../../../lib/challenge-access";

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
      WHERE c.id = ?
    `).bind(id).first<Record<string, unknown>>();
    if (!row) return Response.json({ error: "Challenge không tồn tại." }, { status: 404 });
    if (row.status !== "published") {
      const user = await requireSessionUser(request);
      await requireChallengeManager(user.id, id);
    }
    return Response.json({ challenge: row }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const { id } = await params;
    const challenge = await requireChallengeManager(user.id, id);
    const challengeConfig = await env.DB.prepare(`
      SELECT c.reward_type, c.reward_amount_atomic, c.reward_metadata_json, c.funding_status,
        f.id AS fund_id, f.status AS fund_status, f.terms_hash, f.terms_signature,
        f.terms_signer_wallet, f.locked_at
      FROM challenges c LEFT JOIN challenge_funds f ON f.challenge_id = c.id WHERE c.id = ?
    `).bind(id).first<{ reward_type?: string; reward_amount_atomic?: string | null; reward_metadata_json?: string; funding_status?: string; fund_id?: string | null; fund_status?: string | null; terms_hash?: string | null; terms_signature?: string | null; terms_signer_wallet?: string | null; locked_at?: string | null }>();
    const body = (await request.json()) as { action?: "publish" | "close" | "set_access"; accessType?: ChallengeAccessType };
    if (body.action === "publish") {
      const rewardType = String(challengeConfig?.reward_type ?? (challengeConfig?.reward_amount_atomic ? "usdc" : "badge"));
      if ((rewardType === "usdc" || rewardType === "sol") && !challengeConfig?.reward_amount_atomic) return Response.json({ error: `Challenge ${rewardType === "sol" ? "SOL" : "USDC"} cần số tiền thưởng trước khi công bố.` }, { status: 400 });
      if (rewardType === "badge") {
        try {
          const metadata = JSON.parse(String(challengeConfig?.reward_metadata_json ?? "{}")) as { name?: string };
          if (!metadata.name?.trim()) return Response.json({ error: "Challenge huy hiệu cần tên huy hiệu trước khi công bố." }, { status: 400 });
        } catch { return Response.json({ error: "Cấu hình huy hiệu không hợp lệ." }, { status: 400 }); }
      }
      if (challengeConfig?.funding_status !== "funded" || challengeConfig.fund_status !== "funded") {
        return Response.json({ error: "Hãy nạp và xác minh quỹ thưởng Devnet trước khi công bố challenge." }, { status: 409 });
      }
      if (!challengeConfig.fund_id || !challengeConfig.terms_hash || !challengeConfig.terms_signature || challengeConfig.terms_signer_wallet !== user.walletAddress) {
        return Response.json({ error: "Hãy đọc và ký xác nhận điều khoản quỹ thưởng bằng đúng ví đã nạp quỹ trước khi công bố." }, { status: 409 });
      }
      if (challengeConfig.locked_at) return Response.json({ error: "Quỹ challenge đã được khóa trước đó." }, { status: 409 });
      const [challengeUpdate, fundLock] = await env.DB.batch([
        env.DB.prepare(`
          UPDATE challenges SET status = 'published', published_at = CURRENT_TIMESTAMP,
            version = CAST(CAST(version AS INTEGER) + 1 AS TEXT), updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status = 'draft'
        `).bind(id),
        env.DB.prepare("UPDATE challenge_funds SET locked_at = CURRENT_TIMESTAMP, refund_policy_state = 'locked', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'funded' AND terms_signature = ? AND locked_at IS NULL").bind(challengeConfig.fund_id, challengeConfig.terms_signature),
      ]);
      if (!challengeUpdate.meta.changes) return Response.json({ error: "Chỉ challenge draft mới có thể publish." }, { status: 409 });
      if (!fundLock.meta.changes) return Response.json({ error: "Không thể khóa quỹ: điều khoản hoặc trạng thái quỹ đã thay đổi. Vui lòng tải lại và ký lại nếu cần." }, { status: 409 });
    } else if (body.action === "close") {
      await env.DB.prepare("UPDATE challenges SET status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'published'").bind(id).run();
    } else if (body.action === "set_access") {
      if (!isChallengeAccessType(body.accessType)) return Response.json({ error: "Chế độ tham gia không hợp lệ." }, { status: 400 });
      const result = await env.DB.prepare(`
        UPDATE challenges SET access_type = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status IN ('draft', 'published')
      `).bind(body.accessType, id).run();
      if (!result.meta.changes) return Response.json({ error: "Không thể đổi chế độ của challenge đã đóng." }, { status: 409 });
    } else return Response.json({ error: "Action không hợp lệ." }, { status: 400 });
    await writeAuditEvent(env.DB,{actorUserId:user.id,organizationId:challenge.organization_id,action:`challenge.${body.action}`,targetType:"challenge",targetId:id,metadata:body.action === "set_access" ? { accessType: body.accessType } : undefined});
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error); }
}

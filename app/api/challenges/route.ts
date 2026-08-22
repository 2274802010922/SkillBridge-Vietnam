import { env } from "@/lib/runtime-env";
import { RUBRIC } from "../../../lib/assessment-contract";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../lib/auth";
import { requireOrganizationRole } from "../../../lib/authorization";
import { auditStatement } from "../../../lib/audit";
import { isChallengeAccessType, type ChallengeAccessType } from "../../../lib/challenge-access";
import { parseSolAmount, parseUsdcAmount } from "../../../lib/payments";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const rows = await env.DB.prepare(`
      SELECT DISTINCT c.id, c.organization_id, o.name AS organization_name,
        c.title, c.brief, c.skills_json, c.rubric_json, c.reward, c.reward_type, c.reward_asset, c.reward_metadata_json, c.reward_slots, c.minimum_score, c.reward_amount_usdc, c.reward_amount_atomic, c.reward_mint, c.funding_status, c.funding_asset, c.funding_amount_display, c.funding_amount_atomic, c.funding_vault_wallet, c.funded_at, c.access_type, c.status,
        c.version, c.published_at, c.closes_at, c.created_at,
        CASE WHEN owner.user_id IS NOT NULL THEN 1 ELSE 0 END AS can_manage,
        p.id AS participation_id, p.state AS participation_state,
        f.id AS fund_id, f.asset AS fund_asset, f.required_display AS fund_required_display,
        f.required_atomic AS fund_required_atomic, f.funded_atomic AS fund_funded_atomic,
        f.disbursed_atomic AS fund_disbursed_atomic, f.refunded_atomic AS fund_refunded_atomic,
        f.vault_wallet AS fund_vault_wallet, f.reference_key AS fund_reference_key,
        f.status AS fund_status, f.funding_tx AS fund_funding_tx
      FROM challenges c
      JOIN organizations o ON o.id = c.organization_id
      LEFT JOIN memberships owner ON owner.organization_id = c.organization_id
        AND owner.user_id = ? AND owner.status = 'active'
        AND owner.role IN ('business_admin', 'challenge_manager')
      LEFT JOIN participations p ON p.challenge_id = c.id AND p.student_user_id = ?
      LEFT JOIN challenge_funds f ON f.challenge_id = c.id
      WHERE (c.status = 'published' AND c.access_type = 'public')
        OR owner.user_id IS NOT NULL OR p.id IS NOT NULL
      ORDER BY c.created_at DESC
    `).bind(user.id, user.id).all();
    return Response.json({ challenges: rows.results }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const body = (await request.json()) as {
      organizationId?: string; reviewerOrganizationId?: string; title?: string; brief?: string; skills?: string[];
      reward?: string; rewardType?: "usdc" | "sol" | "badge"; rewardAmountUsdc?: string; badgeName?: string; badgeDescription?: string; rewardSlots?: number; minimumScore?: string; closesAt?: string | null; accessType?: ChallengeAccessType;
    };
    if (!body.organizationId) return Response.json({ error: "Thiếu tổ chức." }, { status: 400 });
    await requireOrganizationRole(user.id, body.organizationId, ["business_admin", "challenge_manager"], "business");
    if (!body.reviewerOrganizationId) return Response.json({ error: "Chọn một nhà trường chịu trách nhiệm review." }, { status: 400 });
    const reviewerOrganization = await env.DB.prepare("SELECT id FROM organizations WHERE id = ? AND kind = 'university'").bind(body.reviewerOrganizationId).first();
    if (!reviewerOrganization) return Response.json({ error: "Nhà trường review không hợp lệ." }, { status: 400 });
    const title = body.title?.trim() ?? "";
    const brief = body.brief?.trim() ?? "";
    const reward = body.reward?.trim() ?? "";
    const rewardType = body.rewardType;
    if (rewardType !== "usdc" && rewardType !== "sol" && rewardType !== "badge") return Response.json({ error: "Chọn USDC, SOL Devnet hoặc huy hiệu." }, { status: 400 });
    const rewardAmount = rewardType === "usdc" && body.rewardAmountUsdc?.trim()
      ? parseUsdcAmount(body.rewardAmountUsdc)
      : rewardType === "sol" && body.rewardAmountUsdc?.trim()
        ? parseSolAmount(body.rewardAmountUsdc)
        : null;
    const accessType = body.accessType;
    if (!accessType) return Response.json({ error: "Chọn chế độ công khai hoặc chỉ bằng lời mời." }, { status: 400 });
    if (!isChallengeAccessType(accessType)) return Response.json({ error: "Chế độ tham gia challenge không hợp lệ." }, { status: 400 });
    const skills = (body.skills ?? []).map((item) => item.trim()).filter(Boolean).slice(0, 8);
    if ((rewardType === "usdc" || rewardType === "sol") && (!rewardAmount || !body.rewardAmountUsdc?.trim())) return Response.json({ error: `Challenge ${rewardType === "sol" ? "SOL" : "USDC"} cần số tiền hợp lệ.` }, { status: 400 });
    if (rewardType === "badge" && (!body.badgeName?.trim() || body.rewardAmountUsdc?.trim())) return Response.json({ error: "Challenge huy hiệu cần tên huy hiệu và không nhận số tiền USDC." }, { status: 400 });
    const rewardSlots = Math.max(1, Math.min(100, Math.floor(Number(body.rewardSlots ?? 1)) || 1));
    const minimumScore = body.minimumScore?.trim() || "0";
    const minimumScoreNumber = Number(minimumScore);
    if (!Number.isFinite(minimumScoreNumber) || minimumScoreNumber < 0 || minimumScoreNumber > 100) return Response.json({ error: "Điểm tối thiểu phải từ 0 đến 100." }, { status: 400 });
    const rewardMetadata = rewardType === "badge" ? { name: body.badgeName!.trim().slice(0, 120), description: body.badgeDescription?.trim().slice(0, 500) ?? "" } : {};
    if (title.length < 5 || title.length > 140 || brief.length < 40 || brief.length > 6000 || reward.length < 3 || skills.length < 1) {
      return Response.json({ error: "Challenge cần title, brief tối thiểu 40 ký tự, ít nhất một skill và reward." }, { status: 400 });
    }
    const id = crypto.randomUUID();
    await env.DB.batch([env.DB.prepare(`
      INSERT INTO challenges
        (id, organization_id, reviewer_organization_id, created_by_user_id, title, brief, skills_json, rubric_json, reward, reward_type, reward_asset, reward_metadata_json, reward_slots, minimum_score, reward_amount_usdc, reward_amount_atomic, reward_mint, access_type, closes_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, body.organizationId, body.reviewerOrganizationId, user.id, title, brief, JSON.stringify(skills), JSON.stringify(RUBRIC), reward, rewardType, rewardType === "badge" ? null : rewardType, JSON.stringify(rewardMetadata), rewardSlots, minimumScore, rewardAmount?.display ?? null, rewardAmount?.atomic ?? null, rewardType === "usdc" ? env.SOLANA_USDC_MINT : null, accessType, body.closesAt || null),auditStatement(env.DB,{actorUserId:user.id,organizationId:body.organizationId,action:"challenge.created",targetType:"challenge",targetId:id,metadata:{title,reviewerOrganizationId:body.reviewerOrganizationId,accessType,rewardType,rewardAmount:rewardAmount?.display ?? null}})]);
    return Response.json({ challenge: { id, organizationId: body.organizationId, reviewerOrganizationId: body.reviewerOrganizationId, title, brief, skills, rubric: RUBRIC, reward, rewardType, rewardAsset: rewardType === "badge" ? null : rewardType, rewardMetadata, rewardSlots, minimumScore, rewardAmountUsdc: rewardAmount?.display ?? null, rewardAmountAtomic: rewardAmount?.atomic ?? null, accessType, status: "draft" } }, { status: 201 });
  } catch (error) { return jsonError(error); }
}

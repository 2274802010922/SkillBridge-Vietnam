import { env } from "@/backend/config/runtime-env";
import { jsonError, requireSessionUser } from "@/backend/auth/auth";
export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const rows = await env.DB.prepare(
      `SELECT DISTINCT c.id,c.title,c.status,c.reward_type,c.reward_amount_atomic,c.reward_slots,e.escrow_address,
 CASE WHEN EXISTS(SELECT 1 FROM challenge_funds f WHERE f.challenge_id=c.id) THEN 1 ELSE 0 END AS legacy
 FROM challenges c LEFT JOIN challenge_escrows e ON e.challenge_id=c.id
 LEFT JOIN memberships m ON m.organization_id IN(c.organization_id,c.reviewer_organization_id) AND m.user_id=? AND m.status='active'
 LEFT JOIN participations p ON p.challenge_id=c.id AND p.student_user_id=?
 WHERE c.deleted_at IS NULL AND (m.id IS NOT NULL OR p.id IS NOT NULL OR (c.status='published' AND c.access_type='public') OR json_extract(e.config_json,'$.backup')=? OR json_extract(e.config_json,'$.reviewer')=?) AND c.reward_type IN('sol','usdc') ORDER BY c.created_at DESC`,
    )
      .bind(user.id, user.id, user.walletAddress, user.walletAddress)
      .all();
    return Response.json(
      { escrows: rows.results, wallet: user.walletAddress },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return jsonError(e);
  }
}

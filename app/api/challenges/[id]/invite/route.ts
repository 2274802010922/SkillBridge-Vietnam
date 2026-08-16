import { env } from "@/lib/runtime-env";
import { assertSameOrigin, jsonError, randomToken, requireSessionUser, sha256, validSolanaAddress } from "../../../../../lib/auth";
import { requireChallengeManager } from "../../../../../lib/authorization";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const { id } = await params;
    await requireChallengeManager(user.id, id);
    const challenge = await env.DB.prepare("SELECT status, access_type FROM challenges WHERE id = ?").bind(id).first<{ status: string; access_type: string }>();
    if (challenge?.status !== "published") return Response.json({ error: "Publish challenge trước khi mời sinh viên." }, { status: 409 });
    if (challenge.access_type !== "invite_only") return Response.json({ error: "Challenge public cho phép tham gia trực tiếp và không cần link mời." }, { status: 409 });
    const body = (await request.json()) as { targetWallet?: string };
    const targetWallet = body.targetWallet?.trim() || null;
    if (targetWallet && !validSolanaAddress(targetWallet)) return Response.json({ error: "Ví đích không hợp lệ." }, { status: 400 });
    const token = randomToken(24);
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare(`
      INSERT INTO challenge_invitations
        (id, challenge_id, token_hash, target_wallet, expires_at, created_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), id, await sha256(token), targetWallet, expiresAt, user.id).run();
    return Response.json({ invitation: { joinUrl: `${new URL(request.url).origin}/challenge/${token}`, expiresAt, targetWallet } }, { status: 201 });
  } catch (error) { return jsonError(error); }
}

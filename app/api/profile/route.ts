import { env } from "cloudflare:workers";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../lib/auth";

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const body = (await request.json()) as { displayName?: string; profileKind?: string };
    const displayName = body.displayName?.trim() ?? "";
    const profileKind = body.profileKind ?? "student";
    if (displayName.length < 2 || displayName.length > 80) {
      return Response.json({ error: "Tên hiển thị cần từ 2 đến 80 ký tự." }, { status: 400 });
    }
    if (!(["student", "professional"] as const).includes(profileKind as "student" | "professional")) {
      return Response.json({ error: "Loại hồ sơ không hợp lệ." }, { status: 400 });
    }
    await env.DB.prepare(`
      UPDATE users SET display_name = ?, profile_kind = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(displayName, profileKind, user.id).run();
    return Response.json({ user: { ...user, displayName, profileKind } });
  } catch (error) {
    return jsonError(error);
  }
}


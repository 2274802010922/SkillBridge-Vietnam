import { env } from "@/backend/config/runtime-env";
import {
  assertSameOrigin,
  clearSessionCookie,
  jsonError,
  parseCookie,
  SESSION_COOKIE,
  sha256,
} from "../../../auth/auth";
import { ensureCoreSchema } from "../../../database/schema/core-schema";
import { auditStatement } from "../../../services/audit/audit";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await ensureCoreSchema(env.DB);
    const token = parseCookie(request, SESSION_COOKIE);
    if (token) {
      const tokenHash = await sha256(token);
      const session = await env.DB.prepare("SELECT id, user_id FROM sessions WHERE token_hash = ? AND revoked_at IS NULL")
        .bind(tokenHash).first<{id:string;user_id:string}>();
      if (session) await env.DB.batch([
        env.DB.prepare("UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND revoked_at IS NULL").bind(session.id),
        auditStatement(env.DB,{actorUserId:session.user_id,action:"auth.logout",targetType:"session",targetId:session.id}),
      ]);
    }
    return Response.json({ ok: true }, { headers: { "set-cookie": clearSessionCookie(request) } });
  } catch (error) {
    return jsonError(error);
  }
}

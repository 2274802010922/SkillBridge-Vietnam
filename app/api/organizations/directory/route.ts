import { env } from "cloudflare:workers";
import { jsonError, requireSessionUser } from "../../../../lib/auth";

export async function GET(request: Request) {
  try {
    await requireSessionUser(request);
    const kind = new URL(request.url).searchParams.get("kind");
    if (kind !== "business" && kind !== "university") return Response.json({ error: "Kind không hợp lệ." }, { status: 400 });
    const rows = await env.DB.prepare(`SELECT id, slug, name, kind, verification_status FROM organizations WHERE kind = ? ORDER BY verification_status = 'verified' DESC, name LIMIT 100`).bind(kind).all();
    return Response.json({ organizations: rows.results }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return jsonError(error); }
}

import { env } from "@/lib/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../lib/auth";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const url = new URL(request.url);
    const mine = url.searchParams.get("mine") === "1";
    const skill = url.searchParams.get("skill")?.trim().toLowerCase() ?? "";
    const rows = await env.DB.prepare(`SELECT tp.user_id, tp.headline, tp.bio, tp.visibility, tp.availability, tp.updated_at, u.display_name, w.address AS wallet_address
      FROM talent_profiles tp JOIN users u ON u.id=tp.user_id LEFT JOIN wallets w ON w.user_id=tp.user_id
      WHERE (tp.visibility='public' OR tp.user_id=?) ${mine ? "AND tp.user_id=?" : ""} ORDER BY tp.updated_at DESC LIMIT 100`).bind(...(mine ? [user.id, user.id] : [user.id])).all();
    const profiles = [];
    for (const row of rows.results as Array<Record<string, unknown>>) {
      const credentials = await env.DB.prepare("SELECT sc.id, sc.score, sc.status, sc.skills_json, c.skills_json AS challenge_skills_json, c.title AS challenge_title FROM skill_credentials sc JOIN challenges c ON c.id=sc.challenge_id WHERE sc.student_user_id=? AND sc.status IN ('active','issued') ORDER BY sc.issued_at DESC").bind(row.user_id).all();
      const skills = new Set<string>();
      for (const credential of credentials.results as Array<{ skills_json?: string; challenge_skills_json?: string }>) { for (const source of [credential.skills_json, credential.challenge_skills_json]) { try { for (const item of JSON.parse(source ?? "[]") as unknown[]) { const value = typeof item === "string" ? item : item && typeof item === "object" && "skill" in item ? String((item as { skill?: unknown }).skill ?? "") : ""; if (value) skills.add(value); } } catch { /* ignore malformed legacy row */ } } }
      if (skill && !Array.from(skills).some((item) => item.toLowerCase().includes(skill))) continue;
      profiles.push({ ...row, skills: Array.from(skills), credentials: credentials.results });
    }
    return Response.json({ profiles }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const body = await request.json() as { headline?: string; bio?: string; visibility?: "public" | "private"; availability?: "available" | "busy" };
    const visibility = body.visibility === "public" ? "public" : "private";
    const availability = body.availability === "busy" ? "busy" : "available";
    const headline = body.headline?.trim().slice(0, 160) ?? "";
    const bio = body.bio?.trim().slice(0, 2000) ?? "";
    await env.DB.prepare(`INSERT INTO talent_profiles (user_id,headline,bio,visibility,availability,updated_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET headline=excluded.headline,bio=excluded.bio,visibility=excluded.visibility,availability=excluded.availability,updated_at=CURRENT_TIMESTAMP`).bind(user.id, headline, bio, visibility, availability).run();
    return Response.json({ profile: { userId: user.id, headline, bio, visibility, availability } });
  } catch (error) { return jsonError(error); }
}

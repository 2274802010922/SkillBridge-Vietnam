import { env } from "@/backend/config/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser } from "@/backend/auth/auth";
import { readWalletProfile, saveWalletProfile } from "@/backend/services/profiles/wallet-profile";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const url = new URL(request.url);
    const mine = url.searchParams.get("mine") === "1";
    const skill = url.searchParams.get("skill")?.trim().toLowerCase() || "";
    const rows = await env.DB.prepare(
      `SELECT t.user_id,w.address FROM talent_profiles t JOIN wallets w ON w.user_id=t.user_id WHERE ${mine ? "t.user_id=?" : "t.visibility='public'"} ORDER BY t.updated_at DESC LIMIT 100`,
    )
      .bind(...(mine ? [user.id] : []))
      .all<{ user_id: string; address: string }>();
    const profiles = [];
    for (const row of rows.results) {
      // Directory uses the visitor projection, never a reviewer's/owner's private proof projection.
      const profile = await readWalletProfile(
        env.DB,
        row.address,
        mine ? user.id : undefined,
      );
      if (!profile) continue;
      const skills = [
        ...new Set(
          profile.proofs
            .filter((p) => ["active", "issued"].includes(p.status))
            .flatMap((p) => p.skills),
        ),
      ];
      if (skill && !skills.some((s) => s.toLowerCase().includes(skill)))
        continue;
      profiles.push({
        user_id: row.user_id,
        wallet_address: row.address,
        display_name: profile.displayName,
        headline: profile.headline,
        bio: profile.bio,
        availability: profile.availability,
        visibility: profile.visibility,
        skills,
        credentials: profile.proofs.map((p) => ({
          score: p.score,
          challenge_title: p.title,
        })),
      });
    }
    return Response.json(
      { profiles },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const body = (await request.json()) as Record<string, unknown>;
    // Preserve the old API contract without allowing it to reset unrelated profile preferences.
    const patch = Object.fromEntries(
      ["headline", "bio", "visibility", "availability"]
        .filter((k) => k in body)
        .map((k) => [k, body[k]]),
    );
    return Response.json(
      { profile: await saveWalletProfile(env.DB, user.id, patch) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}

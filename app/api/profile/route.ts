import { env } from "@/lib/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser } from "@/lib/auth";
import { readWalletProfile, saveWalletProfile } from "@/lib/wallet-profile";
import { consumeRateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    return Response.json(
      { profile: await readWalletProfile(env.DB, user.walletAddress, user.id) },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    await consumeRateLimit(env.DB, "profile_update", user.id, 60, 3600);
    const raw = await request.text();
    if (raw.length > 125000)
      return Response.json({ error: "PROFILE_INVALID:size" }, { status: 413 });
    const profile = await saveWalletProfile(env.DB, user.id, JSON.parse(raw));
    return Response.json(
      {
        profile,
        user: {
          ...user,
          displayName: profile?.displayName,
          profileKind: profile?.profileKind,
        },
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}

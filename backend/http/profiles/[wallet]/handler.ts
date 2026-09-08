import { env } from "@/backend/config/runtime-env";
import { getSessionUser, jsonError, validSolanaAddress } from "@/backend/auth/auth";
import { readWalletProfile } from "@/backend/services/profiles/wallet-profile";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ wallet: string }> },
) {
  try {
    const { wallet } = await params;
    if (!validSolanaAddress(wallet))
      return Response.json(
        { error: "PROFILE_UNAVAILABLE" },
        { status: 404, headers: { "cache-control": "no-store" } },
      );
    const user = await getSessionUser(request);
    const profile = await readWalletProfile(
      env.DB,
      wallet,
      new URL(request.url).searchParams.get("preview") === "1"
        ? undefined
        : user?.id,
    );
    if (!profile)
      return Response.json(
        { error: "PROFILE_UNAVAILABLE" },
        { status: 404, headers: { "cache-control": "no-store" } },
      );
    return Response.json(
      { profile },
      {
        headers: {
          "cache-control": "private, no-store",
          "x-robots-tag": "noindex, nofollow",
        },
      },
    );
  } catch (error) {
    return jsonError(error);
  }
}

import { getFxReference } from "@/backend/services/cashout/fx-rates";
import { env } from "@/backend/config/runtime-env";
import { jsonError, requireSessionUser } from "../../../auth/auth";

/** Latest market reference only; never an executable VND payout commitment. */
export async function GET(request: Request) {
  try {
    await requireSessionUser(request);
    const reference = await getFxReference(env);
    return Response.json(reference, {
      headers: {
        "cache-control": "private, max-age=10, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

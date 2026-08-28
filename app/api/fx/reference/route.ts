import { getFxReference } from "@/lib/fx-rates";
import { env } from "@/lib/runtime-env";
import { jsonError, requireSessionUser } from "../../../../lib/auth";

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

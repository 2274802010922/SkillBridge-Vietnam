import { cashoutCapabilities } from "@/backend/services/cashout/cashout";
import { env } from "@/backend/config/runtime-env";
import { jsonError, requireSessionUser } from "../../../auth/auth";

export async function GET(request: Request) {
  try {
    await requireSessionUser(request);
    return Response.json(await cashoutCapabilities(env), { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}

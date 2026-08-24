import { cashoutCapabilities } from "@/lib/cashout";
import { env } from "@/lib/runtime-env";
import { jsonError, requireSessionUser } from "../../../../lib/auth";

export async function GET(request: Request) {
  try {
    await requireSessionUser(request);
    return Response.json(await cashoutCapabilities(env), { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}

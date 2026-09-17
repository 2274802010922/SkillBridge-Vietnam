import { env } from "@/backend/config/runtime-env";
import { requireSessionUser, jsonError } from "@/backend/auth/auth";
import { personalUsage } from "@/backend/services/portfolios/features";
export async function GET(request:Request){try{const user=await requireSessionUser(request);return Response.json(await personalUsage(env.DB,user.id),{headers:{"cache-control":"private, no-store"}});}catch(e){return jsonError(e);}}

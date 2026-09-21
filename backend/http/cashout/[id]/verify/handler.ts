import { env } from "@/backend/config/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../../auth/auth";
import { SELECT_CASHOUT, serializeCashout, type CashoutRow } from "../../../../services/cashout/cashout-record";
import { verifyCashoutFunding } from "../../../../services/cashout/offramp-verification";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const { id } = await params;
    const body = await request.json() as { signature?: string; mode?: string };
    const session = await env.DB.prepare(`${SELECT_CASHOUT} WHERE s.id = ? AND s.user_id = ?`).bind(id, user.id).first<CashoutRow>();
    if (!session) return Response.json({ error: "Không tìm thấy lệnh rút tiền." }, { status: 404 });
    let result;
    try {
      result = await verifyCashoutFunding(env.DB, session, body.signature?.trim() || "", body.mode === "manual" ? "manual" : "automatic", env.SOLANA_RPC_URL);
    } catch (error) {
      const response = await jsonError(error);
      const updated = await env.DB.prepare(`${SELECT_CASHOUT} WHERE s.id = ? AND s.user_id = ?`).bind(id, user.id).first<CashoutRow>();
      return Response.json({ ...await response.json() as Record<string, unknown>, session: updated ? serializeCashout(updated, env.SOLANA_USDC_MINT) : null }, { status: response.status });
    }
    const updated = await env.DB.prepare(`${SELECT_CASHOUT} WHERE s.id = ? AND s.user_id = ?`).bind(id, user.id).first<CashoutRow>();
    return Response.json({ ...result, session: updated ? serializeCashout(updated, env.SOLANA_USDC_MINT) : null });
  } catch (error) { return jsonError(error); }
}

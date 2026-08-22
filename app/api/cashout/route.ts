import { env } from "@/lib/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../lib/auth";
import { auditStatement } from "../../../lib/audit";
import { parseUsdcAmount } from "../../../lib/payments";

function quote(amountUsdc: string, rate: number) {
  const gross = Math.round(Number(amountUsdc) * rate);
  const fee = Math.max(0, Math.round(gross * 0.008));
  return { estimatedVnd: gross, feeVnd: fee, netVnd: gross - fee, rate };
}

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const sessions = await env.DB.prepare(`
      SELECT id, amount_usdc, estimated_vnd, fee_vnd, net_vnd, provider, status,
        provider_reference, created_at, updated_at
      FROM cashout_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 12
    `).bind(user.id).all();
    return Response.json({ sessions: sessions.results, sandbox: true }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}

/** Create an explicitly simulated USDC-to-VND quote. No bank transfer or on-chain transfer is performed. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const body = await request.json() as { amountUsdc?: string };
    const amount = parseUsdcAmount(body.amountUsdc || "");
    if (!amount || Number(amount.display) > 1_000_000) return Response.json({ error: "Nhập số USDC hợp lệ, tối đa 1.000.000 USDC cho sandbox." }, { status: 400 });
    const rate = Math.max(1, Math.floor(Number(env.CASHOUT_SANDBOX_VND_RATE || "25000")) || 25_000);
    const calculation = quote(amount.display, rate);
    const id = crypto.randomUUID();
    const reference = `SB-SANDBOX-${id.slice(0, 8).toUpperCase()}`;
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO cashout_sessions
          (id, user_id, wallet_address, amount_usdc, amount_atomic, estimated_vnd, fee_vnd, net_vnd, provider_reference)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(id, user.id, user.walletAddress, amount.display, amount.atomic, String(calculation.estimatedVnd), String(calculation.feeVnd), String(calculation.netVnd), reference),
      auditStatement(env.DB, {
        actorUserId: user.id, action: "cashout.sandbox_quote_created", targetType: "cashout_session", targetId: id,
        metadata: { amountUsdc: amount.display, rate, reference },
      }),
    ]);
    return Response.json({ session: { id, amountUsdc: amount.display, ...calculation, providerReference: reference, status: "quote_ready" }, sandbox: true }, { status: 201 });
  } catch (error) { return jsonError(error); }
}

import { cashoutCapabilities } from "@/backend/services/cashout/cashout";
import { SELECT_CASHOUT, serializeCashout, type CashoutRow } from "@/backend/services/cashout/cashout-record";
import { createCashoutOrder, type CreateCashoutInput } from "@/backend/services/cashout/offramp-create";
import { env } from "@/backend/config/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../auth/auth";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    await env.DB.prepare(
      `
      UPDATE cashout_sessions SET status = 'quote_expired', updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND status IN ('quote_ready', 'awaiting_wallet_signature')
        AND COALESCE(CASE WHEN terms_accepted_at IS NOT NULL THEN json_extract(metadata_json, '$.offramp.fundingDeadline') END, quote_expires_at) <= ?
        AND payment_tx IS NULL AND submitted_tx IS NULL
    `,
    )
      .bind(user.id, new Date().toISOString())
      .run();
    const [sessions, capabilities] = await Promise.all([
      env.DB.prepare(
        `${SELECT_CASHOUT} WHERE s.user_id = ? ORDER BY s.created_at DESC LIMIT 12`,
      )
        .bind(user.id)
        .all<CashoutRow>(),
      cashoutCapabilities(env),
    ]);
    return Response.json(
      {
        sessions: sessions.results.map((row) =>
          serializeCashout(row, env.SOLANA_USDC_MINT),
        ),
        capabilities,
      },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}

/** Create a pinned test quote for the authenticated wallet. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const body = await request.json() as CreateCashoutInput;
    return Response.json(await createCashoutOrder(env.DB, env, user, body), { status: 201 });
  } catch (error) { return jsonError(error); }
}

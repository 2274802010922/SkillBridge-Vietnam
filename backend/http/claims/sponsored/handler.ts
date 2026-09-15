import { env } from "@/backend/config/runtime-env";
import {
  assertSameOrigin,
  requireSessionUser,
  jsonError,
} from "@/backend/auth/auth";
import { consumeRateLimit } from "@/backend/auth/rate-limit";
import {
  buildSponsoredClaim,
  coSignSponsoredClaim,
  sponsorKey,
} from "@/solana/server/sponsored-claim";
import { inspectReward } from "@/solana/client/independent-claim";
import { escrowRpc } from "@/solana/client/challenge-escrow";
type Claim = {
  id: string;
  user_id: string;
  escrow_address: string;
  recipient: string;
  message_base64: string;
  unsigned_base64: string;
  signed_base64: string | null;
  signature: string | null;
  last_valid_height: string;
  status: string;
  reserve_lamports: number;
  budget_day: string;
};
function config() {
  return {
    enabled:
      process.env.SPONSORED_CLAIMS_ENABLED === "true" &&
      !!process.env.SOLANA_SPONSOR_SECRET,
    rpc: env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
    key: process.env.SOLANA_SPONSOR_SECRET || "",
    daily: Math.max(
      0,
      Math.min(
        1000000000,
        Number(process.env.SPONSOR_DAILY_LAMPORTS || 100000000),
      ),
    ),
    cap: Math.max(
      0,
      Math.min(
        10000000,
        Number(process.env.SPONSOR_MAX_CLAIM_LAMPORTS || 3000000),
      ),
    ),
  };
}
async function status(row: Claim, rpc: string) {
  const checked = await inspectReward(rpc, row.escrow_address, row.recipient);
  if (checked.submission?.paid) {
    await env.DB.prepare(
      "UPDATE sponsored_claims SET status='finalized',updated_at=CURRENT_TIMESTAMP WHERE id=?",
    )
      .bind(row.id)
      .run();
    return { ...row, status: "finalized" };
  }
  if (row.signature) {
    const result = await escrowRpc<{
      value: ({ err: unknown; confirmationStatus: string } | null)[];
    }>(rpc, "getSignatureStatuses", [
      [row.signature],
      { searchTransactionHistory: true },
    ]);
    if (result.value[0]) {
      if (result.value[0].err) {
        await env.DB.prepare(
          "UPDATE sponsored_claims SET status='failed' WHERE id=?",
        )
          .bind(row.id)
          .run();
        return { ...row, status: "failed" };
      }
      return { ...row, status: "broadcast" };
    }
  }
  const height = await escrowRpc<number>(rpc, "getBlockHeight", [
    { commitment: "finalized" },
  ]);
  if (BigInt(height) > BigInt(row.last_valid_height)) {
    await env.DB.prepare(
      "UPDATE sponsored_claims SET status='expired' WHERE id=? AND status IN ('prepared','broadcast')",
    )
      .bind(row.id)
      .run();
    return { ...row, status: "expired" };
  }
  return row;
}
export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request),
      c = config();
    const escrow = new URL(request.url).searchParams.get("escrow");
    if (!escrow) return Response.json({ enabled: c.enabled });
    const row = await env.DB.prepare(
      "SELECT * FROM sponsored_claims WHERE user_id=? AND recipient=? AND escrow_address=? ORDER BY created_at DESC LIMIT 1",
    )
      .bind(user.id, user.walletAddress, escrow)
      .first<Claim>();
    if (!row) return Response.json({ enabled: c.enabled, claim: null });
    const s = await status(row, c.rpc);
    return Response.json(
      {
        enabled: c.enabled,
        claim: { id: s.id, status: s.status, signature: s.signature },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return jsonError(e);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request),
      c = config();
    const b = (await request.json()) as {
      action: string;
      escrow?: string;
      id?: string;
      transaction?: string;
    };
    await consumeRateLimit(env.DB, "sponsored_claim", user.id, 20, 3600);
    if (b.action === "prepare") {
      if (!c.enabled)
        return Response.json(
          {
            error: "Tài trợ phí chưa được bật. Bạn có thể chọn tự trả phí.",
            code: "SPONSOR_UNAVAILABLE",
          },
          { status: 503 },
        );
      if (!b.escrow)
        return Response.json({ error: "Missing fund" }, { status: 400 });
      const prior = await env.DB.prepare(
        "SELECT * FROM sponsored_claims WHERE escrow_address=? AND recipient=? AND status IN ('prepared','broadcast','finalized')",
      )
        .bind(b.escrow, user.walletAddress)
        .first<Claim>();
      if (prior) {
        const s = await status(prior, c.rpc);
        if (["prepared", "broadcast", "finalized"].includes(s.status))
          return Response.json({
            id: s.id,
            status: s.status,
            transaction:
              s.status === "prepared" ? s.unsigned_base64 : undefined,
            signature: s.signature,
          });
      }
      await consumeRateLimit(
        env.DB,
        "sponsored_claim_daily",
        user.id,
        3,
        86400,
      );
      const tx = await buildSponsoredClaim(
        c.rpc,
        b.escrow,
        user.walletAddress,
        sponsorKey(c.key).address,
      );
      if (
        !Number.isSafeInteger(c.daily) ||
        !Number.isSafeInteger(c.cap) ||
        tx.reserve > c.cap
      )
        return Response.json(
          { error: "Khoản phí vượt hạn mức tài trợ." },
          { status: 409 },
        );
      const day = new Date().toISOString().slice(0, 10),
        id = crypto.randomUUID();
      const reserve = await env.DB.prepare(
        "INSERT INTO sponsor_daily_budget(day,reserved) SELECT ?,? WHERE ?<=? ON CONFLICT(day) DO UPDATE SET reserved=reserved+excluded.reserved WHERE reserved+excluded.reserved<=?",
      )
        .bind(day, tx.reserve, tx.reserve, c.daily, c.daily)
        .run();
      if (!reserve.meta.changes)
        return Response.json(
          { error: "Đã hết ngân sách tài trợ hôm nay. Có thể tự trả phí." },
          { status: 429 },
        );
      try {
        await env.DB.prepare(
          "INSERT INTO sponsored_claims(id,user_id,escrow_address,recipient,message_base64,unsigned_base64,last_valid_height,status,reserve_lamports,budget_day) VALUES(?,?,?,?,?,?,?,'prepared',?,?)",
        )
          .bind(
            id,
            user.id,
            b.escrow,
            user.walletAddress,
            tx.messageBase64,
            tx.unsignedBase64,
            tx.lastValidHeight,
            tx.reserve,
            day,
          )
          .run();
      } catch (error) {
        await env.DB.prepare(
          "UPDATE sponsor_daily_budget SET reserved=MAX(0,reserved-?) WHERE day=?",
        )
          .bind(tx.reserve, day)
          .run();
        throw error;
      }
      return Response.json(
        { id, status: "prepared", transaction: tx.unsignedBase64 },
        { status: 201 },
      );
    }
    const row = await env.DB.prepare(
      "SELECT * FROM sponsored_claims WHERE id=? AND user_id=? AND recipient=?",
    )
      .bind(b.id || "", user.id, user.walletAddress)
      .first<Claim>();
    if (!row) return Response.json({ error: "Not found" }, { status: 404 });
    const current = await status(row, c.rpc);
    if (current.status === "finalized")
      return Response.json({
        status: "finalized",
        signature: current.signature,
      });
    if (["expired", "failed"].includes(current.status))
      return Response.json(
        {
          error: "Giao dịch hết hạn hoặc thất bại. Hãy tạo yêu cầu mới.",
          status: current.status,
        },
        { status: 409 },
      );
    if (b.action !== "send")
      return Response.json({ error: "Invalid action" }, { status: 400 });
    let wire = current.signed_base64,
      sig = current.signature;
    if (!wire) {
      if (!c.enabled || !b.transaction)
        return Response.json(
          { error: "Sponsorship unavailable" },
          { status: 503 },
        );
      const signed = coSignSponsoredClaim(
        row.message_base64,
        b.transaction,
        user.walletAddress,
        c.key,
      );
      wire = signed.transaction;
      sig = signed.signature;
      await env.DB.prepare(
        "UPDATE sponsored_claims SET signed_base64=?,signature=?,status='broadcast',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='prepared'",
      )
        .bind(wire, sig, row.id)
        .run();
    }
    // The same stored signed bytes can be rebroadcast; never rebuild after signing.
    try {
      await escrowRpc(c.rpc, "sendTransaction", [
        wire,
        { encoding: "base64", preflightCommitment: "confirmed" },
      ]);
    } catch {
      /* Reconciliation uses the saved signature on the next refresh. */
    }
    return Response.json({ id: row.id, status: "broadcast", signature: sig });
  } catch (e) {
    return jsonError(e);
  }
}

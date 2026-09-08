import { env } from "@/backend/config/runtime-env";
import { assertSameOrigin, jsonError } from "../../../auth/auth";
import { ensureCoreSchema } from "../../../database/schema/core-schema";
import { consumeRateLimit, requestClientIdentity } from "../../../auth/rate-limit";

const BASE64_TRANSACTION = /^[A-Za-z0-9+/]+={0,2}$/;

/** Relay a transaction that was already signed by a connected Wallet Standard wallet. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await ensureCoreSchema(env.DB);
    await consumeRateLimit(env.DB, "solana_send", requestClientIdentity(request), 20, 60);
    const body = await request.json() as { transaction?: string };
    const transaction = body.transaction?.trim() ?? "";
    if (!transaction || transaction.length > 65_536 || transaction.length % 4 === 1 || !BASE64_TRANSACTION.test(transaction)) {
      return Response.json({ error: "Transaction đã ký không hợp lệ." }, { status: 400 });
    }

    const response = await fetch(env.SOLANA_RPC_URL || "https://api.devnet.solana.com", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method: "sendTransaction",
        params: [transaction, { encoding: "base64", skipPreflight: false, preflightCommitment: "confirmed", maxRetries: 3 }],
      }),
    });
    if (!response.ok) throw new Error("Solana Devnet RPC không phản hồi.");
    const payload = await response.json() as { result?: string; error?: { message?: string } };
    if (payload.error || !payload.result) throw new Error(payload.error?.message ?? "Không thể gửi transaction lên Solana Devnet.");
    return Response.json({ signature: payload.result }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}

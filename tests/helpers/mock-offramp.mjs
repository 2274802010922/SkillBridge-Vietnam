// Test-process preload. No production imports, test flags, real provider calls or broadcast.
import { createClient } from "@libsql/client";
const db = createClient({ url: process.env.TURSO_DATABASE_URL });
const original = globalThis.fetch;
globalThis.fetch = async (input, options) => {
  const url = input instanceof Request ? input.url : String(input);
  if (url.startsWith("http://127.0.0.1:39998")) {
    const body = JSON.parse(String(options.body));
    let result;
    if (body.method === "getGenesisHash") result = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
    else if (body.method === "getBalance") result = { context: { slot: 1 }, value: 5000000000 };
    else if (body.method === "getTokenAccountsByOwner") result = { context: { slot: 1 }, value: [] };
    else if (body.method === "getLatestBlockhash") result = { context: { slot: 1 }, value: { blockhash: "11111111111111111111111111111111", lastValidBlockHeight: 100 } };
    else if (body.method === "getSignatureStatuses") result = { value: [{ err: null, confirmationStatus: "finalized" }] };
    else if (body.method === "getTransaction") {
      const { rows } = await db.execute({ sql: "SELECT * FROM cashout_sessions WHERE submitted_tx = ?", args: [body.params[0]] });
      const order = rows[0];
      if (!order) result = null;
      else {
        const snapshot = JSON.parse(order.metadata_json).offramp;
        const token = (owner, amount, accountIndex) => ({ owner, mint: snapshot.mint, accountIndex, uiTokenAmount: { amount, decimals: 6 } });
        result = { blockTime: Math.floor(Date.now() / 1000), transaction: { message: { accountKeys: [{ pubkey: order.wallet_address, signer: true }, { pubkey: order.reference_key, signer: false }], instructions: [] } },
          meta: { err: null, preTokenBalances: [token(order.wallet_address, order.amount_atomic, 0), token(order.settlement_wallet, "0", 1)],
            postTokenBalances: [token(order.wallet_address, "0", 0), token(order.settlement_wallet, order.amount_atomic, 1)] } };
      }
    } else throw new Error("Unexpected test RPC: " + body.method);
    return Response.json({ jsonrpc: "2.0", id: body.id, result });
  }
  // Keep FX deterministic and offline; fallback is explicitly labelled, not a live quote.
  if (/coingecko|hermes|exchangerate|openexchangerates/.test(url)) return Response.json({}, { status: 503 });
  return original(input, options);
};

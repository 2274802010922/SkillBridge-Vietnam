import { payloadHash } from "./offramp-snapshot.ts";
import { storedProvider } from "./providers/registry.ts";
import { OfframpError, type FundingSnapshot, type OfframpProvider } from "./providers/types.ts";

/** Intent precedes any provider action; retries retain the same payload and key. */
export async function ensureProviderOrder(db: D1Database, snapshot: FundingSnapshot,
  provider: OfframpProvider = storedProvider(snapshot.provider, snapshot.mode, snapshot.adapterVersion)) {
  const key = `create:${snapshot.orderId}`;
  const hash = payloadHash(JSON.stringify(snapshot));
  await db.prepare(`INSERT OR IGNORE INTO offramp_operations (operation_key, order_id, payload_hash) VALUES (?, ?, ?)`)
    .bind(key, snapshot.orderId, hash).run();
  const row = await db.prepare("SELECT * FROM offramp_operations WHERE operation_key = ?").bind(key)
    .first<{ payload_hash: string; status: string; result_json: string | null }>();
  if (!row || row.payload_hash !== hash) throw new OfframpError("Operation payload changed", "OPERATION_CONFLICT");
  if (row.status === "completed") return JSON.parse(row.result_json!) as { providerOrderId: string };
  const lease = crypto.randomUUID();
  const claimed = await db.prepare(`UPDATE offramp_operations SET status = 'processing', lease_token = ?, lease_until = ?,
    attempts = attempts + 1 WHERE operation_key = ? AND status <> 'completed' AND lease_until <= ?`)
    .bind(lease, Date.now() + 30000, key, Date.now()).run();
  if (!claimed.meta.changes) throw new OfframpError("Operation in progress; recheck this order", "OPERATION_PENDING", 409);
  try {
    const result = await provider.createOrder(snapshot, key);
    if (result.providerOrderId !== snapshot.providerOrderId) throw new OfframpError("Provider order mismatch", "PROVIDER_ORDER_MISMATCH");
    const saved = await db.prepare(`UPDATE offramp_operations SET status = 'completed', result_json = ?, lease_until = 0,
      last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE operation_key = ? AND lease_token = ? AND lease_until > ?`)
      .bind(JSON.stringify(result), key, lease, Date.now()).run();
    if (!saved.meta.changes) throw new OfframpError("Lease expired; reconcile same operation", "OPERATION_PENDING");
    return result;
  } catch (error) {
    await db.prepare(`UPDATE offramp_operations SET status = 'uncertain', last_error = 'PROVIDER_RECHECK_REQUIRED',
      lease_until = 0 WHERE operation_key = ? AND lease_token = ? AND status <> 'completed'`).bind(key, lease).run();
    throw error;
  }
}

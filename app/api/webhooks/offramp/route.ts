import { env } from "@/lib/runtime-env";
import { jsonError, sha256 } from "../../../../lib/auth";
import { ensureCoreSchema } from "../../../../lib/core-schema";

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function expectedSignature(secret: string, payload: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return `sha256=${hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)))}`;
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

/** Idempotent partner callback. Disabled until a provider webhook secret is configured on Vercel. */
export async function POST(request: Request) {
  try {
    const secret = env.CASHOUT_WEBHOOK_SECRET?.trim();
    if (!secret) return Response.json({ error: "Off-ramp webhook chưa được cấu hình." }, { status: 503 });
    await ensureCoreSchema(env.DB);
    const eventId = request.headers.get("x-skillbridge-event-id")?.trim() ?? "";
    const signature = request.headers.get("x-skillbridge-signature")?.trim() ?? "";
    if (!/^[A-Za-z0-9._:-]{8,160}$/.test(eventId)) return Response.json({ error: "Webhook event id không hợp lệ." }, { status: 400 });
    const raw = await request.text();
    if (raw.length > 65_536) return Response.json({ error: "Webhook payload quá lớn." }, { status: 413 });
    const valid = constantTimeEqual(signature, await expectedSignature(secret, raw));
    if (!valid) return Response.json({ error: "Webhook signature không hợp lệ." }, { status: 401 });
    const existing = await env.DB.prepare("SELECT id, status FROM cashout_webhook_events WHERE provider_event_id = ?").bind(eventId).first<{ id: string; status: string }>();
    if (existing) return Response.json({ ok: true, reused: true, status: existing.status });
    const payload = JSON.parse(raw) as { orderId?: string; status?: "completed" | "failed"; bankReference?: string; errorCode?: string };
    if (!payload.orderId || !["completed", "failed"].includes(payload.status || "")) return Response.json({ error: "Webhook payload không hợp lệ." }, { status: 400 });
    const payloadHash = await sha256(raw);
    const webhookId = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO cashout_webhook_events (id, provider, provider_event_id, signature_valid, payload_hash)
      VALUES (?, 'configured_offramp_partner', ?, 1, ?)
    `).bind(webhookId, eventId, payloadHash).run();
    const order = await env.DB.prepare("SELECT id, status FROM cashout_sessions WHERE id = ?").bind(payload.orderId).first<{ id: string; status: string }>();
    if (!order) {
      await env.DB.prepare("UPDATE cashout_webhook_events SET status = 'ignored_unknown_order', processed_at = CURRENT_TIMESTAMP WHERE id = ?").bind(webhookId).run();
      return Response.json({ ok: true, ignored: true });
    }
    const nextStatus = payload.status === "completed" ? "sandbox_completed" : "onchain_failed";
    const eventType = payload.status === "completed" ? "bank.provider_completed" : "bank.provider_failed";
    await env.DB.batch([
      env.DB.prepare(`
        UPDATE cashout_sessions SET status = ?, payout_status = ?, bank_reference = COALESCE(?, bank_reference),
          last_error_code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'bank_processing'
      `).bind(nextStatus, payload.status === "completed" ? "provider_completed" : "provider_failed", payload.bankReference || null, payload.errorCode || null, payload.orderId),
      env.DB.prepare("INSERT OR IGNORE INTO cashout_events (id, cashout_session_id, event_key, event_type, status, metadata_json) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), payload.orderId, `webhook:${eventId}`, eventType, nextStatus, JSON.stringify({ eventId, bankReference: payload.bankReference || null, errorCode: payload.errorCode || null })),
      env.DB.prepare("UPDATE cashout_webhook_events SET status = 'processed', processed_at = CURRENT_TIMESTAMP WHERE id = ?").bind(webhookId),
    ]);
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error); }
}

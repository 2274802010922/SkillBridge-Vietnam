import { env } from "@/backend/config/runtime-env";
import { jsonError } from "../../../auth/auth";
import { ensureCoreSchema } from "../../../database/schema/core-schema";
import { SandboxProvider } from "../../../services/cashout/providers/sandbox";
import { receivePayoutEvent } from "../../../services/cashout/offramp-inbox";
import { payloadHash } from "../../../services/cashout/offramp-snapshot";

/** Sandbox v2 callback only. Rejects legacy HMAC and production events. */
export async function POST(request: Request) {
  try {
    const secret = env.CASHOUT_WEBHOOK_SECRET?.trim();
    if (!secret) return Response.json({ error: "Off-ramp webhook chưa được cấu hình." }, { status: 503 });
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: "Missing body" }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 65536) { await reader.cancel(); return Response.json({ error: "Payload too large" }, { status: 413 }); }
      chunks.push(part.value);
    }
    const raw = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
    const event = await new SandboxProvider().verifyAndNormalizeWebhook(raw, request.headers, secret);
    await ensureCoreSchema(env.DB);
    const result = await receivePayoutEvent(env.DB, event, payloadHash(raw));
    return Response.json({ ok: true, ...result }, { status: result.processed ? 200 : 202 });
  } catch (error) { return jsonError(error); }
}

import { env } from "@/backend/config/runtime-env";
import { ensureCoreSchema } from "../../../database/schema/core-schema";
import { assertSameOrigin, jsonError, validSolanaAddress } from "../../../auth/auth";
import { randomAlphanumericToken } from "../../../auth/random-token";
import { consumeRateLimit, requestClientIdentity } from "../../../auth/rate-limit";
import { createAuthenticationSignInInput, PRODUCT_CHAIN } from "../../../../shared/validation/siws";

// Phantom validates this field against the SIWS ABNF, which permits URI-safe ASCII only.
const STATEMENT = "Sign in to SkillBridge Vietnam to manage challenges, skill evidence, and credentials.";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await ensureCoreSchema(env.DB);
    await consumeRateLimit(env.DB, "auth_challenge", requestClientIdentity(request), 12, 60);
    const body = (await request.json()) as { address?: string };
    const address = body.address?.trim() ?? "";
    if (!validSolanaAddress(address)) {
      return Response.json({ error: "Địa chỉ ví Solana không hợp lệ." }, { status: 400 });
    }

    const url = new URL(request.url);
    const issuedAt = new Date();
    const expirationTime = new Date(issuedAt.getTime() + 5 * 60 * 1000);
    const id = crypto.randomUUID();
    const input = createAuthenticationSignInInput({
      domain: url.host,
      address,
      statement: STATEMENT,
      uri: url.origin,
      nonce: randomAlphanumericToken(24),
      issuedAt: issuedAt.toISOString(),
      expirationTime: expirationTime.toISOString(),
      requestId: id,
      resources: [`${url.origin}/terms`, `${url.origin}/privacy`],
    });

    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO auth_nonces
          (id, nonce, wallet_address, domain, uri, chain_id, statement, request_id, issued_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        input.nonce,
        input.address,
        input.domain,
        input.uri,
        PRODUCT_CHAIN,
        input.statement,
        input.requestId,
        input.issuedAt,
        input.expirationTime,
      ),
      env.DB.prepare("DELETE FROM auth_nonces WHERE expires_at < ? OR used_at IS NOT NULL")
        .bind(new Date(issuedAt.getTime() - 24 * 60 * 60 * 1000).toISOString()),
    ]);

    return Response.json({ challengeId: id, input }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}

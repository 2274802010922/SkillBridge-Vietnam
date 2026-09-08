import { sha256 } from "./auth";

export class RateLimitError extends Error {
  status = 429;
  constructor(public retryAfter: number) {
    super("Bạn thao tác quá nhanh. Vui lòng thử lại sau.");
  }
}

export function requestClientIdentity(request: Request) {
  return request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown-client";
}

export async function consumeRateLimit(
  db: D1Database,
  scope: string,
  identity: string,
  limit: number,
  windowSeconds: number,
) {
  const now = Math.floor(Date.now() / 1000);
  const bucketStart = Math.floor(now / windowSeconds) * windowSeconds;
  const expiresAtUnix = bucketStart + windowSeconds;
  const key = await sha256(`${scope}:${identity}:${bucketStart}`);
  const result = await db.prepare(`
    INSERT INTO rate_limits (key, scope, bucket_start, count, expires_at)
    VALUES (?, ?, ?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET count = count + 1
    RETURNING count
  `).bind(
    key,
    scope,
    String(bucketStart),
    new Date(expiresAtUnix * 1000).toISOString(),
  ).first<{ count: number }>();
  if (Number(result?.count ?? 1) > limit) {
    throw new RateLimitError(Math.max(1, expiresAtUnix - now));
  }
  if (Math.random() < 0.02) {
    await db.prepare("DELETE FROM rate_limits WHERE expires_at < ?")
      .bind(new Date(now * 1000).toISOString()).run();
  }
}

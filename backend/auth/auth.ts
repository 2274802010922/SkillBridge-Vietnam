import { env } from "@/backend/config/runtime-env";
import bs58 from "bs58";
import { ensureCoreSchema } from "../database/schema/core-schema";

export const SESSION_COOKIE = "skillbridge_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

export type SessionUser = {
  id: string;
  walletAddress: string;
  displayName: string | null;
  profileKind: string;
};

type SessionRow = {
  session_id: string;
  user_id: string;
  wallet_address: string;
  display_name: string | null;
  profile_kind: string;
};

export function parseCookie(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  for (const item of header.split(";")) {
    const [key, ...value] = item.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export function randomToken(byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return bytesToBase64Url(bytes);
}

export function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function validSolanaAddress(address: string) {
  try {
    return bs58.decode(address).length === 32;
  } catch {
    return false;
  }
}

export function sessionCookie(request: Request, token: string, maxAge = SESSION_TTL_SECONDS) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookie(request: Request) {
  return sessionCookie(request, "", 0);
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const expected = new URL(request.url).origin;
  if (origin !== expected) throw new Response("Origin không hợp lệ.", { status: 403 });
}

export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  if (!env.DB) return null;
  await ensureCoreSchema(env.DB);
  const token = parseCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(`
    SELECT s.id AS session_id, u.id AS user_id, w.address AS wallet_address,
      u.display_name, u.profile_kind
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    JOIN wallets w ON w.user_id = u.id
    WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?
    ORDER BY w.verified_at ASC
    LIMIT 1
  `).bind(tokenHash, new Date().toISOString()).first<SessionRow>();
  if (!row) return null;
  await env.DB.prepare("UPDATE sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(row.session_id).run();
  return {
    id: row.user_id,
    walletAddress: row.wallet_address,
    displayName: row.display_name,
    profileKind: row.profile_kind,
  };
}

export async function requireSessionUser(request: Request) {
  const user = await getSessionUser(request);
  if (!user) throw new Response("Bạn cần đăng nhập bằng ví Solana.", { status: 401 });
  return user;
}

export async function listMemberships(userId: string) {
  await ensureCoreSchema(env.DB);
  return env.DB.prepare(`
    SELECT m.id, m.role, m.status, o.id AS organization_id, o.name AS organization_name,
      o.slug AS organization_slug, o.kind AS organization_kind,
      o.verification_status
    FROM memberships m
    JOIN organizations o ON o.id = m.organization_id
    WHERE m.user_id = ? AND m.status = 'active'
    ORDER BY o.name, m.role
  `).bind(userId).all();
}

export function jsonError(error: unknown) {
  if (error instanceof Response) return error;
  const status = error instanceof Error && "status" in error
    ? Number((error as Error & { status: number }).status)
    : 500;
  const retryAfter = error instanceof Error && "retryAfter" in error
    ? String((error as Error & { retryAfter: number }).retryAfter)
    : null;
  const code = error instanceof Error && "code" in error
    ? String((error as Error & { code: string }).code)
    : null;
  const retryable = error instanceof Error && "retryable" in error
    ? Boolean((error as Error & { retryable: boolean }).retryable)
    : undefined;
  return Response.json(
    { error: error instanceof Error ? error.message : "Đã có lỗi không mong muốn.", ...(code ? { code } : {}), ...(retryable !== undefined ? { retryable } : {}) },
    { status, headers: retryAfter ? { "retry-after": retryAfter } : undefined },
  );
}

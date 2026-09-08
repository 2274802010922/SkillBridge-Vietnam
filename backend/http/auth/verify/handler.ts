import { env } from "@/backend/config/runtime-env";
import bs58 from "bs58";
import { verifySignIn } from "@solana/wallet-standard-util";
import type { SolanaSignInInput, SolanaSignInOutput } from "@solana/wallet-standard-features";
import {
  assertSameOrigin,
  base64UrlToBytes,
  jsonError,
  randomToken,
  sessionCookie,
  SESSION_TTL_SECONDS,
  sha256,
  validSolanaAddress,
} from "../../../auth/auth";
import { ensureCoreSchema } from "../../../database/schema/core-schema";
import { auditStatement } from "../../../services/audit/audit";
import { consumeRateLimit, requestClientIdentity } from "../../../auth/rate-limit";
import { createAuthenticationSignInInput } from "../../../../shared/validation/siws";

type NonceRow = {
  id: string;
  nonce: string;
  wallet_address: string;
  domain: string;
  uri: string;
  statement: string;
  request_id: string;
  issued_at: string;
  expires_at: string;
  used_at: string | null;
};

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await ensureCoreSchema(env.DB);
    await consumeRateLimit(env.DB, "auth_verify", requestClientIdentity(request), 8, 60);
    const body = (await request.json()) as {
      challengeId?: string;
      address?: string;
      signedMessage?: string;
      signature?: string;
    };
    const challengeId = body.challengeId?.trim() ?? "";
    const address = body.address?.trim() ?? "";
    if (!challengeId || !validSolanaAddress(address) || !body.signedMessage || !body.signature) {
      return Response.json({ error: "Thiếu hoặc sai dữ liệu chữ ký." }, { status: 400 });
    }

    const nonce = await env.DB.prepare(`
      SELECT id, nonce, wallet_address, domain, uri, statement,
        request_id, issued_at, expires_at, used_at
      FROM auth_nonces WHERE id = ?
    `).bind(challengeId).first<NonceRow>();
    if (!nonce || nonce.used_at || nonce.expires_at <= new Date().toISOString()) {
      return Response.json({ error: "Yêu cầu đăng nhập đã hết hạn hoặc đã được sử dụng." }, { status: 401 });
    }
    if (nonce.wallet_address !== address || nonce.domain !== new URL(request.url).host || nonce.uri !== new URL(request.url).origin) {
      return Response.json({ error: "Domain hoặc ví không khớp yêu cầu đăng nhập." }, { status: 401 });
    }

    const publicKey = bs58.decode(address);
    const input: SolanaSignInInput = createAuthenticationSignInInput({
      domain: nonce.domain,
      address,
      statement: nonce.statement,
      uri: nonce.uri,
      nonce: nonce.nonce,
      issuedAt: nonce.issued_at,
      expirationTime: nonce.expires_at,
      requestId: nonce.request_id,
      resources: [`${nonce.uri}/terms`, `${nonce.uri}/privacy`],
    });
    const output: SolanaSignInOutput = {
      account: {
        address,
        publicKey,
        chains: ["solana:devnet"],
        features: ["solana:signIn", "solana:signMessage"],
      },
      signedMessage: base64UrlToBytes(body.signedMessage),
      signature: base64UrlToBytes(body.signature),
      signatureType: "ed25519",
    };
    if (!verifySignIn(input, output)) {
      return Response.json({ error: "Chữ ký ví không hợp lệ." }, { status: 401 });
    }

    const consumed = await env.DB.prepare(`
      UPDATE auth_nonces SET used_at = CURRENT_TIMESTAMP
      WHERE id = ? AND used_at IS NULL AND expires_at > ?
    `).bind(challengeId, new Date().toISOString()).run();
    if (!consumed.meta.changes) {
      return Response.json({ error: "Yêu cầu đăng nhập đã được sử dụng." }, { status: 409 });
    }

    const existingWallet = await env.DB.prepare("SELECT user_id FROM wallets WHERE address = ?")
      .bind(address).first<{ user_id: string }>();
    const userId = existingWallet?.user_id ?? crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    const sessionToken = randomToken(32);
    const tokenHash = await sha256(sessionToken);
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
    const writes: D1PreparedStatement[] = [];
    if (!existingWallet) {
      writes.push(
        env.DB.prepare("INSERT INTO users (id, profile_kind) VALUES (?, 'student')").bind(userId),
        env.DB.prepare(`
          INSERT INTO wallets (address, user_id, chain) VALUES (?, ?, 'solana:devnet')
        `).bind(address, userId),
      );
    } else {
      writes.push(env.DB.prepare("UPDATE wallets SET last_signed_in_at = CURRENT_TIMESTAMP WHERE address = ?").bind(address));
    }
    writes.push(env.DB.prepare(`
      INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)
    `).bind(sessionId, userId, tokenHash, expiresAt));
    writes.push(auditStatement(env.DB, {
      actorUserId: userId,
      action: "auth.login",
      targetType: "session",
      targetId: sessionId,
      requestId: nonce.request_id,
      metadata: { chain: "solana:devnet", walletAddress: address },
    }));
    await env.DB.batch(writes);

    return Response.json(
      { user: { id: userId, walletAddress: address }, expiresAt },
      { headers: { "set-cookie": sessionCookie(request, sessionToken), "cache-control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}

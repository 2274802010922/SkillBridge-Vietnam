import bs58 from "bs58";
import nacl from "tweetnacl";
import { env } from "@/lib/runtime-env";
import { assertSameOrigin, base64UrlToBytes, jsonError, requireSessionUser, sha256, validSolanaAddress } from "../../../../../lib/auth";
import { requireChallengeManager } from "../../../../../lib/authorization";
import { auditStatement } from "../../../../../lib/audit";

const TERMS_VERSION = "challenge-funding-v1";

type TermsRow = {
  id: string;
  title: string;
  status: string;
  reward_type: string;
  organization_id: string;
  asset: "usdc" | "sol";
  required_display: string;
  required_atomic: string;
  vault_wallet: string;
  sender_wallet: string | null;
  fund_status: string;
  terms_version: string | null;
  terms_hash: string | null;
  terms_signature: string | null;
  terms_signer_wallet: string | null;
  terms_accepted_at: string | null;
  locked_at: string | null;
  refund_policy_state: string | null;
};

async function termsRow(challengeId: string) {
  return env.DB.prepare(`
    SELECT c.id, c.title, c.status, c.reward_type, c.organization_id,
      f.asset, f.required_display, f.required_atomic, f.vault_wallet, f.sender_wallet,
      f.status AS fund_status, f.terms_version, f.terms_hash, f.terms_signature,
      f.terms_signer_wallet, f.terms_accepted_at, f.locked_at, f.refund_policy_state
    FROM challenges c LEFT JOIN challenge_funds f ON f.challenge_id = c.id
    WHERE c.id = ?
  `).bind(challengeId).first<TermsRow>();
}

function buildTermsMessage(row: TermsRow) {
  return [
    "SkillBridge Challenge Funding Agreement",
    `Terms version: ${TERMS_VERSION}`,
    `Challenge ID: ${row.id}`,
    `Challenge title: ${row.title}`,
    `Reward asset: ${row.asset.toUpperCase()}`,
    `Reward vault amount: ${row.required_display}`,
    `Reward vault: ${row.vault_wallet}`,
    "Policy: before publishing, the funding wallet may request a full refund.",
    "Policy: after publishing, the reward vault is locked and cannot be withdrawn unilaterally.",
    "Policy: approved winners are paid first; remaining balance may be refunded only after the challenge is closed and pending reviews or payouts are resolved.",
    "Policy: badge bonds are refundable after the organizer completes the review obligations; abandonment may require a manual decision.",
    "Network: Solana Devnet. Devnet assets have no monetary value.",
  ].join("\n");
}

async function prepare(row: TermsRow) {
  const message = buildTermsMessage(row);
  return { version: TERMS_VERSION, message, hash: await sha256(message) };
}

function summary(row: TermsRow, termsHash: string) {
  return {
    challengeId: row.id,
    challengeTitle: row.title,
    asset: row.asset,
    amount: row.required_display,
    vaultWallet: row.vault_wallet,
    version: TERMS_VERSION,
    hash: termsHash,
    status: row.terms_signature ? "accepted" : "awaiting_signature",
    locked: Boolean(row.locked_at),
    policy: {
      beforePublish: "full_refund_allowed",
      afterPublish: "no_unilateral_refund",
      afterClose: "unused_balance_refundable_after_review_and_payouts",
    },
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser(request);
    const { id } = await params;
    await requireChallengeManager(user.id, id);
    const row = await termsRow(id);
    if (!row || !row.asset || !row.required_display || !row.vault_wallet || !row.fund_status) return Response.json({ error: "Challenge chưa có quỹ để xác nhận điều khoản." }, { status: 409 });
    const terms = await prepare(row);
    return Response.json({ terms: { ...summary(row, terms.hash), acceptedAt: row.terms_accepted_at, signerWallet: row.terms_signer_wallet } }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const { id } = await params;
    const challenge = await requireChallengeManager(user.id, id);
    const row = await termsRow(id);
    if (!row || !row.asset || !row.required_display || !row.vault_wallet || row.fund_status !== "funded") return Response.json({ error: "Chỉ có thể ký điều khoản sau khi quỹ đã được xác minh.", code: "FUNDING_NOT_READY" }, { status: 409 });
    if (row.status !== "draft" || row.locked_at) return Response.json({ error: "Challenge đã công bố hoặc đã khóa, không thể thay đổi điều khoản.", code: "TERMS_LOCKED" }, { status: 409 });
    if (row.sender_wallet !== user.walletAddress) return Response.json({ error: "Chỉ ví đã nạp quỹ mới có thể ký điều khoản.", code: "TERMS_SIGNER_MISMATCH" }, { status: 403 });
    const terms = await prepare(row);
    const body = await request.json() as { action?: "prepare" | "accept"; address?: string; message?: string; signature?: string; termsHash?: string; termsVersion?: string };
    if (body.action === "prepare") return Response.json({ terms: { ...summary(row, terms.hash), message: terms.message } });
    if (body.action !== "accept") return Response.json({ error: "Action điều khoản không hợp lệ.", code: "TERMS_ACTION_INVALID" }, { status: 400 });
    if (!body.address || body.address !== user.walletAddress || !validSolanaAddress(body.address)) return Response.json({ error: "Ví ký điều khoản không khớp phiên đăng nhập.", code: "TERMS_SIGNER_MISMATCH" }, { status: 403 });
    if (body.termsVersion !== terms.version || body.termsHash !== terms.hash || body.message !== terms.message || !body.signature) return Response.json({ error: "Nội dung điều khoản đã thay đổi. Hãy tải lại và ký lại.", code: "TERMS_STALE" }, { status: 409 });
    let signature: Uint8Array;
    try { signature = base64UrlToBytes(body.signature); }
    catch { return Response.json({ error: "Chữ ký điều khoản không hợp lệ.", code: "TERMS_SIGNATURE_INVALID" }, { status: 400 }); }
    const valid = signature.length === nacl.sign.signatureLength && nacl.sign.detached.verify(new TextEncoder().encode(terms.message), signature, bs58.decode(user.walletAddress));
    if (!valid) return Response.json({ error: "Không thể xác minh chữ ký điều khoản bằng ví này.", code: "TERMS_SIGNATURE_INVALID" }, { status: 401 });
    const now = new Date().toISOString();
    const accepted = await env.DB.prepare(`
      UPDATE challenge_funds SET terms_version = ?, terms_hash = ?, terms_signature = ?,
        terms_signer_wallet = ?, terms_accepted_at = ?, refund_policy_state = 'pre_publish', updated_at = CURRENT_TIMESTAMP
      WHERE challenge_id = ? AND status = 'funded' AND locked_at IS NULL
    `).bind(terms.version, terms.hash, body.signature, user.walletAddress, now, id).run();
    if (!accepted.meta.changes) return Response.json({ error: "Quỹ đã được khóa hoặc trạng thái đã thay đổi. Hãy tải lại challenge.", code: "TERMS_LOCKED" }, { status: 409 });
    await auditStatement(env.DB, { actorUserId: user.id, organizationId: challenge.organization_id, action: "challenge.terms_accepted", targetType: "challenge", targetId: id, metadata: { termsVersion: terms.version, termsHash: terms.hash, signerWallet: user.walletAddress } }).run();
    return Response.json({ terms: { ...summary({ ...row, terms_signature: body.signature, terms_hash: terms.hash, terms_version: terms.version, terms_signer_wallet: user.walletAddress, terms_accepted_at: now }, terms.hash), acceptedAt: now, signerWallet: user.walletAddress } });
  } catch (error) { return jsonError(error); }
}

import { env } from "@/lib/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../../../../lib/auth";
import { requireChallengeManager } from "../../../../../../lib/authorization";
import { auditStatement } from "../../../../../../lib/audit";
import { explorerTransaction, verifySolPayment, verifyUsdcPayment } from "../../../../../../lib/payments";

type FundRow = {
  id: string;
  challenge_id: string;
  organization_id: string;
  asset: "usdc" | "sol";
  required_atomic: string;
  vault_wallet: string;
  reference_key: string;
  status: string;
  funding_tx: string | null;
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const { id } = await params;
    const challenge = await requireChallengeManager(user.id, id);
    const body = await request.json() as { signature?: string };
    const signature = body.signature?.trim();
    if (!signature) return Response.json({ error: "Cần transaction signature để xác minh quỹ." }, { status: 400 });
    const fund = await env.DB.prepare(`
      SELECT f.*, c.organization_id
      FROM challenge_funds f JOIN challenges c ON c.id = f.challenge_id
      WHERE f.challenge_id = ?
    `).bind(id).first<FundRow>();
    if (!fund) return Response.json({ error: "Hãy chuẩn bị nạp quỹ trước." }, { status: 404 });
    if (fund.status === "funded") return Response.json({ funding: { id: fund.id, status: "funded", fundingTx: fund.funding_tx, explorerUrl: fund.funding_tx ? explorerTransaction(fund.funding_tx) : null }, reused: true });
    if (fund.status !== "awaiting_payment") return Response.json({ error: "Trạng thái quỹ hiện không thể xác minh." }, { status: 409 });
    const payment = fund.asset === "sol"
      ? await verifySolPayment({ signature, recipientWallet: fund.vault_wallet, expectedAtomic: fund.required_atomic, rpcUrl: env.SOLANA_RPC_URL, expectedReference: fund.reference_key })
      : await verifyUsdcPayment({ signature, recipientWallet: fund.vault_wallet, expectedAtomic: fund.required_atomic, rpcUrl: env.SOLANA_RPC_URL, mint: env.SOLANA_USDC_MINT, expectedReference: fund.reference_key });
    if (payment.senderWallet !== user.walletAddress) return Response.json({ error: "Quỹ phải được nạp từ ví doanh nghiệp đang đăng nhập." }, { status: 403 });
    const duplicate = await env.DB.prepare("SELECT id FROM challenge_funding_events WHERE signature = ?").bind(signature).first();
    if (duplicate) return Response.json({ error: "Transaction này đã được dùng để nạp quỹ." }, { status: 409 });
    await env.DB.batch([
      env.DB.prepare(`
        UPDATE challenge_funds SET status = 'funded', funded_atomic = ?, sender_wallet = ?,
          funding_tx = ?, funded_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status = 'awaiting_payment'
      `).bind(fund.required_atomic, payment.senderWallet, signature, payment.observedAt, fund.id),
      env.DB.prepare(`
        INSERT INTO challenge_funding_events
          (id, challenge_fund_id, signature, sender_wallet, recipient_wallet, amount_atomic, asset, observed_at, raw_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(crypto.randomUUID(), fund.id, signature, payment.senderWallet, fund.vault_wallet, payment.amountAtomic, fund.asset, payment.observedAt, JSON.stringify({ reference: fund.reference_key })),
      env.DB.prepare("UPDATE challenges SET funding_status = 'funded', funded_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(payment.observedAt, id),
      auditStatement(env.DB, {
        actorUserId: user.id, organizationId: challenge.organization_id, action: "challenge.funding_verified",
        targetType: "challenge", targetId: id,
        metadata: { fundId: fund.id, asset: fund.asset, signature, amountAtomic: payment.amountAtomic, vaultWallet: fund.vault_wallet },
      }),
    ]);
    return Response.json({ funding: { id: fund.id, status: "funded", fundingTx: signature, explorerUrl: explorerTransaction(signature) } });
  } catch (error) { return jsonError(error); }
}

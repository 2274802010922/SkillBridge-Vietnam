import { assertEscrowDevnet } from "../../../../solana/client/challenge-escrow";
import type { MilestoneIntent } from "../../../services/payments/milestone-payment";
import { address, createSolanaClient, createTransaction, insertReferenceKeyToTransactionMessage, transactionToBase64 } from "gill";
import { getAssociatedTokenAccountAddress, getTransferTokensInstructions } from "gill/programs/token";
import { env } from "@/backend/config/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../auth/auth";
import { requireOrganizationRole } from "../../../auth/authorization";
import { buildCashoutTransferTransaction } from "../../../services/cashout/cashout";
import { readFundingSnapshot } from "../../../services/cashout/offramp-snapshot";
import { ensureProviderOrder } from "../../../services/cashout/offramp-operations";
import type { CashoutRow } from "../../../services/cashout/cashout-record";
import { buildRewardFundingTransaction, type RewardAsset } from "../../../../solana/server/reward-vault";

/** Build an unsigned USDC transfer. The connected wallet signs and sends it in the browser. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await request.json() as { milestoneId?: string; invoiceId?: string; payoutSubmissionId?: string; fundingChallengeId?: string; cashoutId?: string; senderWallet?: string };
    if ((!body.invoiceId && !body.payoutSubmissionId && !body.fundingChallengeId && !body.cashoutId && !body.milestoneId) || !body.senderWallet?.trim()) return Response.json({ error: "Thiếu thông tin giao dịch." }, { status: 400 });
    if (body.fundingChallengeId) {
      const user = await requireSessionUser(request);
      if (user.walletAddress !== body.senderWallet.trim()) return Response.json({ error: "Ví nạp quỹ phải là ví đang đăng nhập." }, { status: 403 });
      const fund = await env.DB.prepare(`
        SELECT f.id, f.asset, f.required_display, f.required_atomic, f.reference_key, f.vault_wallet,
          f.status, c.organization_id
        FROM challenge_funds f JOIN challenges c ON c.id = f.challenge_id
        WHERE f.challenge_id = ?
      `).bind(body.fundingChallengeId).first<{ id: string; asset: RewardAsset; required_display: string; required_atomic: string; reference_key: string; vault_wallet: string; status: string; organization_id: string }>();
      if (!fund) return Response.json({ error: "Không tìm thấy yêu cầu nạp quỹ challenge." }, { status: 404 });
      await requireOrganizationRole(user.id, fund.organization_id, ["business_admin", "challenge_manager"], "business");
      if (fund.status !== "awaiting_payment") return Response.json({ error: "Quỹ này đã được nạp hoặc không còn hiệu lực." }, { status: 409 });
      const funding = await buildRewardFundingTransaction(env, {
        senderWallet: body.senderWallet.trim(), asset: fund.asset,
        amount: { display: fund.required_display, atomic: fund.required_atomic }, reference: fund.reference_key,
      });
      return Response.json({
        transaction: funding.transaction, asset: fund.asset, amount: fund.required_display,
        recipientWallet: funding.vaultWallet, reference: fund.reference_key, purpose: "challenge_funding",
      });
    }
    if (body.cashoutId) {
      const user = await requireSessionUser(request);
      const senderWallet = body.senderWallet.trim();
      if (user.walletAddress !== senderWallet) return Response.json({ error: "Ví gửi USDC phải là ví đang đăng nhập." }, { status: 403 });
      const order = await env.DB.prepare(`
        SELECT *
        FROM cashout_sessions WHERE id = ? AND user_id = ?
      `).bind(body.cashoutId, user.id).first<CashoutRow>();
      if (!order) return Response.json({ error: "Không tìm thấy lệnh rút tiền." }, { status: 404 });
      if (order.payment_tx || order.submitted_tx) return Response.json({ error: "Lệnh đã có transaction. Hãy xác minh lại, không gửi thêm USDC." }, { status: 409 });
      if (order.status !== "awaiting_wallet_signature") return Response.json({ error: "Hãy xác nhận báo giá trước khi ký giao dịch." }, { status: 409 });
      const snapshot = readFundingSnapshot(order);
      if (new Date(snapshot.fundingDeadline).getTime() <= Date.now()) {
        await env.DB.prepare("UPDATE cashout_sessions SET status = 'quote_expired', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'awaiting_wallet_signature' AND payment_tx IS NULL AND submitted_tx IS NULL").bind(order.id).run();
        return Response.json({ error: "Báo giá đã hết hạn. Hãy tạo báo giá mới.", code: "QUOTE_EXPIRED" }, { status: 409 });
      }
      if (!order.settlement_wallet || !order.reference_key) return Response.json({ error: "Off-ramp Devnet chưa được cấu hình." }, { status: 503 });
      await ensureProviderOrder(env.DB, snapshot);
      const transaction = await buildCashoutTransferTransaction({ ...env, SOLANA_USDC_MINT: snapshot.mint }, {
        senderWallet, settlementWallet: order.settlement_wallet, amountAtomic: order.amount_atomic, reference: order.reference_key,
      });
      return Response.json({
        transaction, amountUsdc: order.amount_usdc, recipientWallet: order.settlement_wallet,
        network: snapshot.network, mint: snapshot.mint, amountAtomic: snapshot.amountAtomic, fundingDeadline: snapshot.fundingDeadline,
        reference: order.reference_key, purpose: "cashout_devnet_deposit",
      });
    }
    let payment: { mint?:string; id: string; recipient_wallet: string; amount_usdc: string; amount_atomic: string; payment_reference: string; status: string };
    if(body.milestoneId){
      const user=await requireSessionUser(request);
      const m=await env.DB.prepare("SELECT m.*,c.organization_id,c.status AS contract_status,i.snapshot_json FROM contract_milestones m JOIN freelance_contracts c ON c.id=m.contract_id JOIN milestone_payment_intents i ON i.milestone_id=m.id WHERE m.id=?").bind(body.milestoneId).first<{id:string;organization_id:string;status:string;contract_status:string;amount_usdc:string;amount_atomic:string;snapshot_json:string}>();
      if(!m)throw new Response("Milestone cũ chưa có yêu cầu thanh toán; dùng xác minh giao dịch cũ.",{status:409});
      await requireOrganizationRole(user.id,m.organization_id,["business_admin","challenge_manager"],"business");
      const intent=JSON.parse(m.snapshot_json) as MilestoneIntent;
      if(m.status!=="approved"||m.contract_status!=="active")throw new Response("Milestone chưa sẵn sàng thanh toán.",{status:409});
      if(user.walletAddress!==intent.sender||body.senderWallet!==intent.sender)throw new Response("Dùng đúng ví trả tiền trong hợp đồng.",{status:403});
      await assertEscrowDevnet(env.SOLANA_RPC_URL||"https://api.devnet.solana.com");
      payment={mint:intent.mint,id:m.id,recipient_wallet:intent.recipient,amount_usdc:m.amount_usdc,amount_atomic:intent.amountAtomic,payment_reference:intent.reference!,status:"sent"};
    }else if (body.invoiceId) {
      const invoice = await env.DB.prepare("SELECT id, recipient_wallet, amount_usdc, amount_atomic, payment_reference, status FROM invoices WHERE id = ?").bind(body.invoiceId).first<typeof payment>();
      if (!invoice) return Response.json({ error: "Invoice không tồn tại." }, { status: 404 });
      if (invoice.status === "paid" || invoice.status === "cancelled") return Response.json({ error: "Invoice đã kết thúc." }, { status: 409 });
      payment = invoice;
    } else {
      const user = await requireSessionUser(request);
      if (user.walletAddress !== body.senderWallet.trim()) return Response.json({ error: "Ví thanh toán phải là ví đang đăng nhập." }, { status: 403 });
      const payout = await env.DB.prepare(`SELECT s.id, c.organization_id, c.reward_amount_usdc AS amount_usdc, c.reward_amount_atomic AS amount_atomic, c.reward_mint, p.student_user_id, w.address AS recipient_wallet, cp.status FROM submissions s JOIN participations p ON p.id=s.participation_id JOIN challenges c ON c.id=p.challenge_id JOIN wallets w ON w.user_id=p.student_user_id JOIN assessments a ON a.submission_id=s.id LEFT JOIN challenge_payouts cp ON cp.submission_id=s.id WHERE s.id=? AND a.status='approved'`).bind(body.payoutSubmissionId).first<{id:string;organization_id:string;amount_usdc:string|null;amount_atomic:string|null;student_user_id:string;recipient_wallet:string;status:string|null}>();
      if (!payout) return Response.json({ error: "Bài nộp không đủ điều kiện payout." }, { status: 404 });
      await requireOrganizationRole(user.id, payout.organization_id, ["business_admin", "challenge_manager"], "business");
      if (!payout.amount_atomic || !payout.amount_usdc) return Response.json({ error: "Challenge chưa cấu hình USDC." }, { status: 409 });
      if (payout.status === "paid") return Response.json({ error: "Payout đã hoàn tất." }, { status: 409 });
      payment = { id: payout.id, recipient_wallet: payout.recipient_wallet, amount_usdc: payout.amount_usdc, amount_atomic: payout.amount_atomic, payment_reference: payout.id, status: "sent" };
    }
    const sender = address(body.senderWallet.trim());
    const recipient = address(payment.recipient_wallet);
    const mint = address(payment.mint || env.SOLANA_USDC_MINT);
    const tokenProgram = undefined;
    const sourceAta = await getAssociatedTokenAccountAddress(mint, sender, tokenProgram);
    const destinationAta = await getAssociatedTokenAccountAddress(mint, recipient, tokenProgram);
    const solana = createSolanaClient({ urlOrMoniker: (env.SOLANA_RPC_URL || "devnet") as "devnet" });
    const { value: latestBlockhash } = await solana.rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
    const instructions = getTransferTokensInstructions({ feePayer: sender, mint, authority: sender, sourceAta, destination: recipient, destinationAta, amount: BigInt(payment.amount_atomic), tokenProgram });
    const transaction = createTransaction({ version: "legacy", feePayer: sender, instructions, latestBlockhash });
    const withReference = (body.invoiceId || body.milestoneId) ? insertReferenceKeyToTransactionMessage(address(payment.payment_reference), transaction) : transaction;
    return Response.json({ transaction: transactionToBase64(withReference), amountUsdc: payment.amount_usdc, recipientWallet: payment.recipient_wallet, reference: payment.payment_reference });
  } catch (error) { return jsonError(error); }
}

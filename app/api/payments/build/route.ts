import { address, createSolanaClient, createTransaction, insertReferenceKeyToTransactionMessage, transactionToBase64 } from "gill";
import { getAssociatedTokenAccountAddress, getTransferTokensInstructions } from "gill/programs/token";
import { env } from "@/lib/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../../lib/auth";
import { requireOrganizationRole } from "../../../../lib/authorization";

/** Build an unsigned USDC transfer. The connected wallet signs and sends it in the browser. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await request.json() as { invoiceId?: string; payoutSubmissionId?: string; senderWallet?: string };
    if ((!body.invoiceId && !body.payoutSubmissionId) || !body.senderWallet?.trim()) return Response.json({ error: "Thiếu thông tin giao dịch." }, { status: 400 });
    let payment: { id: string; recipient_wallet: string; amount_usdc: string; amount_atomic: string; payment_reference: string; status: string };
    if (body.invoiceId) {
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
    const mint = address(env.SOLANA_USDC_MINT);
    const tokenProgram = undefined;
    const sourceAta = await getAssociatedTokenAccountAddress(mint, sender, tokenProgram);
    const destinationAta = await getAssociatedTokenAccountAddress(mint, recipient, tokenProgram);
    const solana = createSolanaClient({ urlOrMoniker: (env.SOLANA_RPC_URL || "devnet") as "devnet" });
    const { value: latestBlockhash } = await solana.rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
    const instructions = getTransferTokensInstructions({ feePayer: sender, mint, authority: sender, sourceAta, destination: recipient, destinationAta, amount: BigInt(payment.amount_atomic), tokenProgram });
    const transaction = createTransaction({ version: "legacy", feePayer: sender, instructions, latestBlockhash });
    const withReference = body.invoiceId ? insertReferenceKeyToTransactionMessage(address(payment.payment_reference), transaction) : transaction;
    return Response.json({ transaction: transactionToBase64(withReference), amountUsdc: payment.amount_usdc, recipientWallet: payment.recipient_wallet, reference: payment.payment_reference });
  } catch (error) { return jsonError(error); }
}

import { env } from "@/lib/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../../lib/auth";
import { auditStatement } from "../../../../lib/audit";
import { explorerTransaction, formatUsdcAtomic, verifyUsdcPayment } from "../../../../lib/payments";

type InvoiceRow = {
  id: string;
  creator_user_id: string;
  client_name: string;
  client_email: string | null;
  description: string;
  amount_usdc: string;
  amount_atomic: string;
  fiat_currency: string;
  fiat_amount: string;
  fx_rate_vnd: string | null;
  fx_rate_source: string | null;
  fx_captured_at: string | null;
  recipient_wallet: string;
  payment_reference: string;
  status: string;
  due_at: string | null;
  paid_atomic: string;
  paid_at: string | null;
  paid_tx: string | null;
  created_at: string;
  updated_at: string;
};

async function ownedInvoice(userId: string, id: string) {
  return env.DB.prepare("SELECT * FROM invoices WHERE id = ? AND creator_user_id = ?").bind(id, userId).first<InvoiceRow>();
}

function serializeInvoice(row: InvoiceRow, events: Array<Record<string, unknown>>, origin: string) {
  return { ...row, events, pay_url: `${origin}/invoice/${row.id}`, solana_pay_url: `solana:${row.recipient_wallet}?amount=${encodeURIComponent(row.amount_usdc)}&spl-token=${encodeURIComponent(env.SOLANA_USDC_MINT)}&reference=${encodeURIComponent(row.payment_reference)}`, explorer_url: row.paid_tx ? explorerTransaction(row.paid_tx) : null, paid_usdc: formatUsdcAtomic(row.paid_atomic) };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser(request);
    const { id } = await params;
    const invoice = await ownedInvoice(user.id, id);
    if (!invoice) return Response.json({ error: "Invoice không tồn tại." }, { status: 404 });
    const events = await env.DB.prepare("SELECT id, signature, sender_wallet, recipient_wallet, amount_atomic, status, observed_at, created_at FROM payment_events WHERE invoice_id = ? ORDER BY created_at DESC").bind(id).all();
    return Response.json({ invoice: serializeInvoice(invoice, events.results, new URL(request.url).origin) }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const { id } = await params;
    const invoice = await ownedInvoice(user.id, id);
    if (!invoice) return Response.json({ error: "Invoice không tồn tại." }, { status: 404 });
    const body = await request.json() as { action?: string };
    if (body.action !== "cancel") return Response.json({ error: "Thao tác không hợp lệ." }, { status: 400 });
    if (["paid", "cancelled"].includes(invoice.status)) return Response.json({ error: "Invoice đã chốt trạng thái." }, { status: 409 });
    await env.DB.batch([
      env.DB.prepare("UPDATE invoices SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id),
      auditStatement(env.DB, { actorUserId: user.id, action: "invoice.cancelled", targetType: "invoice", targetId: id }),
    ]);
    return Response.json({ invoice: { id, status: "cancelled" } });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const { id } = await params;
    const invoice = await ownedInvoice(user.id, id);
    if (!invoice) return Response.json({ error: "Invoice không tồn tại." }, { status: 404 });
    if (invoice.status === "cancelled") return Response.json({ error: "Invoice đã bị hủy." }, { status: 409 });
    const body = await request.json() as { signature?: string };
    const signature = body.signature?.trim() ?? "";
    if (!signature) return Response.json({ error: "Cần transaction signature để xác minh." }, { status: 400 });
    const duplicate = await env.DB.prepare("SELECT id FROM payment_events WHERE signature = ?").bind(signature).first();
    if (duplicate) return Response.json({ error: "Transaction này đã được ghi nhận." }, { status: 409 });
    const payment = await verifyUsdcPayment({ signature, recipientWallet: invoice.recipient_wallet, expectedAtomic: invoice.amount_atomic, rpcUrl: env.SOLANA_RPC_URL, mint: env.SOLANA_USDC_MINT, expectedReference: invoice.payment_reference });
    const paidAtomic = payment.amountAtomic;
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO payment_events (id, invoice_id, signature, sender_wallet, recipient_wallet, amount_atomic, status, observed_at, raw_json) VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)`)
        .bind(crypto.randomUUID(), id, signature, payment.senderWallet, payment.recipientWallet, payment.amountAtomic, payment.observedAt, JSON.stringify({ blockTime: payment.blockTime, mint: env.SOLANA_USDC_MINT })),
      env.DB.prepare(`UPDATE invoices SET status = 'paid', paid_atomic = ?, paid_at = ?, paid_tx = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(paidAtomic, payment.observedAt, signature, id),
      auditStatement(env.DB, { actorUserId: user.id, action: "invoice.payment_verified", targetType: "invoice", targetId: id, metadata: { signature, amountUsdc: formatUsdcAtomic(paidAtomic), senderWallet: payment.senderWallet } }),
    ]);
    return Response.json({ payment: { ...payment, amountUsdc: formatUsdcAtomic(paidAtomic), explorerUrl: explorerTransaction(signature) }, invoice: { id, status: "paid", paidAtomic, paidUsdc: formatUsdcAtomic(paidAtomic) } });
  } catch (error) { return jsonError(error); }
}

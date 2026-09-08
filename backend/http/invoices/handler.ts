import { env } from "@/backend/config/runtime-env";
import bs58 from "bs58";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../auth/auth";
import { auditStatement } from "../../services/audit/audit";
import { parseUsdcAmount, solanaPayUrl } from "../../../solana/server/payments";

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
  payment_count: number;
};

function presentInvoice(row: InvoiceRow, origin: string) {
  return { ...row, pay_url: `${origin}/invoice/${row.id}`, solana_pay_url: solanaPayUrl({ recipientWallet: row.recipient_wallet, amountUsdc: row.amount_usdc, reference: row.payment_reference, mint: env.SOLANA_USDC_MINT }), explorer_url: row.paid_tx ? `https://explorer.solana.com/tx/${encodeURIComponent(row.paid_tx)}?cluster=devnet` : null };
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const rows = await env.DB.prepare(`
      SELECT i.*, (SELECT COUNT(*) FROM payment_events p WHERE p.invoice_id = i.id) AS payment_count
      FROM invoices i WHERE i.creator_user_id = ? ORDER BY i.created_at DESC
    `).bind(user.id).all<InvoiceRow>();
    const invoices = rows.results.map((row) => presentInvoice(row, new URL(request.url).origin));
    if (new URL(request.url).searchParams.get("format") === "csv") {
      const header = ["invoice_id", "client_name", "description", "amount_usdc", "fiat_currency", "fiat_amount", "status", "due_at", "paid_at", "paid_tx", "created_at"];
      const body = [header, ...invoices.map((row) => [row.id, row.client_name, row.description, row.amount_usdc, row.fiat_currency, row.fiat_amount, row.status, row.due_at, row.paid_at, row.paid_tx, row.created_at])].map((line) => line.map(csvCell).join(",")).join("\n");
      return new Response(`${body}\n`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=skillbridge-invoices.csv", "cache-control": "private, no-store" } });
    }
    return Response.json({ invoices }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const body = await request.json() as { clientName?: string; clientEmail?: string; description?: string; amountUsdc?: string; fiatAmount?: string; fxRateVnd?: string; dueAt?: string };
    const clientName = body.clientName?.trim() ?? "";
    const description = body.description?.trim() ?? "";
    const amount = parseUsdcAmount(body.amountUsdc ?? "");
    const fiatAmount = body.fiatAmount?.trim() || amount?.display || "";
    const fxRateVnd = body.fxRateVnd?.trim() || null;
    if (clientName.length < 2 || clientName.length > 140) return Response.json({ error: "Tên khách hàng cần từ 2 đến 140 ký tự." }, { status: 400 });
    if (description.length < 3 || description.length > 2000) return Response.json({ error: "Mô tả dịch vụ cần từ 3 đến 2.000 ký tự." }, { status: 400 });
    if (!amount) return Response.json({ error: "Số tiền USDC không hợp lệ (tối đa 6 chữ số thập phân)." }, { status: 400 });
    if (fxRateVnd && (!/^\d+(?:\.\d{1,2})?$/.test(fxRateVnd) || Number(fxRateVnd) <= 0)) return Response.json({ error: "Tỷ giá VND không hợp lệ." }, { status: 400 });
    if (body.dueAt && Number.isNaN(Date.parse(body.dueAt))) return Response.json({ error: "Hạn thanh toán không hợp lệ." }, { status: 400 });
    const id = crypto.randomUUID();
    // Solana Pay references must be valid public-key-shaped base58 values.
    const reference = bs58.encode(crypto.getRandomValues(new Uint8Array(32)));
    const now = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO invoices (id, creator_user_id, client_name, client_email, description, amount_usdc, amount_atomic, fiat_currency, fiat_amount, fx_rate_vnd, fx_rate_source, fx_captured_at, recipient_wallet, payment_reference, status, due_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?, ?, ?, 'sent', ?)`)
        .bind(id, user.id, clientName, body.clientEmail?.trim() || null, description, amount.display, amount.atomic, fiatAmount, fxRateVnd, fxRateVnd ? "manual_snapshot" : null, fxRateVnd ? now : null, user.walletAddress, reference, body.dueAt || null),
      auditStatement(env.DB, { actorUserId: user.id, action: "invoice.created", targetType: "invoice", targetId: id, metadata: { amountUsdc: amount.display, clientName, reference } }),
    ]);
    return Response.json({ invoice: { id, clientName, description, amountUsdc: amount.display, amountAtomic: amount.atomic, fiatAmount, fxRateVnd, recipientWallet: user.walletAddress, paymentReference: reference, status: "sent", dueAt: body.dueAt || null, payUrl: `${new URL(request.url).origin}/invoice/${id}` } }, { status: 201 });
  } catch (error) { return jsonError(error); }
}

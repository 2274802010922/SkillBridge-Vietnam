import { notFound } from "next/navigation";
import { env } from "@/backend/config/runtime-env";
import { ensureCoreSchema } from "../../../backend/database/schema/core-schema";
import { InvoicePayment } from "../../../frontend/features/invoices/invoice-payment";

export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureCoreSchema(env.DB);
  const invoice = await env.DB.prepare(`SELECT id, client_name, description, amount_usdc, fiat_currency, fiat_amount, recipient_wallet, payment_reference, status, due_at, created_at FROM invoices WHERE id = ?`).bind(id).first<{ id: string; client_name: string; description: string; amount_usdc: string; fiat_currency: string; fiat_amount: string; recipient_wallet: string; payment_reference: string; status: string; due_at: string | null; created_at: string }>();
  if (!invoice) notFound();
  return <InvoicePayment invoice={invoice} mint={env.SOLANA_USDC_MINT} />;
}

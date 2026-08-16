"use client";

import { useState } from "react";
import Link from "next/link";
import { LanguageSwitcher, useLanguage } from "./i18n";

type Invoice = { id: string; client_name: string; description: string; amount_usdc: string; fiat_currency: string; fiat_amount: string; recipient_wallet: string; payment_reference: string; status: string; due_at: string | null; created_at: string };

export function InvoicePayment({ invoice, mint }: { invoice: Invoice; mint: string }) {
  const { t } = useLanguage();
  const [notice, setNotice] = useState<string | null>(null);
  const params = new URLSearchParams({ amount: invoice.amount_usdc, "spl-token": mint, reference: invoice.payment_reference, label: "SkillBridge", message: `Thanh toán invoice ${invoice.payment_reference}` });
  const payUri = `solana:${invoice.recipient_wallet}?${params.toString()}`;
  async function copy(value: string) { await navigator.clipboard.writeText(value); setNotice(t("invoice.copyLink")); }
  return <main className="invoice-public-page"><header className="auth-header page-shell"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>SkillBridge</span><small>VIETNAM</small></Link><div className="topbar-actions"><LanguageSwitcher /><Link className="text-link" href="/">{t("common.home")}</Link></div></header><section className="invoice-public-shell page-shell"><div className="invoice-public-copy"><span className="eyebrow"><span />{t("invoice.kicker")}</span><h1>{t("invoice.publicTitle")}</h1><p>{t("invoice.publicDescription")}</p><div className="invoice-devnet-notice">{t("invoice.devnetNotice")}</div></div><article className="invoice-public-card"><div className="entity-top"><span>{invoice.client_name}</span><b>{invoice.status === "paid" ? t("invoice.paid") : t("invoice.sent")}</b></div><h2>{invoice.description}</h2><div className="invoice-public-amount"><strong>{invoice.amount_usdc}</strong><span>USDC</span><small>≈ {invoice.fiat_amount} {invoice.fiat_currency}</small></div><dl><div><dt>{t("invoice.reference")}</dt><dd>{invoice.payment_reference}</dd></div><div><dt>{t("invoice.recipient")}</dt><dd><code>{invoice.recipient_wallet}</code></dd></div></dl><div className="invoice-public-actions"><a className="button button-primary" href={payUri}>{t("invoice.openWallet")}</a><button className="button button-dark" onClick={() => void copy(invoice.recipient_wallet)}>{t("invoice.copyRecipient")}</button><button className="button button-secondary" onClick={() => void copy(payUri)}>{t("invoice.copyUri")}</button></div><p className="invoice-public-footnote">{t("invoice.publicFootnote")}</p></article></section>{notice && <p className="app-notice invoice-public-notice" role="status">{notice}</p>}</main>;
}

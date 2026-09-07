"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "./i18n";
import { ContentSkeleton, LoadFailure } from "./loading-ui";

type Invoice = {
  id: string;
  client_name: string;
  client_email: string | null;
  description: string;
  amount_usdc: string;
  fiat_currency: string;
  fiat_amount: string;
  fx_rate_vnd: string | null;
  recipient_wallet: string;
  payment_reference: string;
  status: string;
  due_at: string | null;
  paid_atomic: string;
  paid_at: string | null;
  paid_tx: string | null;
  payment_count: number;
  pay_url: string;
  solana_pay_url?: string;
  explorer_url?: string | null;
};

function statusLabel(t: (key: "invoice.paid" | "invoice.sent" | "invoice.cancelled") => string, status: string) {
  if (status === "paid") return t("invoice.paid");
  if (status === "cancelled") return t("invoice.cancelled");
  return t("invoice.sent");
}

export function InvoicesWorkspace() {
  const { t } = useLanguage();
  const [items, setItems] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [description, setDescription] = useState("");
  const [amountUsdc, setAmountUsdc] = useState("");
  const [fiatAmount, setFiatAmount] = useState("");
  const [fxRateVnd, setFxRateVnd] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [signatures, setSignatures] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/invoices", { cache: "no-store" });
    if (response.ok) setItems(((await response.json()) as { invoices: Invoice[] }).invoices);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/invoices", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<{ invoices: Invoice[] }> : Promise.reject(new Error("load"))).then((data) => { if (active) setItems(data.invoices); }).catch(() => { if (active) setLoadError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function create() {
    setBusy(true); setNotice(null);
    const response = await fetch("/api/invoices", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientName, clientEmail, description, amountUsdc, fiatAmount, fxRateVnd, dueAt: dueAt || undefined }) });
    const data = await response.json() as { error?: string };
    setNotice(response.ok ? t("invoice.created") : data.error ?? t("invoice.error"));
    if (response.ok) { setClientName(""); setClientEmail(""); setDescription(""); setAmountUsdc(""); setFiatAmount(""); setFxRateVnd(""); setDueAt(""); await load(); }
    setBusy(false);
  }

  async function verify(id: string) {
    const signature = signatures[id]?.trim();
    if (!signature) { setNotice(t("invoice.signaturePlaceholder")); return; }
    setBusy(true); setNotice(null);
    const response = await fetch(`/api/invoices/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ signature }) });
    const data = await response.json() as { error?: string };
    setNotice(response.ok ? t("invoice.verified") : data.error ?? t("invoice.error"));
    if (response.ok) await load();
    setBusy(false);
  }

  async function cancel(id: string) {
    setBusy(true); setNotice(null);
    const response = await fetch(`/api/invoices/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "cancel" }) });
    const data = await response.json() as { error?: string };
    setNotice(response.ok ? t("invoice.cancelled") : data.error ?? t("invoice.error"));
    if (response.ok) await load();
    setBusy(false);
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setNotice(t("invoice.copyLink"));
  }

  const paidCount = useMemo(() => items.filter((item) => item.status === "paid").length, [items]);

  if (loading) return <div id="workspace-main" tabIndex={-1} className="workspace-product-content"><ContentSkeleton delayed variant="finance" /></div>;
  if (loadError) return <div id="workspace-main" tabIndex={-1} className="workspace-product-content"><LoadFailure /></div>;
  return <div id="workspace-main" tabIndex={-1} className="workspace-product-content">
    <div className="app-welcome"><div><span>{t("invoice.kicker")}</span><h1>{t("invoice.title")}</h1><p>{t("invoice.description")}</p></div><div className="identity-card"><small>{t("invoice.count")}</small><strong className="metric-number">{items.length}</strong><b>{paidCount} {t("invoice.paidCount")}</b></div></div>
    <section className="app-panel invoice-builder">
      <div><span className="panel-kicker">{t("invoice.create")}</span><h2>{t("invoice.create")}</h2><p>{t("invoice.createDescription")}</p></div>
      <div className="stack-form invoice-form">
        <div className="invoice-form-grid"><label>{t("invoice.clientName")}<input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder={t("invoice.clientPlaceholder")} /></label><label>{t("invoice.clientEmail")}<input type="email" value={clientEmail} onChange={(event) => setClientEmail(event.target.value)} placeholder="client@example.com" /></label></div>
        <label>{t("invoice.descriptionLabel")}<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t("invoice.descriptionPlaceholder")} /></label>
        <div className="invoice-form-grid"><label>{t("invoice.amount")}<input inputMode="decimal" value={amountUsdc} onChange={(event) => setAmountUsdc(event.target.value)} placeholder="250" /></label><label>{t("invoice.fiatAmount")}<input inputMode="decimal" value={fiatAmount} onChange={(event) => setFiatAmount(event.target.value)} placeholder="250" /></label><label>{t("invoice.fxRate")}<input inputMode="decimal" value={fxRateVnd} onChange={(event) => setFxRateVnd(event.target.value)} placeholder="25,000" /></label><label>{t("invoice.dueAt")}<input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label></div>
        <button className="button button-primary" disabled={busy || !clientName.trim() || !description.trim() || !amountUsdc.trim()} onClick={create}>{t("invoice.submit")}</button>
      </div>
    </section>
    <div className="invoice-toolbar"><button className="text-link" type="button" onClick={() => window.open("/api/invoices?format=csv", "_blank", "noopener,noreferrer")}>{t("invoice.report")}</button><span>{t("invoice.devnetNotice")}</span></div>
    {items.length === 0 ? <section className="app-panel empty-product"><h2>{t("invoice.empty")}</h2><p>{t("invoice.emptyDescription")}</p></section> : <section className="invoice-list">{items.map((item) => <article className={`invoice-card ${item.status}`} key={item.id}><div className="entity-top"><span>{item.client_name}</span><b>{statusLabel(t, item.status)}</b></div><h2>{item.description}</h2><div className="invoice-amount"><strong>{item.amount_usdc}</strong><span>USDC</span><small>≈ {item.fiat_amount} {item.fiat_currency}</small></div><dl><div><dt>{t("invoice.reference")}</dt><dd>{item.payment_reference}</dd></div><div><dt>{t("invoice.recipient")}</dt><dd>{item.recipient_wallet.slice(0, 8)}…{item.recipient_wallet.slice(-6)}</dd></div></dl><div className="invoice-actions"><button className="button button-dark" onClick={() => void copy(item.pay_url)}>{t("invoice.copyLink")}</button><button className="button button-secondary" onClick={() => void copy(item.solana_pay_url ?? item.pay_url)}>{t("invoice.copyUri")}</button>{item.status !== "paid" && item.status !== "cancelled" && <button className="text-button danger" onClick={() => void cancel(item.id)}>{t("invoice.cancel")}</button>}</div>{item.status !== "paid" && item.status !== "cancelled" && <div className="invoice-verify"><label>{t("invoice.signature")}<input value={signatures[item.id] ?? ""} onChange={(event) => setSignatures((current) => ({ ...current, [item.id]: event.target.value }))} placeholder={t("invoice.signaturePlaceholder")} /></label><button className="button button-primary" disabled={busy || !signatures[item.id]?.trim()} onClick={() => void verify(item.id)}>{t("invoice.verifyPayment")}</button></div>}{item.paid_tx && <a className="chain-proof-link" href={item.explorer_url ?? undefined} target="_blank" rel="noreferrer">{t("invoice.verified")}</a>}</article>)}</section>}
    {notice && <p className="app-notice" role="status">{notice}</p>}
  </div>;
}

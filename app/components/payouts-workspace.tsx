"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "./i18n";
import { WalletPaymentButton } from "./wallet-payment-button";

type Payout = { challenge_id: string; challenge_title: string; organization_name: string; reward_amount_usdc: string; submission_id: string; submission_state: string; student_name: string | null; recipient_wallet: string; assessment_status: string; payout_id: string | null; payout_status: string | null; payment_tx: string | null; paid_at: string | null };

export function PayoutsWorkspace() {
  const { t } = useLanguage();
  const [items, setItems] = useState<Payout[]>([]);
  const [signatures, setSignatures] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  async function load() { const response = await fetch("/api/payouts", { cache: "no-store" }); if (response.ok) setItems(((await response.json()) as { payouts: Payout[] }).payouts); }
  useEffect(() => { let active = true; fetch("/api/payouts", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<{ payouts: Payout[] }> : { payouts: [] }).then((data) => { if (active) setItems(data.payouts); }); return () => { active = false; }; }, []);
  async function verify(item: Payout) {
    const signature = signatures[item.submission_id]?.trim(); if (!signature) return;
    setBusy(true); setNotice(null);
    const response = await fetch("/api/payouts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ submissionId: item.submission_id, signature }) });
    const data = await response.json() as { error?: string }; setNotice(response.ok ? t("payout.verified") : data.error ?? t("invoice.error")); if (response.ok) await load(); setBusy(false);
  }
  async function payInPage(item: Payout, signature: string) {
    const response = await fetch("/api/payouts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ submissionId: item.submission_id, signature }) });
    const data = await response.json() as { error?: string }; setNotice(response.ok ? t("payout.verified") : data.error ?? t("invoice.error")); if (response.ok) await load();
  }
  const paidCount = useMemo(() => items.filter((item) => item.payout_status === "paid").length, [items]);
  return <div className="workspace-product-content">
    <div className="app-welcome"><div><span>{t("payout.kicker")}</span><h1>{t("payout.title")}</h1><p>{t("payout.description")}</p></div><div className="identity-card"><small>{t("payout.count")}</small><strong className="metric-number">{items.length}</strong><b>{paidCount} {t("payout.paidCount")}</b></div></div>
    <div className="app-notice payout-notice">{t("payout.directNotice")}</div>
    {items.length === 0 ? <section className="app-panel empty-product"><h2>{t("payout.empty")}</h2><p>{t("payout.emptyDescription")}</p></section> : <section className="payout-list">{items.map((item) => <article className={`payout-card ${item.payout_status ?? "pending"}`} key={item.submission_id}>
      <div className="entity-top"><span>{item.organization_name}</span><b>{item.payout_status === "paid" ? t("invoice.paid") : t("status.waiting")}</b></div><h2>{item.challenge_title}</h2><p>{item.student_name || `${item.recipient_wallet.slice(0, 8)}…${item.recipient_wallet.slice(-6)}`}</p><div className="payout-amount"><strong>{item.reward_amount_usdc}</strong><span>USDC</span></div>
      <dl><div><dt>{t("payout.recipient")}</dt><dd>{item.recipient_wallet.slice(0, 10)}…{item.recipient_wallet.slice(-8)}</dd></div><div><dt>{t("invoice.reference")}</dt><dd>{item.submission_id.slice(0, 12)}…</dd></div></dl>
      {item.payout_status === "paid" ? <a className="chain-proof-link" href={`https://explorer.solana.com/tx/${item.payment_tx}?cluster=devnet`} target="_blank" rel="noreferrer">{t("payout.verified")}</a> : <div className="payout-verify"><WalletPaymentButton payoutSubmissionId={item.submission_id} onSubmitted={(signature) => payInPage(item, signature)} label={t("payout.payInPage")} /><details><summary>{t("payout.manualFallback")}</summary><label>{t("payout.signature")}<input value={signatures[item.submission_id] ?? ""} onChange={(event) => setSignatures((current) => ({ ...current, [item.submission_id]: event.target.value }))} placeholder={t("payout.signaturePlaceholder")} /></label><button className="button button-secondary" disabled={busy || !signatures[item.submission_id]?.trim()} onClick={() => void verify(item)}>{t("payout.verify")}</button></details></div>}
    </article>)}</section>}
    {notice && <p className="app-notice" role="status">{notice}</p>}
  </div>;
}

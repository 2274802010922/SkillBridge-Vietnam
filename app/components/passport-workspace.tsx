"use client";

import { useEffect, useState } from "react";
import { translateStatus, useLanguage } from "./i18n";

type Credential = { id: string; challenge_title: string; issuer_name: string; score: string; status: string; attestation_address: string; issue_tx: string | null };

export function PassportWorkspace() {
  const { t } = useLanguage();
  const [items, setItems] = useState<Credential[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    const response = await fetch("/api/credentials", { cache: "no-store" });
    if (response.ok) setItems(((await response.json()) as { credentials: Credential[] }).credentials);
  }
  useEffect(() => { let active = true; fetch("/api/credentials", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<{ credentials: Credential[] }> : { credentials: [] }).then((data) => { if (active) setItems(data.credentials); }); return () => { active = false; }; }, []);
  async function revoke(id: string) {
    setBusy(true);
    const response = await fetch(`/api/credentials/${id}/revoke`, { method: "POST" });
    const data = await response.json() as { error?: string };
    setNotice(response.ok ? t("passport.revoked") : data.error ?? t("passport.revokeError"));
    await load(); setBusy(false);
  }
  return <div className="workspace-product-content"><div className="app-welcome"><div><span>{t("passport.kicker")}</span><h1>{t("passport.title")}</h1><p>{t("passport.description")}</p></div><div className="identity-card"><small>{t("passport.credentials")}</small><strong className="metric-number">{items.length}</strong><b>{items.filter((item) => item.status === "active").length} {t("passport.active")}</b></div></div>{items.length === 0 ? <section className="app-panel empty-product"><h2>{t("passport.empty")}</h2><p>{t("passport.emptyDescription")}</p></section> : <section className="passport-grid">{items.map((item) => <article className={`passport-card ${item.status}`} key={item.id}><div className="entity-top"><span>{t("passport.proof")}</span><b>{translateStatus(t, item.status)}</b></div><div className="passport-score"><strong>{item.score}</strong><span>/100</span></div><h2>{item.challenge_title}</h2><p>{t("passport.issuedBy")} {item.issuer_name}</p><code>{item.attestation_address}</code><div className="passport-links"><a href={`/verify/${item.id}`}>{t("passport.verify")}</a>{item.issue_tx && <a href={`https://explorer.solana.com/tx/${item.issue_tx}?cluster=devnet`} target="_blank" rel="noreferrer">{t("passport.explorer")}</a>}</div>{item.status === "active" && <button disabled={busy} onClick={() => revoke(item.id)}>{t("passport.revoke")}</button>}</article>)}</section>}{notice && <p className="app-notice">{notice}</p>}</div>;
}

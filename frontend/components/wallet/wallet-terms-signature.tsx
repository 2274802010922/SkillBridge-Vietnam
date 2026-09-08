"use client";

import { useEffect, useMemo, useState } from "react";
import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import { StandardConnect, type StandardConnectFeature } from "@wallet-standard/features";
import { SolanaSignMessage, type SolanaSignMessageFeature } from "@solana/wallet-standard-features";
import { useLanguage } from "../../i18n/i18n";

const DEVNET_CHAIN = "solana:devnet";
type TermsWallet = Wallet & { features: StandardConnectFeature & Partial<SolanaSignMessageFeature> };
type TermsData = { version: string; hash: string; amount: string; vaultWallet: string; status: "accepted" | "awaiting_signature"; acceptedAt?: string | null; signerWallet?: string | null; message?: string };

function supportsTerms(wallet: Wallet): wallet is TermsWallet {
  return wallet.chains.some((chain) => chain.startsWith("solana:")) && StandardConnect in wallet.features && SolanaSignMessage in wallet.features;
}

function encode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function findAccount(accounts: readonly WalletAccount[]) {
  return accounts.find((item) => item.chains.includes(DEVNET_CHAIN)) ?? accounts.find((item) => item.chains.some((chain) => chain.startsWith("solana:")));
}

export function WalletTermsSignature({ challengeId, onAccepted }: { challengeId: string; onAccepted: () => Promise<void> | void }) {
  const { t } = useLanguage();
  const [wallets, setWallets] = useState<readonly TermsWallet[]>([]);
  const [selected, setSelected] = useState("");
  const [terms, setTerms] = useState<TermsData | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const registry = getWallets();
    const refresh = () => { const next = registry.get().filter(supportsTerms); setWallets(next); setSelected((current) => current || next[0]?.name || ""); };
    refresh();
    const offRegister = registry.on("register", refresh);
    const offUnregister = registry.on("unregister", refresh);
    return () => { offRegister(); offUnregister(); };
  }, []);
  useEffect(() => {
    let active = true;
    fetch(`/api/challenges/${challengeId}/terms`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ terms?: TermsData }> : { terms: undefined })
      .then((data) => { if (active && data.terms) setTerms(data.terms); })
      .catch(() => { if (active) setError(t("challenge.termsLoadError")); });
    return () => { active = false; };
  }, [challengeId, t]);
  const wallet = useMemo(() => wallets.find((item) => item.name === selected) ?? null, [wallets, selected]);

  async function signTerms() {
    if (!wallet || !accepted) return;
    setBusy(true); setError(null);
    try {
      const prepareResponse = await fetch(`/api/challenges/${challengeId}/terms`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "prepare" }) });
      const prepared = await prepareResponse.json() as { terms?: TermsData; error?: string };
      if (!prepareResponse.ok || !prepared.terms?.message) throw new Error(prepared.error ?? t("challenge.termsError"));
      let account = findAccount(wallet.accounts);
      if (!account) account = findAccount((await wallet.features[StandardConnect].connect()).accounts);
      if (!account) throw new Error(t("wallet.noAccount"));
      const feature = wallet.features[SolanaSignMessage];
      if (!feature) throw new Error(t("challenge.termsWalletUnsupported"));
      setTerms(prepared.terms);
      const [output] = await feature.signMessage({ account, message: new TextEncoder().encode(prepared.terms.message) });
      const response = await fetch(`/api/challenges/${challengeId}/terms`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "accept", address: account.address, message: prepared.terms.message, signature: encode(output.signature), termsHash: prepared.terms.hash, termsVersion: prepared.terms.version }) });
      const data = await response.json() as { terms?: TermsData; error?: string };
      if (!response.ok || !data.terms) throw new Error(data.error ?? t("challenge.termsError"));
      setTerms(data.terms); await onAccepted();
    } catch (termsError) { setError(termsError instanceof Error ? termsError.message : t("challenge.termsError")); }
    finally { setBusy(false); }
  }

  return <section className="terms-confirmation" aria-labelledby={`terms-title-${challengeId}`}>
    <div className="terms-confirmation-heading"><span className="panel-kicker">{t("challenge.termsKicker")}</span><h3 id={`terms-title-${challengeId}`}>{t("challenge.termsTitle")}</h3><p>{t("challenge.termsDescription")}</p></div>
    <ul className="terms-confirmation-list"><li>{t("challenge.termsLock")}</li><li>{t("challenge.termsRefund")}</li><li>{t("challenge.termsPayout")}</li><li>{t("challenge.termsNetwork")}</li></ul>
    {terms && <dl className="terms-confirmation-meta"><div><dt>{t("challenge.termsVersion")}</dt><dd>{terms.version}</dd></div><div><dt>{t("challenge.termsHash")}</dt><dd title={terms.hash}>{terms.hash.slice(0, 18)}…</dd></div></dl>}
    {terms?.status === "accepted" ? <p className="terms-confirmation-success" role="status">✓ {t("challenge.termsAccepted")}{terms.signerWallet ? ` · ${terms.signerWallet.slice(0, 8)}…${terms.signerWallet.slice(-6)}` : ""}</p> : <><label className="consent-check terms-consent"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>{t("challenge.termsConsent")}</span></label>{wallets.length > 1 && <select aria-label={t("challenge.termsWalletLabel")} value={selected} onChange={(event) => setSelected(event.target.value)}>{wallets.map((item) => <option value={item.name} key={item.name}>{item.name}</option>)}</select>}<button className="button button-primary" type="button" disabled={busy || !wallet || !accepted} onClick={() => void signTerms()}>{busy ? t("challenge.termsSigning") : t("challenge.termsSign")}</button>{!wallets.length && <small>{t("challenge.termsWalletUnsupported")}</small>}</>}
    {error && <p className="demo-error" role="alert">{error}</p>}
  </section>;
}

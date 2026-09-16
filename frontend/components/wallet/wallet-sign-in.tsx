"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import { StandardConnect, type StandardConnectFeature } from "@wallet-standard/features";
import {
  SolanaSignIn,
  SolanaSignMessage,
  type SolanaSignInFeature,
  type SolanaSignInInput,
  type SolanaSignMessageFeature,
} from "@solana/wallet-standard-features";
import { createSignInMessage } from "@solana/wallet-standard-util";
import { useLanguage } from "../../i18n/i18n";
import { walletOnboardingCopy } from "../../i18n/wallet-onboarding";
import { preferredDetectedWallet, safeWalletReturnTo, walletRequestWasCancelled } from "../../../shared/validation/wallet-onboarding";
import { WalletOnboarding } from "./wallet-onboarding";
import styles from "./wallet-onboarding.module.css";

type CompatibleWallet = Wallet & {
  features: StandardConnectFeature & Partial<SolanaSignInFeature & SolanaSignMessageFeature>;
};

function encode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function supportsSolana(wallet: Wallet): wallet is CompatibleWallet {
  return wallet.chains.some((chain) => chain.startsWith("solana:")) && StandardConnect in wallet.features &&
    (SolanaSignIn in wallet.features || SolanaSignMessage in wallet.features);
}

export function WalletSignIn({ returnTo = "/app" }: { returnTo?: string }) {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const copy = walletOnboardingCopy[locale];
  const [wallets, setWallets] = useState<readonly CompatibleWallet[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage,setStage]=useState<"connecting"|"preparing"|"signing"|"verifying">("connecting");
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [ready, setReady] = useState(false);
  const [intent, setIntent] = useState<"auto" | "existing" | "new">("auto");
  const [checked, setChecked] = useState(false);
  const [incompatible, setIncompatible] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const connection = useRef<HTMLDivElement>(null);
  const refreshWallets = useCallback(() => {
    const discovered = getWallets().get();
    const compatible = discovered.filter(supportsSolana);
    setWallets(compatible);
    setSelected(current => preferredDetectedWallet(compatible.map(item => item.name), current));
    setIncompatible(discovered.length > 0 && compatible.length === 0);
    setReady(true);
    return compatible;
  }, []);

  useEffect(() => {
    const registry = getWallets();
    const visible = () => { if (document.visibilityState === "visible") refreshWallets(); };
    const timer = window.setTimeout(refreshWallets, 0);
    const offRegister = registry.on("register", refreshWallets);
    const offUnregister = registry.on("unregister", refreshWallets);
    window.addEventListener("focus", refreshWallets);
    document.addEventListener("visibilitychange", visible);
    return () => { window.clearTimeout(timer); offRegister(); offUnregister(); window.removeEventListener("focus", refreshWallets); document.removeEventListener("visibilitychange", visible); };
  }, [refreshWallets]);

  function checkWallets() {
    if (busy) return;
    const found = refreshWallets();
    setChecked(true);
    if (found.length) { setIntent("existing"); requestAnimationFrame(() => connection.current?.focus()); }
  }
  const showGuide = !busy && (intent === "new" || (intent === "auto" && ready && wallets.length === 0));

  const wallet = useMemo(() => wallets.find((item) => item.name === selected) ?? null, [wallets, selected]);

  async function signIn() {
    if (!wallet || !accepted) return;
    setBusy(true);
    setStage("connecting");
    setError(null);
    setCancelled(false);
    try {
      let account: WalletAccount | undefined = wallet.accounts.find((item) => item.chains.some((chain) => chain.startsWith("solana:")));
      if (!account) {
        const connected = await wallet.features[StandardConnect].connect();
        account = connected.accounts.find((item) => item.chains.some((chain) => chain.startsWith("solana:")));
      }
      if (!account) throw new Error(t("wallet.noAccount"));

      setStage("preparing");
      const challengeResponse = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: account.address }),
      });
      const challenge = await challengeResponse.json() as { challengeId?: string; input?: SolanaSignInInput; error?: string };
      if (!challengeResponse.ok || !challenge.challengeId || !challenge.input) {
        throw new Error(challenge.error ?? t("wallet.challengeError"));
      }

      setStage("signing");
      let signedMessage: Uint8Array;
      let signature: Uint8Array;
      let signedAddress = account.address;
      if (SolanaSignIn in wallet.features) {
        const feature = wallet.features[SolanaSignIn];
        if (!feature) throw new Error(t("wallet.siwsUnavailable"));
        const [output] = await feature.signIn(challenge.input);
        signedMessage = output.signedMessage;
        signature = output.signature;
        signedAddress = output.account.address;
      } else if (SolanaSignMessage in wallet.features) {
        const feature = wallet.features[SolanaSignMessage];
        if (!feature) throw new Error(t("wallet.signMessageUnavailable"));
        const message = createSignInMessage({ ...challenge.input, domain: challenge.input.domain!, address: account.address });
        const [output] = await feature.signMessage({ account, message });
        signedMessage = output.signedMessage;
        signature = output.signature;
      } else {
        throw new Error(t("wallet.unsupported"));
      }

      setStage("verifying");
      const verifyResponse = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          address: signedAddress,
          signedMessage: encode(signedMessage),
          signature: encode(signature),
        }),
      });
      const verified = await verifyResponse.json() as { error?: string };
      if (!verifyResponse.ok) throw new Error(verified.error ?? t("wallet.verifyError"));
      router.push(safeWalletReturnTo(returnTo));
      router.refresh();
    } catch (signInError) {
      setCancelled(walletRequestWasCancelled(signInError));
      setError(signInError instanceof Error ? signInError.message : t("wallet.genericError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`wallet-login-card ${styles.root}`}>
      <div className="wallet-login-heading">
        <span className={styles.network}>{copy.testNetwork}</span>
        <h2>{copy.heading}</h2>
        <p>{copy.description}</p>
      </div>
      <div className={styles.choices} role="group" aria-label={copy.choices}>
        <button type="button" className={styles.choice} disabled={busy} aria-pressed={!showGuide} onClick={() => setIntent("existing")}>{copy.existing}</button>
        <button type="button" className={styles.choice} disabled={busy} aria-pressed={showGuide} onClick={() => setIntent("new")}>{copy.beginner}</button>
      </div>
      {checked && <p role="status" className={`${styles.status} ${wallets.length ? styles.success : ""}`}>{wallets.length ? copy.found : copy.stillMissing}</p>}
      {!ready && <p role="status">{copy.detecting}</p>}
      {showGuide ? <WalletOnboarding returnTo={returnTo} onCheck={checkWallets} onSkip={() => setIntent("existing")} /> : ready && wallets.length ? (
        <div className={styles.connection} ref={connection} tabIndex={-1}>
          <label className="field-label" htmlFor="wallet-select">{t("wallet.detected")}</label>
          <select disabled={busy} id="wallet-select" value={selected} onChange={(event) => setSelected(event.target.value)}>
            {wallets.map((item) => <option value={item.name} key={item.name}>{item.name}</option>)}
          </select>
          <label className="consent-check">
            <input type="checkbox" disabled={busy} checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
            <span>{t("wallet.consent")} <a href="/terms" target="_blank">{t("wallet.terms")}</a> &amp; <a href="/privacy" target="_blank">{t("wallet.privacy")}</a>.</span>
          </label>
          <button aria-busy={busy} className="button button-primary wallet-login-button" disabled={busy || !wallet || !accepted} onClick={signIn}>
            {busy ? t(stage === "connecting" ? "wallet.connecting" : stage === "preparing" ? "wallet.preparing" : stage === "verifying" ? "wallet.verifying" : "wallet.signing") : `${t("wallet.continue")} ${wallet?.name ?? "wallet"}`}
          </button>
          <p className={styles.note} role="status">{busy ? stage === "signing" ? copy.signHelp : copy.connectHelp : copy.noFunds}</p>
        </div>
      ) : ready ? (
        <div className="wallet-empty">
          <strong>{copy.notDetected}</strong>
          <p>{incompatible ? copy.incompatible : copy.notDetectedHint}</p>
          <div className={styles.actions}><button type="button" className={`${styles.action} ${styles.primary}`} onClick={checkWallets}>{copy.check}</button><button type="button" className={styles.action} onClick={() => setIntent("new")}>{copy.guide}</button></div>
        </div>
      ) : null}
      {error && <div role="alert"><p className="demo-error">{cancelled ? copy.cancelled : copy.failed}</p>{!cancelled && <details className={styles.help}><summary>{copy.details}</summary><p>{error}</p></details>}</div>}
      <details className={styles.help}><summary>{copy.help}</summary><p>{copy.desktopHelp}</p><p>{copy.mobileHelp}</p><div className={styles.actions}><button type="button" className={styles.link} disabled={busy} onClick={checkWallets}>{copy.check}</button><button type="button" className={styles.link} disabled={busy} onClick={() => window.location.reload()}>{copy.reload}</button></div></details>
      <div className="wallet-safety"><span>{t("wallet.noSeed")}</span><span>{t("wallet.noTransaction")}</span></div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
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
  const { t } = useLanguage();
  const [wallets, setWallets] = useState<readonly CompatibleWallet[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const registry = getWallets();
    const refresh = () => {
      const compatible = registry.get().filter(supportsSolana);
      setWallets(compatible);
      setSelected((current) => current || compatible[0]?.name || "");
    };
    refresh();
    const offRegister = registry.on("register", refresh);
    const offUnregister = registry.on("unregister", refresh);
    return () => { offRegister(); offUnregister(); };
  }, []);

  const wallet = useMemo(() => wallets.find((item) => item.name === selected) ?? null, [wallets, selected]);

  async function signIn() {
    if (!wallet || !accepted) return;
    setBusy(true);
    setError(null);
    try {
      let account: WalletAccount | undefined = wallet.accounts.find((item) => item.chains.some((chain) => chain.startsWith("solana:")));
      if (!account) {
        const connected = await wallet.features[StandardConnect].connect();
        account = connected.accounts.find((item) => item.chains.some((chain) => chain.startsWith("solana:")));
      }
      if (!account) throw new Error(t("wallet.noAccount"));

      const challengeResponse = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: account.address }),
      });
      const challenge = await challengeResponse.json() as { challengeId?: string; input?: SolanaSignInInput; error?: string };
      if (!challengeResponse.ok || !challenge.challengeId || !challenge.input) {
        throw new Error(challenge.error ?? t("wallet.challengeError"));
      }

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
      router.push(returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/app");
      router.refresh();
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Đăng nhập không thành công.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wallet-login-card">
      <div className="wallet-login-heading">
        <span>SIWS · SOLANA DEVNET</span>
        <h2>{t("wallet.heading")}</h2>
        <p>{t("wallet.description")}</p>
      </div>
      {wallets.length ? (
        <>
          <label className="field-label" htmlFor="wallet-select">{t("wallet.detected")}</label>
          <select id="wallet-select" value={selected} onChange={(event) => setSelected(event.target.value)}>
            {wallets.map((item) => <option value={item.name} key={item.name}>{item.name}</option>)}
          </select>
          <label className="consent-check">
            <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
            <span>{t("wallet.consent")} <a href="/terms" target="_blank">{t("wallet.terms")}</a> &amp; <a href="/privacy" target="_blank">{t("wallet.privacy")}</a>.</span>
          </label>
          <button className="button button-primary wallet-login-button" disabled={busy || !wallet || !accepted} onClick={signIn}>
            {busy ? t("wallet.signing") : `${t("wallet.continue")} ${wallet?.name ?? "wallet"}`}
          </button>
        </>
      ) : (
        <div className="wallet-empty">
          <strong>{t("wallet.empty")}</strong>
          <p>{t("wallet.install")}</p>
          <button className="button button-dark" onClick={() => window.location.reload()}>{t("wallet.reload")}</button>
        </div>
      )}
      {error && <p className="demo-error" role="alert">{error}</p>}
      <div className="wallet-safety"><span>{t("wallet.noSeed")}</span><span>{t("wallet.noTransaction")}</span></div>
    </div>
  );
}

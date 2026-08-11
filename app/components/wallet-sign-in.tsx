"use client";

import { useEffect, useMemo, useState } from "react";
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
      if (!account) throw new Error("Ví không cung cấp tài khoản Solana.");

      const challengeResponse = await fetch("/api/auth/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: account.address }),
      });
      const challenge = await challengeResponse.json() as { challengeId?: string; input?: SolanaSignInInput; error?: string };
      if (!challengeResponse.ok || !challenge.challengeId || !challenge.input) {
        throw new Error(challenge.error ?? "Không thể tạo yêu cầu đăng nhập.");
      }

      let signedMessage: Uint8Array;
      let signature: Uint8Array;
      let signedAddress = account.address;
      if (SolanaSignIn in wallet.features) {
        const feature = wallet.features[SolanaSignIn];
        if (!feature) throw new Error("Tính năng SIWS không khả dụng.");
        const [output] = await feature.signIn(challenge.input);
        signedMessage = output.signedMessage;
        signature = output.signature;
        signedAddress = output.account.address;
      } else if (SolanaSignMessage in wallet.features) {
        const feature = wallet.features[SolanaSignMessage];
        if (!feature) throw new Error("Tính năng ký thông điệp không khả dụng.");
        const message = createSignInMessage({ ...challenge.input, domain: challenge.input.domain!, address: account.address });
        const [output] = await feature.signMessage({ account, message });
        signedMessage = output.signedMessage;
        signature = output.signature;
      } else {
        throw new Error("Ví này chưa hỗ trợ ký thông điệp đăng nhập.");
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
      if (!verifyResponse.ok) throw new Error(verified.error ?? "Không thể xác minh chữ ký.");
      window.location.assign(returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/app");
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
        <h2>Đăng nhập bằng ví</h2>
        <p>Chữ ký chỉ chứng minh quyền sở hữu ví. Thao tác này không tốn SOL và không tạo giao dịch.</p>
      </div>
      {wallets.length ? (
        <>
          <label className="field-label" htmlFor="wallet-select">Ví được phát hiện</label>
          <select id="wallet-select" value={selected} onChange={(event) => setSelected(event.target.value)}>
            {wallets.map((item) => <option value={item.name} key={item.name}>{item.name}</option>)}
          </select>
          <label className="consent-check">
            <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
            <span>Tôi đã đọc và đồng ý với <a href="/terms" target="_blank">Điều khoản</a> và <a href="/privacy" target="_blank">Chính sách dữ liệu</a>.</span>
          </label>
          <button className="button button-primary wallet-login-button" disabled={busy || !wallet || !accepted} onClick={signIn}>
            {busy ? "Đang chờ chữ ký…" : `Tiếp tục với ${wallet?.name ?? "ví"}`}
          </button>
        </>
      ) : (
        <div className="wallet-empty">
          <strong>Chưa tìm thấy ví tương thích</strong>
          <p>Cài Phantom, Solflare hoặc ví hỗ trợ Solana Wallet Standard, sau đó tải lại trang.</p>
          <button className="button button-dark" onClick={() => window.location.reload()}>Tải lại</button>
        </div>
      )}
      {error && <p className="demo-error" role="alert">{error}</p>}
      <div className="wallet-safety"><span>✓ Không yêu cầu seed phrase</span><span>✓ Không tự động gửi transaction</span></div>
    </div>
  );
}

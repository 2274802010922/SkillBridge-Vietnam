"use client";

import { useEffect, useMemo, useState } from "react";
import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import { StandardConnect, type StandardConnectFeature } from "@wallet-standard/features";
import { SolanaSignAndSendTransaction, type SolanaSignAndSendTransactionFeature } from "@solana/wallet-standard-features";
import bs58 from "bs58";

type PaymentWallet = Wallet & { features: StandardConnectFeature & Partial<SolanaSignAndSendTransactionFeature> };
function supportsPayment(wallet: Wallet): wallet is PaymentWallet {
  return wallet.chains.some((chain) => chain.startsWith("solana:")) && StandardConnect in wallet.features && SolanaSignAndSendTransaction in wallet.features;
}

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function WalletPaymentButton({ invoiceId, payoutSubmissionId, onSubmitted, label = "Thanh toán bằng ví" }: { invoiceId?: string; payoutSubmissionId?: string; onSubmitted: (signature: string) => Promise<void> | void; label?: string }) {
  const [wallets, setWallets] = useState<readonly PaymentWallet[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const registry = getWallets();
    const refresh = () => { const next = registry.get().filter(supportsPayment); setWallets(next); setSelected((current) => current || next[0]?.name || ""); };
    refresh(); const offRegister = registry.on("register", refresh); const offUnregister = registry.on("unregister", refresh);
    return () => { offRegister(); offUnregister(); };
  }, []);
  const wallet = useMemo(() => wallets.find((item) => item.name === selected) ?? null, [wallets, selected]);
  async function pay() {
    if (!wallet) return;
    setBusy(true); setError(null);
    try {
      let account: WalletAccount | undefined = wallet.accounts.find((item) => item.chains.some((chain) => chain.startsWith("solana:")));
      if (!account) account = (await wallet.features[StandardConnect].connect()).accounts.find((item) => item.chains.some((chain) => chain.startsWith("solana:")));
      if (!account) throw new Error("Ví không cung cấp tài khoản Solana.");
      const buildResponse = await fetch("/api/payments/build", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ invoiceId, payoutSubmissionId, senderWallet: account.address }) });
      const built = await buildResponse.json() as { transaction?: string; error?: string };
      if (!buildResponse.ok || !built.transaction) throw new Error(built.error ?? "Không thể tạo giao dịch thanh toán.");
      const feature = wallet.features[SolanaSignAndSendTransaction];
      if (!feature) throw new Error("Ví không hỗ trợ ký và gửi giao dịch.");
      const [output] = await feature.signAndSendTransaction({ account, chain: "solana:devnet", transaction: fromBase64(built.transaction), options: { commitment: "confirmed" } });
      await onSubmitted(bs58.encode(output.signature));
    } catch (paymentError) { setError(paymentError instanceof Error ? paymentError.message : "Thanh toán thất bại."); }
    finally { setBusy(false); }
  }
  return <div className="wallet-payment-control">
    {wallets.length > 1 && <select aria-label="Ví thanh toán" value={selected} onChange={(event) => setSelected(event.target.value)}>{wallets.map((item) => <option value={item.name} key={item.name}>{item.name}</option>)}</select>}
    <button className="button button-primary" type="button" disabled={busy || !wallet} onClick={() => void pay()}>{busy ? "Đang chờ ví xác nhận…" : label}</button>
    {!wallets.length && <small>Cần ví Solana hỗ trợ Wallet Standard để thanh toán trực tiếp.</small>}
    {error && <p className="demo-error" role="alert">{error}</p>}
  </div>;
}

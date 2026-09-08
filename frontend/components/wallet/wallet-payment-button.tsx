"use client";

import { useEffect, useMemo, useState } from "react";
import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import { StandardConnect, type StandardConnectFeature } from "@wallet-standard/features";
import {
  SolanaSignAndSendTransaction,
  SolanaSignTransaction,
  type SolanaSignAndSendTransactionFeature,
  type SolanaSignTransactionFeature,
} from "@solana/wallet-standard-features";
import bs58 from "bs58";
import { useLanguage } from "../../i18n/i18n";

const DEVNET_CHAIN = "solana:devnet";
export type WalletPaymentResult = { status: "funded" | "pending" };

type PaymentWallet = Wallet & {
  features: StandardConnectFeature & Partial<SolanaSignAndSendTransactionFeature & SolanaSignTransactionFeature>;
};

function supportsPayment(wallet: Wallet): wallet is PaymentWallet {
  return wallet.chains.some((chain) => chain.startsWith("solana:")) && StandardConnect in wallet.features &&
    (SolanaSignAndSendTransaction in wallet.features || SolanaSignTransaction in wallet.features);
}

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function findSolanaAccount(accounts: readonly WalletAccount[]) {
  return accounts.find((item) => item.chains.includes(DEVNET_CHAIN))
    ?? accounts.find((item) => item.chains.some((chain) => chain.startsWith("solana:")));
}

export function WalletPaymentButton({ invoiceId, payoutSubmissionId, fundingChallengeId, cashoutId, escrowRequest, onSubmitted, label = "Thanh toán bằng ví" }: { invoiceId?: string; payoutSubmissionId?: string; fundingChallengeId?: string; cashoutId?: string; escrowRequest?: {challengeId:string;action:string;submissionId?:string}; onSubmitted: (signature: string, operationId?: string) => Promise<WalletPaymentResult | void> | WalletPaymentResult | void; label?: string }) {
  const { t, locale } = useLanguage();
  const [wallets, setWallets] = useState<readonly PaymentWallet[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingKey,setPendingKey]=useState<string|null>(null);
  const [stage, setStage] = useState<"idle" | "signing" | "broadcasting" | "verifying" | "success" | "pending">("idle");
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
      let account: WalletAccount | undefined = findSolanaAccount(wallet.accounts);
      if (!account) account = findSolanaAccount((await wallet.features[StandardConnect].connect()).accounts);
      if (!account) throw new Error("Ví không cung cấp tài khoản Solana.");
      const savedKey=escrowRequest ? "skillbridge-escrow:"+escrowRequest.challengeId+":"+escrowRequest.action+":"+(escrowRequest.submissionId||"")+":"+account.address : null;
      setPendingKey(savedKey);
      const prior=savedKey ? window.localStorage.getItem(savedKey) : null;
      if(prior){const saved=JSON.parse(prior) as {signature:string;operationId?:string};setStage("verifying");const result=await onSubmitted(saved.signature,saved.operationId);setStage(result?.status==="pending"?"pending":"success");if(result?.status==="funded" && savedKey)window.localStorage.removeItem(savedKey);return;}
      const buildResponse = await fetch(escrowRequest ? "/api/challenges/"+escrowRequest.challengeId+"/escrow" : "/api/payments/build", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ invoiceId, payoutSubmissionId, fundingChallengeId, cashoutId, ...escrowRequest, senderWallet: account.address }) });
      const built = await buildResponse.json() as { transaction?: string; error?: string; operationId?:string };
      if (!buildResponse.ok || !built.transaction) throw new Error(built.error ?? "Không thể tạo giao dịch thanh toán.");
      const transaction = fromBase64(built.transaction);
      let signature: string | null = null;
      const signAndSend = wallet.features[SolanaSignAndSendTransaction];
      const signOnly = wallet.features[SolanaSignTransaction];

      setStage("signing");
      if (signAndSend?.supportedTransactionVersions.includes("legacy")) {
        const [output] = await signAndSend.signAndSendTransaction({ account, chain: DEVNET_CHAIN, transaction, options: { commitment: "confirmed", maxRetries: 3 } });
        signature = bs58.encode(output.signature);
      } else if (signOnly?.supportedTransactionVersions.includes("legacy")) {
        const [output] = await signOnly.signTransaction({ account, chain: DEVNET_CHAIN, transaction, options: { preflightCommitment: "confirmed" } });
        if(savedKey){const tx=output.signedTransaction;window.localStorage.setItem(savedKey,JSON.stringify({signature:bs58.encode(tx.slice(1,65)),operationId:built.operationId}));}
        setStage("broadcasting");
        const sendResponse = await fetch("/api/solana/send", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ transaction: toBase64(output.signedTransaction) }),
        });
        const sent = await sendResponse.json() as { signature?: string; error?: string };
        if (!sendResponse.ok || !sent.signature) throw new Error(sent.error ?? t("wallet.paymentSendError"));
        signature = sent.signature;
      }

      if (!signature) throw new Error(t("wallet.paymentUnsupported"));
      if(savedKey)window.localStorage.setItem(savedKey,JSON.stringify({signature,operationId:built.operationId}));
      setStage("verifying");
      const result = await onSubmitted(signature,built.operationId);
      if(savedKey && result?.status==="funded")window.localStorage.removeItem(savedKey);
      setStage(result?.status === "pending" ? "pending" : "success");
    } catch (paymentError) {
      setStage("idle");
      setError(paymentError instanceof Error ? paymentError.message : t("wallet.paymentError"));
    } finally { setBusy(false); }
  }

  function toBase64(bytes: Uint8Array) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  const status = stage === "signing" ? t("wallet.paymentSigning") : stage === "broadcasting" ? t("wallet.paymentBroadcasting") : stage === "verifying" ? t("wallet.paymentVerifying") : stage === "success" ? t("wallet.paymentSuccess") : stage === "pending" ? t("wallet.paymentPending") : null;
  const progressIndex = stage === "signing" ? 0 : stage === "broadcasting" ? 1 : stage === "verifying" || stage === "pending" ? 2 : stage === "success" ? 3 : -1;
  const progressLabels = locale === "vi"
    ? ["Mở ví để ký", "Đã gửi giao dịch", "Đang xác minh", "Hoàn tất"]
    : ["Open wallet to sign", "Transaction sent", "Verifying", "Complete"];

  return <div className="wallet-payment-control">
    {wallets.length > 1 && <select aria-label="Ví thanh toán" value={selected} onChange={(event) => setSelected(event.target.value)}>{wallets.map((item) => <option value={item.name} key={item.name}>{item.name}</option>)}</select>}
    <button aria-busy={busy} className="button button-primary" type="button" disabled={busy || !wallet} onClick={() => void pay()}>{busy ? t("wallet.paymentWaiting") : label}</button>
    {progressIndex >= 0 && <ol aria-label={locale === "vi" ? "Tiến độ giao dịch" : "Transaction progress"} className="wallet-payment-progress">
      {progressLabels.map((item, index) => <li className={index < progressIndex || stage === "success" ? "done" : index === progressIndex ? "active" : ""} key={item}><span aria-hidden="true">{index < progressIndex || stage === "success" ? "✓" : index + 1}</span><b>{item}</b></li>)}
    </ol>}
    {status && <p className="wallet-payment-status" role="status" aria-live="polite">{status}</p>}
    {escrowRequest&&pendingKey&&error&&<button type="button" className="button button-secondary" disabled={busy} onClick={()=>{window.localStorage.removeItem(pendingKey);setError(null);setStage('idle');}}>{locale==='vi'?'Tạo yêu cầu ký mới (kiểm tra lại quỹ)':'New signing request (recheck fund)'}</button>}
    {!wallets.length && <small>{t("wallet.paymentNoCompatible")}</small>}
    {error && <p className="demo-error" role="alert">{error}</p>}
  </div>;
}

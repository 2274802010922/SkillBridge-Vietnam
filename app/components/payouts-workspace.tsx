"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "./i18n";

type Payout = {
  challenge_id: string; challenge_title: string; organization_name: string; reward_asset: "usdc" | "sol" | null;
  reward_amount_usdc: string; submission_id: string; student_name: string | null; recipient_wallet: string;
  payout_status: string | null; payment_tx: string | null; fund_status: string | null;
  funded_atomic: string | null; disbursed_atomic: string | null; refunded_atomic: string | null;
};
function shortWallet(value: string) { return `${value.slice(0, 10)}…${value.slice(-8)}`; }

export function PayoutsWorkspace() {
  const { t, locale } = useLanguage();
  const vi = locale === "vi";
  const [items, setItems] = useState<Payout[]>([]); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState<string | null>(null);
  async function load() { const response = await fetch("/api/payouts", { cache: "no-store" }); if (response.ok) setItems(((await response.json()) as { payouts: Payout[] }).payouts); }
  useEffect(() => {
    let active = true;
    fetch("/api/payouts", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ payouts: Payout[] }> : { payouts: [] })
      .then((data) => { if (active) setItems(data.payouts); });
    return () => { active = false; };
  }, []);
  async function release(item: Payout) {
    if (!window.confirm(vi ? `Giải ngân ${item.reward_amount_usdc} ${item.reward_asset === "sol" ? "SOL" : "USDC"} từ Reward Vault cho người nhận này?` : `Send ${item.reward_amount_usdc} ${item.reward_asset === "sol" ? "SOL" : "USDC"} from the Reward Vault to this recipient?`)) return;
    setBusy(true); setNotice(null);
    const response = await fetch("/api/payouts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ submissionId: item.submission_id }) });
    const data = await response.json() as { error?: string; payout?: { explorerUrl?: string } };
    setNotice(response.ok ? (vi ? "Đã giải ngân từ Reward Vault. Giao dịch có thể kiểm tra trên Solana Explorer." : "Reward released from the vault. The transaction is verifiable in Solana Explorer.") : data.error ?? t("invoice.error"));
    if (response.ok) await load(); setBusy(false);
  }
  const paidCount = useMemo(() => items.filter((item) => item.payout_status === "paid").length, [items]);
  return <div className="workspace-product-content">
    <div className="app-welcome"><div><span>{vi ? "GIẢI NGÂN CÓ PHÊ DUYỆT" : "HUMAN-APPROVED PAYOUTS"}</span><h1>{vi ? "Người duyệt quyết định. Vault thực hiện." : "A reviewer decides. The vault executes."}</h1><p>{vi ? "AI không tự chuyển tiền. Sau khi bài được con người phê duyệt, doanh nghiệp xác nhận một lần để Reward Vault Devnet giải ngân." : "AI never moves money. Once a human approves a submission, a business reviewer confirms one action to release the Devnet Reward Vault."}</p></div><div className="identity-card"><small>{vi ? "BÀI ĐỦ ĐIỀU KIỆN" : "ELIGIBLE SUBMISSIONS"}</small><strong className="metric-number">{items.length}</strong><b>{paidCount} {vi ? "đã giải ngân" : "paid out"}</b></div></div>
    <div className="app-notice payout-notice">{vi ? "Quỹ được doanh nghiệp nạp trước khi công bố challenge. Mỗi lần giải ngân tạo một transaction Devnet có thể kiểm tra công khai." : "A business funds the vault before publishing a challenge. Each release produces a publicly verifiable Devnet transaction."}</div>
    {items.length === 0 ? <section className="app-panel empty-product"><h2>{t("payout.empty")}</h2><p>{t("payout.emptyDescription")}</p></section> : <section className="payout-list">{items.map((item) => { const asset = item.reward_asset === "sol" ? "SOL" : "USDC"; const vaultReady = item.fund_status === "funded"; return <article className={`payout-card ${item.payout_status ?? "pending"}`} key={item.submission_id}>
      <div className="entity-top"><span>{item.organization_name}</span><b>{item.payout_status === "paid" ? t("invoice.paid") : vaultReady ? (vi ? "Sẵn sàng giải ngân" : "Ready to release") : (vi ? "Quỹ chưa sẵn sàng" : "Vault not ready")}</b></div><h2>{item.challenge_title}</h2><p>{item.student_name || shortWallet(item.recipient_wallet)}</p><div className="payout-amount"><strong>{item.reward_amount_usdc}</strong><span>{asset}</span></div>
      <dl><div><dt>{vi ? "Người nhận" : "Recipient"}</dt><dd>{shortWallet(item.recipient_wallet)}</dd></div><div><dt>{vi ? "Nguồn tiền" : "Source"}</dt><dd>Reward Vault · Devnet</dd></div></dl>
      {item.payout_status === "paid" ? <a className="chain-proof-link" href={`https://explorer.solana.com/tx/${item.payment_tx}?cluster=devnet`} target="_blank" rel="noreferrer">{vi ? "Xem bằng chứng giao dịch" : "View transaction proof"}</a> : <div className="payout-verify"><button className="button button-primary" type="button" disabled={busy || !vaultReady} onClick={() => void release(item)}>{vi ? "Xác nhận giải ngân" : "Confirm release"}</button>{!vaultReady && <p className="field-hint">{vi ? "Challenge này chưa có quỹ Devnet đã xác minh." : "This challenge has no verified Devnet vault yet."}</p>}</div>}
    </article>; })}</section>}
    {notice && <p className="app-notice" role="status">{notice}</p>}
  </div>;
}

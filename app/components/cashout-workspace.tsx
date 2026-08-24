"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "./i18n";
import { WalletPaymentButton, type WalletPaymentResult } from "./wallet-payment-button";

type Beneficiary = { id: string; bankCode: string; accountLast4: string; accountHolderMasked: string; status?: string };
type Capability = {
  provider: string; network: string; asset: string; mint: string; devnetTransferEnabled: boolean;
  directSolanaPay: boolean; bankPayoutMode: "sandbox_only" | "unavailable"; settlementWallet: string | null;
  configurationError?: string;
};
type CashoutSession = {
  id: string; beneficiaryId: string | null; amountUsdc: string; grossVnd: string; feeVnd: string; netVnd: string;
  providerReference: string; status: string; rateVnd: string | null; providerFeeVnd: string | null;
  networkFeeVnd: string | null; quoteExpiresAt: string | null; settlementWallet: string | null; reference: string | null;
  submittedTx?: string | null; paymentTx: string | null; paymentObservedAt: string | null; verificationState: string; lastErrorCode: string | null;
  bankReference: string | null; termsAcceptedAt: string | null; beneficiary: Beneficiary | null;
  solanaPayUrl: string | null; explorerUrl: string | null; createdAt: string; updatedAt: string;
};
type AssetResponse = { assets?: Array<{ symbol: string; display: string }> };

const BANKS = ["VCB", "BIDV", "CTG", "TCB", "MB", "ACB", "VPB", "VIB", "TPB", "STB"];
const STATUS_RANK: Record<string, number> = {
  quote_ready: 1, awaiting_wallet_signature: 2, onchain_pending: 2, onchain_failed: 2,
  bank_processing: 3, sandbox_completed: 4,
};

function vnd(value: string | number | null | undefined) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function compact(value: string | null | undefined, head = 6, tail = 5) {
  if (!value) return "—";
  return value.length > head + tail + 2 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value;
}

function normalizeBeneficiary(input: Record<string, unknown>): Beneficiary {
  return {
    id: String(input.id || ""),
    bankCode: String(input.bankCode || input.bank_code || ""),
    accountLast4: String(input.accountLast4 || input.account_last4 || ""),
    accountHolderMasked: String(input.accountHolderMasked || input.account_holder_masked || ""),
    status: String(input.status || "sandbox_verified"),
  };
}

export function CashoutWorkspace() {
  const { locale } = useLanguage();
  const vi = locale === "vi";
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [capabilities, setCapabilities] = useState<Capability | null>(null);
  const [history, setHistory] = useState<CashoutSession[]>([]);
  const [active, setActive] = useState<CashoutSession | null>(null);
  const [walletUsdc, setWalletUsdc] = useState("—");
  const [amount, setAmount] = useState("");
  const [bankCode, setBankCode] = useState("VCB");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [manualSignature, setManualSignature] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState(0);

  const load = useCallback(async (keepActive = true) => {
    const [ordersResponse, beneficiariesResponse, assetsResponse] = await Promise.all([
      fetch("/api/cashout", { cache: "no-store" }),
      fetch("/api/cashout/beneficiaries", { cache: "no-store" }),
      fetch("/api/wallet/assets", { cache: "no-store" }),
    ]);
    if (ordersResponse.ok) {
      const data = await ordersResponse.json() as { sessions: CashoutSession[]; capabilities: Capability };
      setHistory(data.sessions);
      setCapabilities(data.capabilities);
      if (!keepActive) setActive(data.sessions[0] ?? null);
      else setActive((current) => current ? data.sessions.find((item) => item.id === current.id) ?? current : data.sessions[0] ?? null);
    }
    if (beneficiariesResponse.ok) {
      const data = await beneficiariesResponse.json() as { beneficiaries: Array<Record<string, unknown>> };
      const normalized = data.beneficiaries.map(normalizeBeneficiary);
      setBeneficiaries(normalized);
      setBeneficiaryId((current) => current || normalized[0]?.id || "");
    }
    if (assetsResponse.ok) {
      const data = await assetsResponse.json() as AssetResponse;
      setWalletUsdc(data.assets?.find((asset) => asset.symbol === "USDC")?.display ?? "0");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { setClock(Date.now()); void load(false); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (!active?.quoteExpiresAt || !["quote_ready", "awaiting_wallet_signature"].includes(active.status)) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [active?.quoteExpiresAt, active?.status]);

  const secondsLeft = active?.quoteExpiresAt ? Math.max(0, Math.ceil((new Date(active.quoteExpiresAt).getTime() - clock) / 1_000)) : 0;
  const quoteExpired = Boolean(active?.quoteExpiresAt && secondsLeft <= 0 && !active.paymentTx);
  const step = !beneficiaryId ? 1 : !active ? 2 : active.status === "quote_ready" ? 3 : 4;
  const activeRank = active ? STATUS_RANK[active.status] ?? 0 : 0;
  const selectedBeneficiary = useMemo(() => beneficiaries.find((item) => item.id === beneficiaryId) ?? null, [beneficiaries, beneficiaryId]);

  async function createBeneficiary() {
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/cashout/beneficiaries", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ bankCode, accountNumber, accountHolder }),
      });
      const data = await response.json() as { beneficiary?: Record<string, unknown>; error?: string };
      if (!response.ok || !data.beneficiary) throw new Error(data.error || (vi ? "Không thể lưu tài khoản nhận thử nghiệm." : "Unable to save the test beneficiary."));
      const beneficiary = normalizeBeneficiary(data.beneficiary);
      setBeneficiaries((current) => [beneficiary, ...current.filter((item) => item.id !== beneficiary.id)]);
      setBeneficiaryId(beneficiary.id); setAccountNumber(""); setAccountHolder("");
      setNotice(vi ? "Đã token hóa tài khoản thử nghiệm. SkillBridge không lưu số tài khoản đầy đủ." : "Test beneficiary tokenized. SkillBridge did not store the full account number.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(false); }
  }

  async function createQuote() {
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/cashout", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountUsdc: amount, beneficiaryId }),
      });
      const data = await response.json() as { session?: CashoutSession; error?: string };
      if (!response.ok || !data.session) throw new Error(data.error || (vi ? "Không thể tạo báo giá." : "Unable to create a quote."));
      setActive(data.session); setHistory((current) => [data.session!, ...current.filter((item) => item.id !== data.session!.id)]);
      setAcceptedTerms(false); setManualSignature(""); setClock(Date.now());
      setNotice(vi ? "Báo giá thử nghiệm đã khóa trong 5 phút." : "The test quote is locked for five minutes.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(false); }
  }

  async function acceptQuote() {
    if (!active) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch(`/api/cashout/${active.id}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "accept_quote", acceptedTerms }),
      });
      const data = await response.json() as { session?: CashoutSession; error?: string };
      if (!response.ok || !data.session) throw new Error(data.error || (vi ? "Không thể xác nhận báo giá." : "Unable to accept the quote."));
      setActive(data.session); setNotice(vi ? "Báo giá đã xác nhận. Ví của bạn sẽ hiển thị chính xác số USDC Devnet cần gửi." : "Quote accepted. Your wallet will show the exact Devnet USDC amount.");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(false); }
  }

  async function verify(signature: string, mode: "automatic" | "manual"): Promise<WalletPaymentResult> {
    if (!active) return { status: "pending" };
    setError(null); setNotice(null);
    const response = await fetch(`/api/cashout/${active.id}/verify`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ signature, mode }),
    });
    const data = await response.json() as { session?: CashoutSession; error?: string; retryable?: boolean };
    if (data.session) setActive(data.session);
    if (!response.ok) {
      setError(data.error || (vi ? "Chưa xác minh được giao dịch." : "The transaction could not be verified."));
      await load();
      return { status: data.retryable ? "pending" : "pending" };
    }
    setManualSignature(signature);
    setNotice(vi ? "USDC Devnet đã finalized và được xác minh. Không gửi thêm USDC." : "Devnet USDC is finalized and verified. Do not send any more USDC.");
    await load();
    return { status: "funded" };
  }

  async function verifyManually() {
    if (!manualSignature.trim()) return;
    setBusy(true);
    try { await verify(manualSignature.trim(), "manual"); }
    finally { setBusy(false); }
  }

  async function reconcileBankSandbox() {
    if (!active) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch(`/api/cashout/${active.id}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "refresh" }),
      });
      const data = await response.json() as { session?: CashoutSession; error?: string };
      if (!response.ok || !data.session) throw new Error(data.error || (vi ? "Không thể đối soát trạng thái." : "Unable to reconcile the status."));
      setActive(data.session); setNotice(vi ? "Đã hoàn tất luồng Devnet. Không có VND thật được chuyển." : "Devnet flow completed. No real VND was transferred.");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(false); }
  }

  function startNew() {
    setActive(null); setAmount(""); setAcceptedTerms(false); setManualSignature(""); setError(null); setNotice(null);
  }

  const statusText = (status: string) => {
    const map: Record<string, [string, string]> = {
      quote_ready: ["Báo giá sẵn sàng", "Quote ready"], quote_expired: ["Báo giá hết hạn", "Quote expired"],
      awaiting_wallet_signature: ["Chờ ký bằng ví", "Awaiting wallet signature"], onchain_pending: ["Đang chờ finalized", "Awaiting finalization"],
      onchain_failed: ["Cần kiểm tra giao dịch", "Transaction needs attention"], bank_processing: ["USDC đã xác minh", "USDC verified"],
      sandbox_completed: ["Hoàn tất Devnet", "Devnet completed"],
    };
    return map[status]?.[vi ? 0 : 1] ?? status.replaceAll("_", " ");
  };

  return <div className="workspace-product-content cashout-workspace">
    <div className="app-welcome cashout-welcome">
      <div><span>{vi ? "DEVNET OFF-RAMP LAB" : "DEVNET OFF-RAMP LAB"}</span><h1>{vi ? "Gửi USDC thật trên Devnet. Theo dõi VND trong môi trường thử nghiệm." : "Send real Devnet USDC. Track VND in a test environment."}</h1><p>{vi ? "Ví của bạn tự ký giao dịch; SkillBridge xác minh on-chain rồi mô phỏng bước đối soát ngân hàng. Không có VND thật được chuyển cho tới khi một đối tác off-ramp được cấp phép được kết nối." : "Your wallet signs the transaction; SkillBridge verifies it on-chain and then simulates bank reconciliation. No real VND is transferred until a licensed off-ramp partner is connected."}</p></div>
      <div className="identity-card cashout-mode-card"><small>{vi ? "CHẾ ĐỘ HIỆN TẠI" : "CURRENT MODE"}</small><strong>DEVNET</strong><b>{capabilities?.devnetTransferEnabled ? (vi ? "USDC on-chain hoạt động" : "On-chain USDC enabled") : (vi ? "Cần cấu hình settlement" : "Settlement setup required")}</b></div>
    </div>

    <div className="cashout-safety-banner" role="note"><span aria-hidden="true">i</span><div><strong>{vi ? "Ranh giới tiền thật" : "Real-money boundary"}</strong><p>{vi ? "USDC Devnet không có giá trị tiền thật. Tỷ giá và tài khoản ngân hàng bên dưới chỉ phục vụ kiểm thử UX; không nhập dữ liệu ngân hàng thật." : "Devnet USDC has no real monetary value. The rate and bank beneficiary below are for UX testing only; do not enter real banking data."}</p></div></div>
    {capabilities?.configurationError && <p className="app-notice cashout-config-error" role="alert">{capabilities.configurationError}</p>}

    <ol className="cashout-stepper" aria-label={vi ? "Các bước rút tiền" : "Cash-out steps"}>
      {[
        [1, vi ? "Tài khoản nhận" : "Beneficiary"], [2, vi ? "Số tiền" : "Amount"],
        [3, vi ? "Báo giá" : "Quote"], [4, vi ? "Ví & trạng thái" : "Wallet & status"],
      ].map(([number, label]) => <li key={number} className={step === number ? "active" : step > Number(number) ? "done" : ""}><span>{step > Number(number) ? "✓" : number}</span><b>{label}</b></li>)}
    </ol>

    <div className="cashout-flow-grid">
      <section className="app-panel cashout-beneficiary-panel">
        <div className="cashout-section-heading"><div><span className="panel-kicker">{vi ? "BƯỚC 1 · TÀI KHOẢN NHẬN" : "STEP 1 · BENEFICIARY"}</span><h2>{vi ? "Chỉ lưu bản đã che dữ liệu" : "Only masked data is stored"}</h2></div><span className="cashout-security-chip">{vi ? "Không lưu số đầy đủ" : "No full account stored"}</span></div>
        {beneficiaries.length > 0 && <label>{vi ? "Tài khoản thử nghiệm đã lưu" : "Saved test beneficiary"}<select value={beneficiaryId} onChange={(event) => setBeneficiaryId(event.target.value)}>{beneficiaries.map((item) => <option key={item.id} value={item.id}>{item.bankCode} · •••• {item.accountLast4} · {item.accountHolderMasked}</option>)}</select></label>}
        <details className="cashout-beneficiary-form" open={!beneficiaries.length}>
          <summary>{beneficiaries.length ? (vi ? "+ Thêm tài khoản thử nghiệm khác" : "+ Add another test beneficiary") : (vi ? "Thêm tài khoản thử nghiệm" : "Add a test beneficiary")}</summary>
          <div className="cashout-form-grid"><label>{vi ? "Ngân hàng" : "Bank"}<select value={bankCode} onChange={(event) => setBankCode(event.target.value)}>{BANKS.map((bank) => <option key={bank}>{bank}</option>)}</select></label><label>{vi ? "Số tài khoản thử nghiệm" : "Test account number"}<input inputMode="numeric" autoComplete="off" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, ""))} placeholder="0123456789" /></label><label className="full">{vi ? "Tên chủ tài khoản thử nghiệm" : "Test account holder"}<input autoComplete="off" value={accountHolder} onChange={(event) => setAccountHolder(event.target.value)} placeholder={vi ? "NGUYEN VAN A (dữ liệu giả)" : "TEST USER (fake data)"} /></label></div>
          <button className="button button-secondary" type="button" disabled={busy || accountNumber.length < 6 || accountHolder.trim().length < 2} onClick={() => void createBeneficiary()}>{busy ? (vi ? "Đang xử lý…" : "Processing…") : (vi ? "Token hóa & lưu bản che" : "Tokenize & save masked data")}</button>
        </details>
      </section>

      <section className="app-panel cashout-amount-panel">
        <div><span className="panel-kicker">{vi ? "BƯỚC 2 · SỐ TIỀN" : "STEP 2 · AMOUNT"}</span><h2>{vi ? "Bạn muốn gửi bao nhiêu USDC?" : "How much USDC do you want to send?"}</h2><p>{vi ? `Số dư ví Devnet hiện đọc được: ${walletUsdc} USDC.` : `Current readable Devnet wallet balance: ${walletUsdc} USDC.`}</p></div>
        <div className="cashout-amount-entry"><label>{vi ? "USDC Devnet" : "Devnet USDC"}<div className="cashout-token-input"><input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="25" /><span>USDC</span></div></label><button className="button button-primary" type="button" disabled={busy || !beneficiaryId || !amount.trim() || !capabilities?.devnetTransferEnabled} onClick={() => void createQuote()}>{busy ? (vi ? "Đang lấy báo giá…" : "Getting quote…") : (vi ? "Lấy báo giá 5 phút" : "Get a 5-minute quote")}</button></div>
        {selectedBeneficiary && <small className="field-hint">{vi ? "Sẽ đối soát thử nghiệm tới" : "Test reconciliation target"}: {selectedBeneficiary.bankCode} · •••• {selectedBeneficiary.accountLast4}</small>}
      </section>
    </div>

    {active && <section className="cashout-quote" aria-live="polite">
      <div className="cashout-quote-lead"><span>{vi ? "BÁO GIÁ CÓ THỜI HẠN · TEST" : "TIME-LIMITED QUOTE · TEST"}</span><strong>{active.amountUsdc} USDC</strong><small>{vi ? `Khóa ở ${vnd(active.rateVnd)} / USDC` : `Locked at ${vnd(active.rateVnd)} / USDC`}</small><div className={`cashout-countdown ${quoteExpired ? "expired" : ""}`}><span aria-hidden="true">◷</span>{quoteExpired ? (vi ? "Đã hết hạn" : "Expired") : `${Math.floor(secondsLeft / 60).toString().padStart(2, "0")}:${(secondsLeft % 60).toString().padStart(2, "0")}`}</div></div>
      <dl><div><dt>{vi ? "Giá trị quy đổi" : "Gross conversion"}</dt><dd>{vnd(active.grossVnd)}</dd></div><div><dt>{vi ? "Phí đối tác test" : "Test provider fee"}</dt><dd>− {vnd(active.providerFeeVnd)}</dd></div><div><dt>{vi ? "Phí mạng ước tính" : "Estimated network fee"}</dt><dd>− {vnd(active.networkFeeVnd)}</dd></div><div className="cashout-net"><dt>{vi ? "VND sẽ nhận · test" : "VND received · test"}</dt><dd>{vnd(active.netVnd)}</dd></div></dl>
      {active.status === "quote_ready" && <div className="cashout-confirmation"><label className="check-row"><input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} /><span>{vi ? "Tôi hiểu USDC Devnet sẽ được gửi on-chain thật, nhưng VND và tài khoản ngân hàng chỉ là thử nghiệm; thao tác này không tạo chuyển khoản ngân hàng thật." : "I understand Devnet USDC will be sent on-chain, while VND and bank details are test-only; this does not create a real bank transfer."}</span></label><button className="button button-primary" type="button" disabled={busy || (!quoteExpired && !acceptedTerms)} onClick={quoteExpired ? startNew : () => void acceptQuote()}>{busy ? (vi ? "Đang xác nhận…" : "Confirming…") : quoteExpired ? (vi ? "Tạo báo giá mới" : "Create a new quote") : (vi ? "Xác nhận & tiếp tục tới ví" : "Confirm & continue to wallet")}</button></div>}
      {active.status === "quote_expired" && <div className="cashout-expired-recovery"><div className="cashout-confirmation"><strong>{vi ? "Báo giá này đã hết hiệu lực; không gửi USDC theo lệnh cũ." : "This quote has expired; do not send USDC using the old order."}</strong><button className="button button-secondary" type="button" onClick={startNew}>{vi ? "Tạo lệnh mới" : "Create a new order"}</button></div><div className="cashout-manual-verify"><label htmlFor="cashout-expired-signature">{vi ? "Nếu đã gửi trước khi hết hạn, dán signature để khôi phục" : "If you sent before expiry, paste the signature to recover"}<input id="cashout-expired-signature" value={manualSignature} onChange={(event) => setManualSignature(event.target.value)} placeholder={vi ? "Signature công khai từ Solana Explorer" : "Public signature from Solana Explorer"} /></label><small>{vi ? "Không gửi lần hai. Backend sẽ đối chiếu ví gửi, ví nhận, mint, số tiền và finalized." : "Do not send twice. The backend checks sender, recipient, mint, amount and finalization."}</small><button className="button button-secondary" type="button" disabled={busy || !manualSignature.trim()} onClick={() => void verifyManually()}>{vi ? "Khôi phục bằng signature" : "Recover with signature"}</button></div></div>}
    </section>}

    {active && !["quote_ready", "quote_expired"].includes(active.status) && <section className="app-panel cashout-wallet-panel">
      <div className="cashout-section-heading"><div><span className="panel-kicker">{vi ? "BƯỚC 4 · KÝ & THEO DÕI" : "STEP 4 · SIGN & TRACK"}</span><h2>{statusText(active.status)}</h2><p>{vi ? "Chỉ xác nhận một lần. Nếu đã có signature, dùng kiểm tra lại thay vì gửi thêm USDC." : "Confirm only once. If you already have a signature, recheck it instead of sending more USDC."}</p></div><span className={`cashout-status-pill status-${active.status}`}>{statusText(active.status)}</span></div>
      <div className="cashout-wallet-layout"><div className="cashout-payment-actions">
        {active.status === "awaiting_wallet_signature" && !quoteExpired && <><WalletPaymentButton cashoutId={active.id} onSubmitted={(signature) => verify(signature, "automatic")} label={vi ? "Gửi USDC Devnet bằng ví" : "Send Devnet USDC with wallet"} />{active.solanaPayUrl && <a className="button button-secondary cashout-solana-pay" href={active.solanaPayUrl}>{vi ? "Mở bằng Solana Pay" : "Open with Solana Pay"}</a>}</>}
        {active.status === "awaiting_wallet_signature" && quoteExpired && <div className="cashout-bank-sandbox"><strong>{vi ? "Báo giá đã hết hạn — nút gửi đã được khóa." : "Quote expired — sending is locked."}</strong><p>{vi ? "Nếu chưa gửi, tạo lệnh mới. Nếu đã gửi, dán signature bên dưới để khôi phục." : "Create a new order if you did not send. If you already sent, paste the signature below to recover."}</p><button className="button button-secondary" type="button" onClick={startNew}>{vi ? "Tạo lệnh mới" : "Create a new order"}</button></div>}
        {["awaiting_wallet_signature", "onchain_pending", "onchain_failed"].includes(active.status) && <div className="cashout-manual-verify"><label htmlFor="cashout-signature">{vi ? "Đã gửi rồi? Dán transaction signature" : "Already sent? Paste the transaction signature"}<input id="cashout-signature" value={manualSignature} onChange={(event) => setManualSignature(event.target.value)} placeholder={vi ? "Signature công khai từ Solana Explorer" : "Public signature from Solana Explorer"} /></label><small>{vi ? "Không nhập private key hoặc seed phrase. Signature là dữ liệu công khai." : "Never enter a private key or seed phrase. A signature is public data."}</small><button className="button button-secondary" type="button" disabled={busy || !manualSignature.trim()} onClick={() => void verifyManually()}>{active.status === "onchain_pending" ? (vi ? "Kiểm tra finalized lại" : "Recheck finalization") : (vi ? "Xác minh giao dịch" : "Verify transaction")}</button></div>}
        {active.status === "bank_processing" && <div className="cashout-bank-sandbox"><strong>{vi ? "USDC đã vào settlement wallet trên Devnet." : "USDC reached the Devnet settlement wallet."}</strong><p>{vi ? "Trong bản pilot, bước ngân hàng được đối soát thử nghiệm. Production sẽ chờ webhook từ đối tác có giấy phép." : "In this pilot, the bank step is test-reconciled. Production will wait for a licensed partner webhook."}</p><button className="button button-primary" type="button" disabled={busy} onClick={() => void reconcileBankSandbox()}>{busy ? (vi ? "Đang đối soát…" : "Reconciling…") : (vi ? "Hoàn tất đối soát thử nghiệm" : "Complete test reconciliation")}</button></div>}
        {active.status === "sandbox_completed" && <div className="cashout-complete"><span aria-hidden="true">✓</span><div><strong>{vi ? "Luồng Devnet đã hoàn tất" : "Devnet flow completed"}</strong><p>{vi ? "Bằng chứng USDC on-chain là thật; mã ngân hàng bên dưới là chứng từ sandbox." : "The on-chain USDC proof is real; the bank reference below is a sandbox receipt."}</p></div><button className="button button-secondary" type="button" onClick={startNew}>{vi ? "Tạo lệnh khác" : "Create another order"}</button></div>}
      </div><div className="cashout-order-proof"><span>{vi ? "CHI TIẾT LỆNH" : "ORDER DETAILS"}</span><dl><div><dt>{vi ? "Mã lệnh" : "Order"}</dt><dd>{active.providerReference}</dd></div><div><dt>{vi ? "Ví settlement" : "Settlement wallet"}</dt><dd title={active.settlementWallet || ""}>{compact(active.settlementWallet)}</dd></div><div><dt>{vi ? "Transaction" : "Transaction"}</dt><dd>{active.explorerUrl ? <a target="_blank" rel="noreferrer" href={active.explorerUrl}>{compact(active.paymentTx)} ↗</a> : (vi ? "Chưa gửi" : "Not submitted")}</dd></div><div><dt>{vi ? "Tài khoản test" : "Test beneficiary"}</dt><dd>{active.beneficiary ? `${active.beneficiary.bankCode} · •••• ${active.beneficiary.accountLast4}` : "—"}</dd></div><div><dt>{vi ? "Mã đối soát" : "Reconciliation ref"}</dt><dd>{active.bankReference || "—"}</dd></div></dl></div></div>
      <ol className="cashout-timeline" aria-label={vi ? "Tiến trình lệnh" : "Order progress"}>{[[1, vi ? "Báo giá" : "Quote"], [2, vi ? "Ký & finalized" : "Sign & finalize"], [3, vi ? "Đối soát test" : "Test reconciliation"], [4, vi ? "Hoàn tất" : "Completed"]].map(([rank, label]) => <li key={rank} className={activeRank > Number(rank) ? "done" : activeRank === Number(rank) ? "current" : ""}><span>{activeRank > Number(rank) ? "✓" : rank}</span><b>{label}</b></li>)}</ol>
    </section>}

    <section className="app-panel cashout-history"><div className="cashout-section-heading"><div><span className="panel-kicker">{vi ? "LỊCH SỬ CỦA BẠN" : "YOUR HISTORY"}</span><h2>{vi ? "Lệnh Devnet gần đây" : "Recent Devnet orders"}</h2></div>{active && <button className="button button-secondary" type="button" onClick={startNew}>{vi ? "+ Lệnh mới" : "+ New order"}</button>}</div>{history.length ? <div className="cashout-history-list">{history.map((item) => <button type="button" className={active?.id === item.id ? "active" : ""} key={item.id} onClick={() => { setActive(item); setClock(Date.now()); setError(null); setNotice(null); }}><div><strong>{item.amountUsdc} USDC</strong><span>{item.providerReference}</span></div><div><b>{vnd(item.netVnd)}</b><small>{statusText(item.status)}</small></div></button>)}</div> : <p className="field-hint">{vi ? "Chưa có lệnh nào." : "No orders yet."}</p>}</section>
    {notice && <p className="app-notice cashout-notice" role="status">{notice}</p>}
    {error && <p className="demo-error cashout-error" role="alert">{error}</p>}
  </div>;
}

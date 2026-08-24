"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLanguage } from "./i18n";
import { WalletPaymentButton, type WalletPaymentResult } from "./wallet-payment-button";

type PayoutMethod = "keep_usdc" | "bank" | "momo" | "zalopay";
type Beneficiary = {
  id: string;
  bankCode: string;
  accountLast4: string;
  accountHolderMasked: string;
  payoutMethod: Exclude<PayoutMethod, "keep_usdc">;
  payoutProvider: string;
  verificationState: string;
  status?: string;
};
type MethodCapability = {
  id: Exclude<PayoutMethod, "keep_usdc">;
  payoutProvider: string;
  availability: "sandbox" | "setup_required";
};
type Capability = {
  network: string;
  asset: string;
  mint: string;
  devnetTransferEnabled: boolean;
  settlementWallet: string | null;
  methods: MethodCapability[];
  realPayoutEnabled: boolean;
  productionMessage?: string;
  configurationError?: string;
};
type CashoutSession = {
  id: string;
  beneficiaryId: string | null;
  amountUsdc: string;
  grossVnd: string;
  feeVnd: string;
  netVnd: string;
  provider: string;
  payoutMethod: Exclude<PayoutMethod, "keep_usdc">;
  payoutProvider: string;
  executionMode: string;
  payoutStatus: string;
  providerReference: string;
  status: string;
  rateVnd: string | null;
  providerFeeVnd: string | null;
  networkFeeVnd: string | null;
  quoteExpiresAt: string | null;
  settlementWallet: string | null;
  reference: string | null;
  submittedTx?: string | null;
  paymentTx: string | null;
  paymentObservedAt: string | null;
  verificationState: string;
  lastErrorCode: string | null;
  bankReference: string | null;
  termsAcceptedAt: string | null;
  beneficiary: Beneficiary | null;
  solanaPayUrl: string | null;
  explorerUrl: string | null;
  createdAt: string;
  updatedAt: string;
};
type AssetResponse = { assets?: Array<{ symbol: string; display: string }> };

const BANKS = ["VCB", "BIDV", "CTG", "TCB", "MB", "ACB", "VPB", "VIB", "TPB", "STB"];
const STATUS_RANK: Record<string, number> = {
  quote_ready: 1,
  awaiting_wallet_signature: 2,
  onchain_pending: 2,
  onchain_failed: 2,
  bank_processing: 3,
  sandbox_completed: 4,
};
const METHOD_COPY: Record<PayoutMethod, { vi: string; en: string; viDescription: string; enDescription: string }> = {
  keep_usdc: {
    vi: "Giữ USDC trong ví",
    en: "Keep USDC in wallet",
    viDescription: "Nhanh nhất. Không đổi tiền và không cần nhập nơi nhận VND.",
    enDescription: "Fastest. No conversion or VND destination is needed.",
  },
  bank: {
    vi: "Nhận VND vào ngân hàng",
    en: "Receive VND to bank",
    viDescription: "Dễ dùng nhất khi off-ramp và đối tác chi tiền được kích hoạt.",
    enDescription: "The clearest option when an off-ramp and payout partner are activated.",
  },
  momo: {
    vi: "Nhận vào ví MoMo",
    en: "Receive in MoMo",
    viDescription: "Dùng số điện thoại ví MoMo để nhận VND.",
    enDescription: "Use your MoMo wallet phone number to receive VND.",
  },
  zalopay: {
    vi: "Nhận vào ví ZaloPay",
    en: "Receive in ZaloPay",
    viDescription: "Dùng số điện thoại ví ZaloPay để nhận VND.",
    enDescription: "Use your ZaloPay wallet phone number to receive VND.",
  },
};

function vnd(value: string | number | null | undefined) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function compact(value: string | null | undefined, head = 6, tail = 5) {
  if (!value) return "—";
  return value.length > head + tail + 2 ? value.slice(0, head) + "…" + value.slice(-tail) : value;
}

function normalizeBeneficiary(input: Record<string, unknown>): Beneficiary {
  return {
    id: String(input.id || ""),
    bankCode: String(input.bankCode || input.bank_code || ""),
    accountLast4: String(input.accountLast4 || input.account_last4 || ""),
    accountHolderMasked: String(input.accountHolderMasked || input.account_holder_masked || ""),
    payoutMethod: String(input.payoutMethod || input.payout_method || "bank") as Beneficiary["payoutMethod"],
    payoutProvider: String(input.payoutProvider || input.payout_provider || "sandbox"),
    verificationState: String(input.verificationState || input.verification_state || "sandbox_verified"),
    status: String(input.status || "sandbox_verified"),
  };
}

function labelForMethod(method: PayoutMethod, vi: boolean) {
  return METHOD_COPY[method][vi ? "vi" : "en"];
}

function descriptionForMethod(method: PayoutMethod, vi: boolean) {
  return METHOD_COPY[method][vi ? "viDescription" : "enDescription"];
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
  const [selectedMethod, setSelectedMethod] = useState<PayoutMethod>("bank");
  const [amount, setAmount] = useState("");
  const [bankCode, setBankCode] = useState("VCB");
  const [destination, setDestination] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [manualSignature, setManualSignature] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [clock, setClock] = useState(0);

  const load = useCallback(async (keepActive = true) => {
    const results = await Promise.all([
      fetch("/api/cashout", { cache: "no-store" }),
      fetch("/api/cashout/beneficiaries", { cache: "no-store" }),
      fetch("/api/wallet/assets", { cache: "no-store" }),
    ]);
    const ordersResponse = results[0];
    const beneficiariesResponse = results[1];
    const assetsResponse = results[2];
    if (ordersResponse.ok) {
      const data = await ordersResponse.json() as { sessions: CashoutSession[]; capabilities: Capability };
      setHistory(data.sessions);
      setCapabilities(data.capabilities);
      setActive((current) => keepActive && current ? data.sessions.find((item) => item.id === current.id) || current : data.sessions[0] || null);
    }
    if (beneficiariesResponse.ok) {
      const data = await beneficiariesResponse.json() as { beneficiaries: Array<Record<string, unknown>> };
      setBeneficiaries(data.beneficiaries.map(normalizeBeneficiary));
    }
    if (assetsResponse.ok) {
      const data = await assetsResponse.json() as AssetResponse;
      const usdc = data.assets?.find((asset) => asset.symbol === "USDC");
      setWalletUsdc(usdc?.display || "0");
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

  const methodBeneficiaries = useMemo(
    () => selectedMethod === "keep_usdc" ? [] : beneficiaries.filter((item) => item.payoutMethod === selectedMethod),
    [beneficiaries, selectedMethod],
  );
  const selectedBeneficiary = useMemo(
    () => methodBeneficiaries.find((item) => item.id === beneficiaryId) || methodBeneficiaries[0] || null,
    [beneficiaryId, methodBeneficiaries],
  );

  const secondsLeft = active?.quoteExpiresAt ? Math.max(0, Math.ceil((new Date(active.quoteExpiresAt).getTime() - clock) / 1_000)) : 0;
  const quoteExpired = Boolean(active?.quoteExpiresAt && secondsLeft <= 0 && !active.paymentTx);
  const step = selectedMethod === "keep_usdc" ? 0 : !selectedBeneficiary ? 1 : !active ? 2 : active.status === "quote_ready" ? 3 : 4;
  const activeRank = active ? STATUS_RANK[active.status] || 0 : 0;

  async function createBeneficiary() {
    if (selectedMethod === "keep_usdc") return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/cashout/beneficiaries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method: selectedMethod, bankCode, destination, accountHolder }),
      });
      const data = await response.json() as { beneficiary?: Record<string, unknown>; error?: string };
      if (!response.ok || !data.beneficiary) throw new Error(data.error || (vi ? "Không thể lưu nơi nhận thử nghiệm." : "Unable to save the test destination."));
      const beneficiary = normalizeBeneficiary(data.beneficiary);
      setBeneficiaries((current) => [beneficiary, ...current.filter((item) => item.id !== beneficiary.id)]);
      setBeneficiaryId(beneficiary.id);
      setDestination("");
      setAccountHolder("");
      setNotice(vi ? "Đã lưu bản che dữ liệu. SkillBridge không lưu số đầy đủ." : "A masked destination was saved. SkillBridge did not store the full number.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function createQuote() {
    if (selectedMethod === "keep_usdc") return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/cashout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountUsdc: amount, beneficiaryId: selectedBeneficiary?.id, payoutMethod: selectedMethod }),
      });
      const data = await response.json() as { session?: CashoutSession; error?: string };
      if (!response.ok || !data.session) throw new Error(data.error || (vi ? "Không thể tạo báo giá." : "Unable to create a quote."));
      setActive(data.session);
      setHistory((current) => [data.session!, ...current.filter((item) => item.id !== data.session!.id)]);
      setAcceptedTerms(false); setManualSignature(""); setClock(Date.now());
      setNotice(vi ? "Báo giá Devnet đã khóa trong 5 phút." : "The Devnet quote is locked for five minutes.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function acceptQuote() {
    if (!active) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/cashout/" + active.id, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "accept_quote", acceptedTerms }),
      });
      const data = await response.json() as { session?: CashoutSession; error?: string };
      if (!response.ok || !data.session) throw new Error(data.error || (vi ? "Không thể xác nhận báo giá." : "Unable to accept the quote."));
      setActive(data.session);
      setNotice(vi ? "Báo giá đã xác nhận. Ví sẽ hiển thị số USDC Devnet cần gửi." : "Quote accepted. Your wallet will show the Devnet USDC amount.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function verify(signature: string, mode: "automatic" | "manual"): Promise<WalletPaymentResult> {
    if (!active) return { status: "pending" };
    setError(null); setNotice(null);
    const response = await fetch("/api/cashout/" + active.id + "/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ signature, mode }),
    });
    const data = await response.json() as { session?: CashoutSession; error?: string };
    if (data.session) setActive(data.session);
    if (!response.ok) {
      setError(data.error || (vi ? "Chưa xác minh được giao dịch." : "The transaction could not be verified."));
      await load();
      return { status: "pending" };
    }
    setManualSignature(signature);
    setNotice(vi ? "USDC Devnet đã finalized. Không gửi thêm USDC." : "Devnet USDC is finalized. Do not send any more USDC.");
    await load();
    return { status: "funded" };
  }

  async function verifyManually() {
    if (!manualSignature.trim()) return;
    setBusy(true);
    try { await verify(manualSignature.trim(), "manual"); }
    finally { setBusy(false); }
  }

  async function reconcileSandbox() {
    if (!active) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/cashout/" + active.id, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "refresh" }),
      });
      const data = await response.json() as { session?: CashoutSession; error?: string };
      if (!response.ok || !data.session) throw new Error(data.error || (vi ? "Không thể đối soát trạng thái." : "Unable to reconcile the status."));
      setActive(data.session);
      setNotice(vi ? "Luồng Devnet đã hoàn tất. Không có VND thật được chuyển." : "The Devnet flow is complete. No real VND was transferred.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  function startNew() {
    setActive(null); setAmount(""); setAcceptedTerms(false); setManualSignature(""); setError(null); setNotice(null);
  }

  function statusText(status: string) {
    const map: Record<string, [string, string]> = {
      quote_ready: ["Báo giá sẵn sàng", "Quote ready"],
      quote_expired: ["Báo giá hết hạn", "Quote expired"],
      awaiting_wallet_signature: ["Chờ ký bằng ví", "Awaiting wallet signature"],
      onchain_pending: ["Đang chờ finalized", "Awaiting finalization"],
      onchain_failed: ["Cần kiểm tra giao dịch", "Transaction needs attention"],
      bank_processing: ["Đang đối soát nơi nhận", "Reconciling destination"],
      sandbox_completed: ["Hoàn tất Devnet", "Devnet completed"],
    };
    return map[status]?.[vi ? 0 : 1] || status.replaceAll("_", " ");
  }

  function chooseMethod(method: PayoutMethod) {
    setSelectedMethod(method);
    startNew();
  }

  return <div className="workspace-product-content cashout-workspace">
    <div className="app-welcome cashout-welcome">
      <div>
        <span>{vi ? "NHẬN TIỀN THƯỞNG · DEVNET" : "RECEIVE REWARD · DEVNET"}</span>
        <h1>{vi ? "Chọn cách bạn muốn nhận phần thưởng." : "Choose how you want to receive your reward."}</h1>
        <p>{vi ? "Giữ USDC trong ví hoặc thử luồng đổi sang VND. Giao dịch USDC chạy trên Solana Devnet; VND chỉ là mô phỏng cho tới khi đối tác off-ramp được cấp phép được kết nối." : "Keep USDC in your wallet or try the VND conversion flow. USDC runs on Solana Devnet; VND remains simulated until a licensed off-ramp partner is connected."}</p>
      </div>
      <div className="identity-card cashout-mode-card">
        <small>{vi ? "CHẾ ĐỘ HIỆN TẠI" : "CURRENT MODE"}</small>
        <strong>DEVNET</strong>
        <b>{capabilities?.devnetTransferEnabled ? (vi ? "USDC on-chain hoạt động" : "On-chain USDC enabled") : (vi ? "Cần cấu hình settlement" : "Settlement setup required")}</b>
      </div>
    </div>

    <div className="cashout-safety-banner" role="note">
      <span aria-hidden="true">i</span>
      <div>
        <strong>{vi ? "Bạn đang thử luồng an toàn" : "You are testing a safe flow"}</strong>
        <p>{vi ? "Không nhập số tài khoản hoặc số điện thoại thật. USDC Devnet có thể xem trên Explorer; số VND, tỷ giá và nơi nhận trong luồng này chỉ phục vụ kiểm thử." : "Do not enter a real account or phone number. Devnet USDC can be seen in Explorer; VND, rates, and destinations here are for testing only."}</p>
      </div>
    </div>
    {capabilities?.configurationError && <p className="app-notice cashout-config-error" role="alert">{capabilities.configurationError}</p>}

    <section className="app-panel cashout-method-panel" aria-labelledby="cashout-method-heading">
      <div className="cashout-section-heading">
        <div><span className="panel-kicker">{vi ? "BƯỚC 1 · CÁCH NHẬN" : "STEP 1 · RECEIVE METHOD"}</span><h2 id="cashout-method-heading">{vi ? "Bạn muốn nhận thưởng như thế nào?" : "How would you like to receive your reward?"}</h2></div>
        <span className="cashout-security-chip">{vi ? "Bạn luôn tự quyết định" : "You stay in control"}</span>
      </div>
      <div className="cashout-method-grid" role="radiogroup" aria-label={vi ? "Cách nhận phần thưởng" : "Reward receiving method"}>
        {(Object.keys(METHOD_COPY) as PayoutMethod[]).map((method) => {
          const methodCapability = method === "keep_usdc" ? null : capabilities?.methods.find((item) => item.id === method);
          const selected = selectedMethod === method;
          const stateLabel = method === "keep_usdc" ? (vi ? "Không cần đổi tiền" : "No conversion") : methodCapability?.availability === "setup_required" ? (vi ? "Đang chuẩn bị production" : "Production setup") : (vi ? "Môi trường thử nghiệm" : "Test environment");
          return <button className={"cashout-method-card " + (selected ? "active" : "")} type="button" role="radio" aria-checked={selected} key={method} onClick={() => chooseMethod(method)}>
            <span className="cashout-method-card-top"><strong>{labelForMethod(method, vi)}</strong><small>{stateLabel}</small></span>
            <span>{descriptionForMethod(method, vi)}</span>
            {method !== "keep_usdc" && <em>{vi ? "Đối soát qua " : "Reconciled via "}{methodCapability?.payoutProvider || "sandbox"}</em>}
          </button>;
        })}
      </div>
    </section>

    {selectedMethod === "keep_usdc" ? <section className="app-panel cashout-retain-panel">
      <div><span className="panel-kicker">{vi ? "KHÔNG CẦN GIAO DỊCH" : "NO TRANSFER NEEDED"}</span><h2>{vi ? "USDC vẫn ở trong ví của bạn." : "Your USDC stays in your wallet."}</h2><p>{vi ? "Đây là cách nhanh nhất. SkillBridge không giữ private key và không cần bạn ký thêm giao dịch." : "This is the fastest route. SkillBridge never holds your private key and no extra signature is required."}</p></div>
      <div className="cashout-retain-balance"><span>{vi ? "Số dư USDC Devnet đang đọc được" : "Readable Devnet USDC balance"}</span><strong>{walletUsdc} USDC</strong></div>
    </section> : <>
      <ol className="cashout-stepper" aria-label={vi ? "Các bước nhận VND thử nghiệm" : "Test VND receiving steps"}>
        {[[1, vi ? "Nơi nhận" : "Destination"], [2, vi ? "Số tiền" : "Amount"], [3, vi ? "Báo giá" : "Quote"], [4, vi ? "Ví & trạng thái" : "Wallet & status"]].map(([number, label]) => <li key={number} className={step === number ? "active" : step > Number(number) ? "done" : ""}><span>{step > Number(number) ? "✓" : number}</span><b>{label}</b></li>)}
      </ol>

      <div className="cashout-flow-grid">
        <section className="app-panel cashout-beneficiary-panel">
          <div className="cashout-section-heading"><div><span className="panel-kicker">{vi ? "BƯỚC 2 · NƠI NHẬN" : "STEP 2 · DESTINATION"}</span><h2>{selectedMethod === "bank" ? (vi ? "Tài khoản ngân hàng thử nghiệm" : "Test bank account") : (vi ? "Ví " + labelForMethod(selectedMethod, true) + " thử nghiệm" : "Test " + labelForMethod(selectedMethod, false) + " wallet")}</h2></div><span className="cashout-security-chip">{vi ? "Chỉ lưu bản che" : "Masked only"}</span></div>
          {methodBeneficiaries.length > 0 && <label>{vi ? "Nơi nhận đã lưu" : "Saved destination"}<select value={selectedBeneficiary?.id || ""} onChange={(event) => setBeneficiaryId(event.target.value)}>{methodBeneficiaries.map((item) => <option key={item.id} value={item.id}>{item.bankCode} · •••• {item.accountLast4} · {item.accountHolderMasked}</option>)}</select></label>}
          <details className="cashout-beneficiary-form" open={!methodBeneficiaries.length}>
            <summary>{methodBeneficiaries.length ? (vi ? "+ Thêm nơi nhận khác" : "+ Add another destination") : (vi ? "Thêm nơi nhận thử nghiệm" : "Add a test destination")}</summary>
            <div className="cashout-form-grid">
              {selectedMethod === "bank" && <label>{vi ? "Ngân hàng" : "Bank"}<select value={bankCode} onChange={(event) => setBankCode(event.target.value)}>{BANKS.map((bank) => <option key={bank}>{bank}</option>)}</select></label>}
              <label className={selectedMethod === "bank" ? "" : "full"}>{selectedMethod === "bank" ? (vi ? "Số tài khoản thử nghiệm" : "Test account number") : (vi ? "Số điện thoại ví thử nghiệm" : "Test wallet phone number")}<input inputMode="numeric" autoComplete="off" value={destination} onChange={(event) => setDestination(event.target.value.replace(/\D/g, ""))} placeholder={selectedMethod === "bank" ? "0123456789" : "0901234567"} /></label>
              <label className="full">{vi ? "Tên người nhận thử nghiệm" : "Test recipient name"}<input autoComplete="off" value={accountHolder} onChange={(event) => setAccountHolder(event.target.value)} placeholder={vi ? "NGUYEN VAN A (dữ liệu giả)" : "TEST USER (fake data)"} /></label>
            </div>
            <button className="button button-secondary" type="button" disabled={busy || destination.length < 6 || accountHolder.trim().length < 2} onClick={() => void createBeneficiary()}>{busy ? (vi ? "Đang lưu…" : "Saving…") : (vi ? "Lưu nơi nhận đã che" : "Save masked destination")}</button>
          </details>
        </section>

        <section className="app-panel cashout-amount-panel">
          <div><span className="panel-kicker">{vi ? "BƯỚC 3 · SỐ TIỀN" : "STEP 3 · AMOUNT"}</span><h2>{vi ? "Bạn muốn đổi bao nhiêu USDC?" : "How much USDC do you want to convert?"}</h2><p>{vi ? "Số dư ví Devnet hiện đọc được: " + walletUsdc + " USDC." : "Current readable Devnet wallet balance: " + walletUsdc + " USDC."}</p></div>
          <div className="cashout-amount-entry"><label>{vi ? "USDC Devnet" : "Devnet USDC"}<div className="cashout-token-input"><input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="25" /><span>USDC</span></div></label><button className="button button-primary" type="button" disabled={busy || !selectedBeneficiary || !amount.trim() || !capabilities?.devnetTransferEnabled} onClick={() => void createQuote()}>{busy ? (vi ? "Đang lấy báo giá…" : "Getting quote…") : (vi ? "Xem báo giá 5 phút" : "View a 5-minute quote")}</button></div>
          {selectedBeneficiary && <small className="field-hint">{vi ? "Đối soát thử nghiệm tới" : "Test reconciliation to"}: {selectedBeneficiary.bankCode} · •••• {selectedBeneficiary.accountLast4}</small>}
        </section>
      </div>
    </>}

    {active && <section className="cashout-quote" aria-live="polite">
      <div className="cashout-quote-lead"><span>{vi ? "BÁO GIÁ CÓ THỜI HẠN · DEVNET TEST" : "TIME-LIMITED QUOTE · DEVNET TEST"}</span><strong>{active.amountUsdc} USDC</strong><small>{vi ? "Khóa ở " + vnd(active.rateVnd) + " / USDC" : "Locked at " + vnd(active.rateVnd) + " / USDC"}</small><div className={"cashout-countdown " + (quoteExpired ? "expired" : "")}><span aria-hidden="true">◷</span>{quoteExpired ? (vi ? "Đã hết hạn" : "Expired") : String(Math.floor(secondsLeft / 60)).padStart(2, "0") + ":" + String(secondsLeft % 60).padStart(2, "0")}</div></div>
      <dl><div><dt>{vi ? "Giá trị quy đổi" : "Gross conversion"}</dt><dd>{vnd(active.grossVnd)}</dd></div><div><dt>{vi ? "Phí đối tác test" : "Test provider fee"}</dt><dd>− {vnd(active.providerFeeVnd)}</dd></div><div><dt>{vi ? "Phí mạng ước tính" : "Estimated network fee"}</dt><dd>− {vnd(active.networkFeeVnd)}</dd></div><div className="cashout-net"><dt>{vi ? "VND sẽ nhận · test" : "VND received · test"}</dt><dd>{vnd(active.netVnd)}</dd></div></dl>
      {active.status === "quote_ready" && <div className="cashout-confirmation"><label className="check-row"><input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} /><span>{vi ? "Tôi hiểu đây là giao dịch USDC Devnet thật, nhưng VND và nơi nhận chỉ là thử nghiệm; thao tác này không tạo chuyển khoản VND thật." : "I understand this is a real Devnet USDC transaction, while VND and the destination are test-only; this does not create a real VND transfer."}</span></label><button className="button button-primary" type="button" disabled={busy || (!quoteExpired && !acceptedTerms)} onClick={quoteExpired ? startNew : () => void acceptQuote()}>{busy ? (vi ? "Đang xác nhận…" : "Confirming…") : quoteExpired ? (vi ? "Tạo báo giá mới" : "Create a new quote") : (vi ? "Xác nhận & tiếp tục tới ví" : "Confirm & continue to wallet")}</button></div>}
      {active.status === "quote_expired" && <div className="cashout-expired-recovery"><div className="cashout-confirmation"><strong>{vi ? "Báo giá đã hết hiệu lực; không gửi USDC theo lệnh cũ." : "This quote has expired; do not send USDC using the old order."}</strong><button className="button button-secondary" type="button" onClick={startNew}>{vi ? "Tạo lệnh mới" : "Create a new order"}</button></div><div className="cashout-manual-verify"><label htmlFor="cashout-expired-signature">{vi ? "Đã gửi trước khi hết hạn? Dán signature để khôi phục" : "Sent before expiry? Paste the signature to recover"}<input id="cashout-expired-signature" value={manualSignature} onChange={(event) => setManualSignature(event.target.value)} placeholder={vi ? "Signature công khai từ Solana Explorer" : "Public signature from Solana Explorer"} /></label><small>{vi ? "Không gửi lần hai. Backend đối chiếu ví gửi, ví nhận, mint, số tiền và finalized." : "Do not send twice. The backend checks sender, recipient, mint, amount and finalization."}</small><button className="button button-secondary" type="button" disabled={busy || !manualSignature.trim()} onClick={() => void verifyManually()}>{vi ? "Khôi phục bằng signature" : "Recover with signature"}</button></div></div>}
    </section>}

    {active && !["quote_ready", "quote_expired"].includes(active.status) && <section className="app-panel cashout-wallet-panel">
      <div className="cashout-section-heading"><div><span className="panel-kicker">{vi ? "BƯỚC 5 · KÝ & THEO DÕI" : "STEP 5 · SIGN & TRACK"}</span><h2>{statusText(active.status)}</h2><p>{vi ? "Chỉ ký một lần. Nếu đã có signature, hãy kiểm tra lại thay vì gửi thêm USDC." : "Sign only once. If you already have a signature, recheck it instead of sending more USDC."}</p></div><span className={"cashout-status-pill status-" + active.status}>{statusText(active.status)}</span></div>
      <div className="cashout-wallet-layout">
        <div className="cashout-payment-actions">
          {active.status === "awaiting_wallet_signature" && !quoteExpired && <><WalletPaymentButton cashoutId={active.id} onSubmitted={(signature) => verify(signature, "automatic")} label={vi ? "Gửi USDC Devnet bằng ví" : "Send Devnet USDC with wallet"} />{active.solanaPayUrl && <a className="button button-secondary cashout-solana-pay" href={active.solanaPayUrl}>{vi ? "Mở bằng Solana Pay" : "Open with Solana Pay"}</a>}</>}
          {active.status === "awaiting_wallet_signature" && quoteExpired && <div className="cashout-bank-sandbox"><strong>{vi ? "Báo giá đã hết hạn — nút gửi đã được khóa." : "Quote expired — sending is locked."}</strong><p>{vi ? "Nếu chưa gửi, tạo lệnh mới. Nếu đã gửi, dán signature để khôi phục." : "Create a new order if you did not send. If you already sent, paste the signature below to recover."}</p><button className="button button-secondary" type="button" onClick={startNew}>{vi ? "Tạo lệnh mới" : "Create a new order"}</button></div>}
          {["awaiting_wallet_signature", "onchain_pending", "onchain_failed"].includes(active.status) && <div className="cashout-manual-verify"><label htmlFor="cashout-signature">{vi ? "Đã gửi rồi? Dán transaction signature" : "Already sent? Paste the transaction signature"}<input id="cashout-signature" value={manualSignature} onChange={(event) => setManualSignature(event.target.value)} placeholder={vi ? "Signature công khai từ Solana Explorer" : "Public signature from Solana Explorer"} /></label><small>{vi ? "Không nhập private key hoặc seed phrase. Signature là dữ liệu công khai." : "Never enter a private key or seed phrase. A signature is public data."}</small><button className="button button-secondary" type="button" disabled={busy || !manualSignature.trim()} onClick={() => void verifyManually()}>{active.status === "onchain_pending" ? (vi ? "Kiểm tra finalized lại" : "Recheck finalization") : (vi ? "Xác minh giao dịch" : "Verify transaction")}</button></div>}
          {active.status === "bank_processing" && <div className="cashout-bank-sandbox"><strong>{vi ? "USDC đã vào settlement wallet. Bước " + labelForMethod(active.payoutMethod, true) + " đang được mô phỏng." : "USDC reached the settlement wallet. The " + labelForMethod(active.payoutMethod, false) + " step is simulated."}</strong><p>{vi ? "Production sẽ đợi webhook có chữ ký từ " + active.payoutProvider + "; chưa có VND thật được chuyển." : "Production will wait for a signed " + active.payoutProvider + " webhook; no real VND has moved."}</p><button className="button button-primary" type="button" disabled={busy} onClick={() => void reconcileSandbox()}>{busy ? (vi ? "Đang đối soát…" : "Reconciling…") : (vi ? "Hoàn tất đối soát thử nghiệm" : "Complete test reconciliation")}</button></div>}
          {active.status === "sandbox_completed" && <div className="cashout-complete"><span aria-hidden="true">✓</span><div><strong>{vi ? "Luồng Devnet đã hoàn tất" : "Devnet flow completed"}</strong><p>{vi ? "Bằng chứng USDC on-chain là thật; chứng từ " + labelForMethod(active.payoutMethod, true) + " bên dưới chỉ là sandbox." : "The on-chain USDC proof is real; the " + labelForMethod(active.payoutMethod, false) + " receipt below is sandbox-only."}</p></div><button className="button button-secondary" type="button" onClick={startNew}>{vi ? "Tạo lệnh khác" : "Create another order"}</button></div>}
        </div>
        <div className="cashout-order-proof"><span>{vi ? "CHI TIẾT LỆNH" : "ORDER DETAILS"}</span><dl><div><dt>{vi ? "Mã lệnh" : "Order"}</dt><dd>{active.providerReference}</dd></div><div><dt>{vi ? "Cách nhận" : "Receive method"}</dt><dd>{labelForMethod(active.payoutMethod, vi)} · {active.payoutProvider}</dd></div><div><dt>{vi ? "Ví settlement" : "Settlement wallet"}</dt><dd title={active.settlementWallet || ""}>{compact(active.settlementWallet)}</dd></div><div><dt>{vi ? "Transaction" : "Transaction"}</dt><dd>{active.explorerUrl ? <a target="_blank" rel="noreferrer" href={active.explorerUrl}>{compact(active.paymentTx)} ↗</a> : (vi ? "Chưa gửi" : "Not submitted")}</dd></div><div><dt>{vi ? "Nơi nhận test" : "Test destination"}</dt><dd>{active.beneficiary ? active.beneficiary.bankCode + " · •••• " + active.beneficiary.accountLast4 : "—"}</dd></div><div><dt>{vi ? "Mã đối soát" : "Reconciliation ref"}</dt><dd>{active.bankReference || "—"}</dd></div></dl></div>
      </div>
      <ol className="cashout-timeline" aria-label={vi ? "Tiến trình lệnh" : "Order progress"}>{[[1, vi ? "Báo giá" : "Quote"], [2, vi ? "Ký & finalized" : "Sign & finalize"], [3, vi ? "Đối soát test" : "Test reconciliation"], [4, vi ? "Hoàn tất" : "Completed"]].map(([rank, label]) => <li key={rank} className={activeRank > Number(rank) ? "done" : activeRank === Number(rank) ? "current" : ""}><span>{activeRank > Number(rank) ? "✓" : rank}</span><b>{label}</b></li>)}</ol>
    </section>}

    <section className="app-panel cashout-history">
      <div className="cashout-section-heading"><div><span className="panel-kicker">{vi ? "LỊCH SỬ CỦA BẠN" : "YOUR HISTORY"}</span><h2>{vi ? "Lệnh Devnet gần đây" : "Recent Devnet orders"}</h2></div>{active && <button className="button button-secondary" type="button" onClick={startNew}>{vi ? "+ Lệnh mới" : "+ New order"}</button>}</div>
      {history.length ? <div className="cashout-history-list">{history.map((item) => <button type="button" className={active?.id === item.id ? "active" : ""} key={item.id} onClick={() => { setActive(item); setSelectedMethod(item.payoutMethod); setClock(Date.now()); setError(null); setNotice(null); }}><div><strong>{item.amountUsdc} USDC</strong><span>{labelForMethod(item.payoutMethod, vi)} · {item.providerReference}</span></div><div><b>{vnd(item.netVnd)}</b><small>{statusText(item.status)}</small></div></button>)}</div> : <p className="field-hint">{vi ? "Chưa có lệnh nào." : "No orders yet."}</p>}
    </section>
    {notice && <p className="app-notice cashout-notice" role="status">{notice}</p>}
    {error && <p className="demo-error cashout-error" role="alert">{error}</p>}
  </div>;
}

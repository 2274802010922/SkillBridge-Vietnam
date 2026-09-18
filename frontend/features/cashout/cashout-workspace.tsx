"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BANK_DIRECTORY, type BankDirectoryEntry } from "@/shared/data/bank-directory";
import { useLanguage } from "../../i18n/i18n";
import { ContentSkeleton } from "../../components/feedback/loading-ui";
import { WalletPaymentButton } from "../../components/wallet/wallet-payment-button";

type PayoutMethod = "keep_usdc" | "bank" | "momo" | "zalopay";
type Beneficiary = {
  id: string;
  bankCode: string;
  bankBin?: string | null;
  bankName?: string | null;
  accountLast4: string;
  accountHolderMasked: string;
  payoutMethod: Exclude<PayoutMethod, "keep_usdc">;
  payoutProvider: string;
  verificationState: string;
  verificationProvider?: string | null;
  verifiedAt?: string | null;
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
type FxSource = {
  provider: string;
  pair: "USDC/USD" | "USD/VND";
  rate: string;
  updatedAt: string;
  freshness: "live" | "delayed" | "fallback" | "unavailable";
  confidence?: string | null;
  message?: string | null;
};
type FxReference = {
  usdcUsd: string;
  usdVnd: string;
  usdcVnd: string;
  updatedAt: string;
  freshness: "live" | "delayed" | "fallback";
  sources: FxSource[];
  deviationBps: string;
  warning: string | null;
};
type CashoutSession = {
  network: string;
  mint: string | null;
  amountAtomic: string;
  reference: string;
  submittedTx: string | null;
  fundingDeadline: string | null;
  cryptoStatus: string;
  id: string;
  beneficiaryId: string | null;
  amountUsdc: string;
  grossVnd: string;
  feeVnd: string;
  netVnd: string;
  provider: string;
  payoutMethod: Exclude<PayoutMethod, "keep_usdc">;
  payoutProvider: string;
  payoutStatus: string;
  providerReference: string;
  status: string;
  rateVnd: string | null;
  providerFeeVnd: string | null;
  networkFeeVnd: string | null;
  quoteExpiresAt: string | null;
  rateSource: string;
  quoteId: string | null;
  referenceRateVnd: string | null;
  usdcUsdRate: string | null;
  usdVndRate: string | null;
  referenceUpdatedAt: string | null;
  referenceFreshness: string | null;
  spreadBps: string | null;
  settlementWallet: string | null;
  paymentTx: string | null;
  verificationState: string;
  lastErrorCode: string | null;
  bankReference: string | null;
  termsAcceptedAt: string | null;
  beneficiary: Beneficiary | null;
  solanaPayUrl: string | null;
  explorerUrl: string | null;
  createdAt: string;
};

const METHOD_COPY: Record<
  PayoutMethod,
  { vi: string; en: string; viDescription: string; enDescription: string }
> = {
  keep_usdc: {
    vi: "Giữ USDC trong ví",
    en: "Keep USDC in wallet",
    viDescription: "Không đổi tiền, không cần nơi nhận VND.",
    enDescription: "No conversion or VND destination needed.",
  },
  bank: {
    vi: "Nhận VND vào ngân hàng",
    en: "Receive VND to bank",
    viDescription: "Chọn ngân hàng, kiểm tra nơi nhận rồi xem báo giá.",
    enDescription: "Choose a bank, check the destination, then review a quote.",
  },
  momo: {
    vi: "Nhận vào ví MoMo",
    en: "Receive in MoMo",
    viDescription: "Dùng số điện thoại ví MoMo.",
    enDescription: "Use your MoMo wallet phone number.",
  },
  zalopay: {
    vi: "Nhận vào ví ZaloPay",
    en: "Receive in ZaloPay",
    viDescription: "Dùng số điện thoại ví ZaloPay.",
    enDescription: "Use your ZaloPay wallet phone number.",
  },
};
const STATUS_RANK: Record<string, number> = {
  quote_ready: 1,
  awaiting_wallet_signature: 2,
  onchain_pending: 2,
  onchain_failed: 2,
  bank_processing: 3,
  sandbox_completed: 4,
  reconciliation_required: 3,
  payout_failed: 3,
};

function vnd(value: string | number | null | undefined) {
  const amount = Number(value || 0);
  return (
    new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(
      Number.isFinite(amount) ? amount : 0,
    ) + " đ"
  );
}
function compact(value: string | null | undefined, head = 6, tail = 5) {
  if (!value) return "—";
  return value.length > head + tail + 2
    ? value.slice(0, head) + "…" + value.slice(-tail)
    : value;
}
function methodLabel(method: PayoutMethod, vi: boolean) {
  return METHOD_COPY[method][vi ? "vi" : "en"];
}
function methodDescription(method: PayoutMethod, vi: boolean) {
  return METHOD_COPY[method][vi ? "viDescription" : "enDescription"];
}
function normalizeBeneficiary(input: Record<string, unknown>): Beneficiary {
  return {
    id: String(input.id || ""),
    bankCode: String(input.bankCode || input.bank_code || ""),
    bankBin: input.bankBin
      ? String(input.bankBin)
      : input.bank_bin
        ? String(input.bank_bin)
        : null,
    bankName: input.bankName
      ? String(input.bankName)
      : input.bank_name
        ? String(input.bank_name)
        : null,
    accountLast4: String(input.accountLast4 || input.account_last4 || ""),
    accountHolderMasked: String(
      input.accountHolderMasked || input.account_holder_masked || "",
    ),
    payoutMethod: String(
      input.payoutMethod || input.payout_method || "bank",
    ) as Beneficiary["payoutMethod"],
    payoutProvider: String(
      input.payoutProvider || input.payout_provider || "sandbox",
    ),
    verificationState: String(
      input.verificationState ||
        input.verification_state ||
        "sandbox_confirmed",
    ),
    verificationProvider: input.verificationProvider
      ? String(input.verificationProvider)
      : input.verification_provider
        ? String(input.verification_provider)
        : null,
    verifiedAt: input.verifiedAt
      ? String(input.verifiedAt)
      : input.verified_at
        ? String(input.verified_at)
        : null,
    status: String(input.status || "sandbox_verified"),
  };
}

export function CashoutWorkspace() {
  const { locale } = useLanguage();
  const vi = locale === "vi";
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [capabilities, setCapabilities] = useState<Capability | null>(null);
  const [reference, setReference] = useState<FxReference | null>(null);
  const [history, setHistory] = useState<CashoutSession[]>([]);
  const [active, setActive] = useState<CashoutSession | null>(null);
  const [walletUsdc, setWalletUsdc] = useState("—");
  const [selectedMethod, setSelectedMethod] = useState<PayoutMethod>("bank");
  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [selectedBankCode, setSelectedBankCode] = useState("VCB");
  const [destination, setDestination] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [verification, setVerification] = useState<{
    state: string;
    message: string;
    bank: BankDirectoryEntry | null;
  } | null>(null);
  const [vietQrPayload, setVietQrPayload] = useState("");
  const [amount, setAmount] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [manualSignature, setManualSignature] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [destinationError, setDestinationError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(0);

  const load = useCallback(async (keepActive = true) => {
    const [
      ordersResponse,
      beneficiariesResponse,
      assetsResponse,
      referenceResponse,
    ] = await Promise.all([
      fetch("/api/cashout", { cache: "no-store" }),
      fetch("/api/cashout/beneficiaries", { cache: "no-store" }),
      fetch("/api/wallet/assets", { cache: "no-store" }),
      fetch("/api/fx/reference", { cache: "no-store" }),
    ]);
    if (ordersResponse.ok) {
      const data = (await ordersResponse.json()) as {
        sessions: CashoutSession[];
        capabilities: Capability;
      };
      setHistory(data.sessions);
      setCapabilities(data.capabilities);
      setActive((current) =>
        keepActive && current
          ? data.sessions.find((item) => item.id === current.id) || current
          : data.sessions[0] || null,
      );
    }
    if (beneficiariesResponse.ok) {
      const data = (await beneficiariesResponse.json()) as {
        beneficiaries: Array<Record<string, unknown>>;
      };
      setBeneficiaries(data.beneficiaries.map(normalizeBeneficiary));
    }
    if (assetsResponse.ok) {
      const data = (await assetsResponse.json()) as {
        assets?: Array<{ symbol: string; display: string }>;
      };
      setWalletUsdc(
        data.assets?.find((asset) => asset.symbol === "USDC")?.display || "0",
      );
    }
    if (referenceResponse.ok)
      setReference((await referenceResponse.json()) as FxReference);
    setClock(Date.now());
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => {
      void load(false).finally(() => setLoading(false));
    }, 0);
    const refresh = window.setInterval(() => {
      void load(true);
    }, 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(refresh);
    };
  }, [load]);
  useEffect(() => {
    if (
      !active?.quoteExpiresAt ||
      !["quote_ready", "awaiting_wallet_signature"].includes(active.status)
    )
      return;
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [active?.quoteExpiresAt, active?.status]);

  const selectedBank = useMemo(
    () => BANK_DIRECTORY.find((bank) => bank.code === selectedBankCode) || null,
    [selectedBankCode],
  );
  const methodBeneficiaries = useMemo(
    () =>
      selectedMethod === "keep_usdc"
        ? []
        : beneficiaries.filter((item) => item.payoutMethod === selectedMethod),
    [beneficiaries, selectedMethod],
  );
  const selectedBeneficiary = useMemo(
    () =>
      methodBeneficiaries.find((item) => item.id === beneficiaryId) ||
      methodBeneficiaries[0] ||
      null,
    [beneficiaryId, methodBeneficiaries],
  );
  const currentDeadline = active?.termsAcceptedAt ? active.fundingDeadline : active?.quoteExpiresAt;
  const secondsLeft = currentDeadline
    ? Math.max(
        0,
        Math.ceil((new Date(currentDeadline).getTime() - clock) / 1_000),
      )
    : 0;
  const quoteExpired = Boolean(
    currentDeadline && secondsLeft <= 0 && !active?.paymentTx && !active?.submittedTx,
  );
  const activeRank = active ? STATUS_RANK[active.status] || 0 : 0;
  const currentStep =
    selectedMethod === "keep_usdc"
      ? 0
      : !selectedBeneficiary
        ? 1
        : !active
          ? 2
          : active.status === "quote_ready"
            ? 3
            : 4;

  async function parseVietQr() {
    if (!vietQrPayload.trim()) return;
    setBusy(true);
    setDestinationError(null);
    setError(null);
    try {
      const response = await fetch("/api/cashout/beneficiaries/parse-vietqr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload: vietQrPayload }),
      });
      const data = (await response.json()) as {
        bank?: BankDirectoryEntry;
        accountNumber?: string;
        error?: string;
      };
      if (!response.ok || !data.bank || !data.accountNumber)
        throw new Error(
          data.error ||
            (vi ? "Không đọc được VietQR." : "Unable to read VietQR."),
        );
      setSelectedBankCode(data.bank.code);
      setDestination(data.accountNumber);
      setVerification(null);
      setNotice(
        vi
          ? "Đã điền ngân hàng và số tài khoản từ VietQR. Hãy kiểm tra nơi nhận trước khi lưu."
          : "Bank and account number were prefilled from VietQR. Check the destination before saving.",
      );
    } catch (caught) {
      setDestinationError(
        caught instanceof Error ? caught.message : String(caught),
      );
    } finally {
      setBusy(false);
    }
  }
  async function verifyDestination() {
    if (loading) return <div id="workspace-main" tabIndex={-1} className="cashout-workspace"><ContentSkeleton delayed variant="finance" /></div>;

  if (selectedMethod === "keep_usdc") return;
    setBusy(true);
    setDestinationError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/cashout/beneficiaries/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          method: selectedMethod,
          bankCode: selectedBankCode,
          destination,
          accountHolder,
        }),
      });
      const data = (await response.json()) as {
        verification?: {
          state: string;
          message: string;
          bank: BankDirectoryEntry | null;
        };
        error?: string;
      };
      if (!response.ok || !data.verification)
        throw new Error(
          data.error ||
            (vi
              ? "Không thể kiểm tra nơi nhận."
              : "Unable to check the destination."),
        );
      setVerification(data.verification);
      setNotice(data.verification.message);
    } catch (caught) {
      setVerification(null);
      setDestinationError(
        caught instanceof Error ? caught.message : String(caught),
      );
    } finally {
      setBusy(false);
    }
  }
  async function saveBeneficiary() {
    if (selectedMethod === "keep_usdc" || !verification) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/cashout/beneficiaries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          method: selectedMethod,
          bankCode: selectedBankCode,
          destination,
          accountHolder,
        }),
      });
      const data = (await response.json()) as {
        beneficiary?: Record<string, unknown>;
        error?: string;
      };
      if (!response.ok || !data.beneficiary)
        throw new Error(
          data.error ||
            (vi
              ? "Không thể lưu nơi nhận."
              : "Unable to save the destination."),
        );
      const beneficiary = normalizeBeneficiary(data.beneficiary);
      setBeneficiaries((current) => [
        beneficiary,
        ...current.filter((item) => item.id !== beneficiary.id),
      ]);
      setBeneficiaryId(beneficiary.id);
      setDestination("");
      setAccountHolder("");
      setVerification(null);
      setVietQrPayload("");
      setNotice(
        vi
          ? "Đã lưu nơi nhận ở dạng che. Chủ tài khoản chưa được ngân hàng xác minh trong Devnet."
          : "The destination was saved in masked form. The account owner is not bank-verified on Devnet.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }
  async function createQuote() {
    if (!selectedBeneficiary) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/cashout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amountUsdc: amount,
          beneficiaryId: selectedBeneficiary.id,
          payoutMethod: selectedMethod,
        }),
      });
      const data = (await response.json()) as {
        session?: CashoutSession;
        error?: string;
      };
      if (!response.ok || !data.session)
        throw new Error(
          data.error ||
            (vi ? "Không thể tạo báo giá." : "Unable to create a quote."),
        );
      setActive(data.session);
      setHistory((current) => [
        data.session!,
        ...current.filter((item) => item.id !== data.session!.id),
      ]);
      setAcceptedTerms(false);
      setManualSignature("");
      setClock(Date.now());
      setNotice(
        vi
          ? "Báo giá Devnet đã được khóa. Hãy kiểm tra số VND thực nhận trước khi ký ví."
          : "The Devnet quote is locked. Review the net VND before signing your wallet.",
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }
  async function acceptQuote() {
    if (!active) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/cashout/${active.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "accept_quote", acceptedTerms }),
      });
      const data = (await response.json()) as {
        session?: CashoutSession;
        error?: string;
      };
      if (!response.ok || !data.session)
        throw new Error(
          data.error ||
            (vi
              ? "Không thể xác nhận báo giá."
              : "Unable to accept the quote."),
        );
      setActive(data.session);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }
  async function verifyPayment(
    signature: string,
    mode: "automatic" | "manual",
  ) {
    if (!active || !signature) return;
    setManualSignature(signature);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/cashout/${active.id}/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ signature, mode }),
      });
      const data = (await response.json()) as {
        session?: CashoutSession;
        error?: string;
      };
      if (data.session) setActive(data.session);
      if (!response.ok)
        throw new Error(
          data.error ||
            (vi
              ? "Không thể xác minh giao dịch."
              : "Unable to verify the transaction."),
        );
      setNotice(
        vi
          ? "Đã gửi yêu cầu đối chiếu on-chain. Nếu chưa finalized, bạn chỉ cần kiểm tra lại signature này."
          : "The on-chain check was submitted. If it is not finalized yet, recheck this same signature.",
      );
      await load();
      return { status: data.session?.paymentTx ? "funded" as const : "pending" as const };
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      return { status: "pending" as const };
    } finally {
      setBusy(false);
    }
  }
  async function reconcileSandbox() {
    if (!active) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/cashout/${active.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "refresh" }),
      });
      const data = (await response.json()) as {
        session?: CashoutSession;
        error?: string;
      };
      if (!response.ok || !data.session)
        throw new Error(
          data.error ||
            (vi
              ? "Không thể đối soát thử nghiệm."
              : "Unable to reconcile the sandbox state."),
        );
      setActive(data.session);
      setNotice(
        data.session.status !== "sandbox_completed" ? (vi ? "Đã kiểm tra trạng thái. Không gửi thêm USDC." : "Status checked. Do not send more USDC.") : vi
          ? "Luồng Devnet đã hoàn tất. Không có VND thật được chuyển."
          : "The Devnet flow is complete. No real VND was transferred.",
      );
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }
  function startNew() {
    setActive(null);
    setAmount("");
    setAcceptedTerms(false);
    setManualSignature("");
    setError(null);
    setNotice(null);
    setClock(Date.now());
  }
  function statusText(status: string) {
    const labels: Record<string, [string, string]> = {
      quote_ready: ["Báo giá sẵn sàng", "Quote ready"],
      quote_expired: ["Báo giá hết hạn", "Quote expired"],
      awaiting_wallet_signature: [
        "Chờ ký bằng ví",
        "Awaiting wallet signature",
      ],
      onchain_pending: ["Đang chờ finalized", "Awaiting finalization"],
      onchain_failed: ["Cần kiểm tra giao dịch", "Transaction needs review"],
      bank_processing: ["Đang đối soát sandbox", "Sandbox reconciliation"],
      sandbox_completed: ["Luồng Devnet hoàn tất", "Devnet flow completed"],
      reconciliation_required: ["Cần đối soát giao dịch", "Deposit needs reconciliation"],
      payout_failed: ["Chi trả thử nghiệm thất bại", "Test payout failed"],
    };
    return (labels[status] || [status, status])[vi ? 0 : 1];
  }

  if (selectedMethod === "keep_usdc")
    return (
      <div id="workspace-main" tabIndex={-1} className="cashout-workspace">
        <section className="cashout-hero app-panel">
          <span className="panel-kicker">DEVNET USDC</span>
          <h1>{vi ? "Giữ USDC trong ví" : "Keep USDC in your wallet"}</h1>
          <p>
            {vi
              ? "Bạn không cần đổi tiền hoặc nhập tài khoản ngân hàng. Tài sản vẫn nằm trong ví Solana của bạn."
              : "No conversion or bank destination is needed. Your asset stays in your Solana wallet."}
          </p>
          <div className="cashout-keep-card">
            <span>{vi ? "Số dư USDC Devnet" : "Devnet USDC balance"}</span>
            <strong>{walletUsdc} USDC</strong>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => setSelectedMethod("bank")}
            >
              {vi ? "Đổi sang VND" : "Convert to VND"}
            </button>
          </div>
        </section>
      </div>
    );

  return (
    <div id="workspace-main" tabIndex={-1} className="cashout-workspace">
      <section className="cashout-hero app-panel">
        <div>
          <span className="panel-kicker">USDC → VND · SOLANA DEVNET</span>
          <h1>
            {vi
              ? "Đổi tiền minh bạch, không đoán giá."
              : "Transparent conversion, no hidden rate."}
          </h1>
          <p>
            {vi
              ? "So sánh giá tham chiếu, xem phí và số VND thực nhận trước khi ký giao dịch USDC Devnet."
              : "Compare market references, review fees and net VND before signing a Devnet USDC transfer."}
          </p>
        </div>
        <div className="cashout-hero-status">
          <span>{vi ? "Mạng" : "Network"}</span>
          <strong>Solana Devnet</strong>
          <small>
            {reference?.freshness === "live"
              ? vi
                ? "Giá tham chiếu mới"
                : "Fresh reference"
              : reference?.freshness === "fallback"
                ? "Sandbox fallback"
                : vi
                  ? "Giá tham chiếu có độ trễ"
                  : "Delayed reference"}
          </small>
        </div>
      </section>
      <section
        className="cashout-safety"
        aria-label={vi ? "Giới hạn môi trường" : "Environment boundary"}
      >
        <strong>
          {vi
            ? "USDC là giao dịch thật trên Devnet."
            : "USDC is a real Devnet transaction."}
        </strong>
        <span>
          {vi
            ? "VND, xác minh tên chủ tài khoản và payout hiện chỉ là sandbox; không có chuyển khoản ngân hàng thật."
            : "VND, account-owner verification and payout are sandbox-only; no real bank transfer is made."}
        </span>
      </section>
      <section
        className="cashout-method-picker"
        aria-label={vi ? "Chọn phương thức" : "Choose method"}
      >
        {(Object.keys(METHOD_COPY) as PayoutMethod[]).map((method) => (
          <button
            key={method}
            type="button"
            className={selectedMethod === method ? "active" : ""}
            onClick={() => {
              setSelectedMethod(method);
              setVerification(null);
              setDestinationError(null);
            }}
          >
            <strong>{methodLabel(method, vi)}</strong>
            <span>{methodDescription(method, vi)}</span>
          </button>
        ))}
      </section>
      <ol
        className="cashout-stepper"
        aria-label={vi ? "Tiến trình đổi tiền" : "Conversion progress"}
      >
        {[
          [1, vi ? "Nơi nhận" : "Destination"],
          [2, vi ? "Số tiền" : "Amount"],
          [3, vi ? "Báo giá" : "Quote"],
          [4, vi ? "Ví & trạng thái" : "Wallet & status"],
        ].map(([number, label]) => (
          <li
            key={number}
            className={
              currentStep === number
                ? "active"
                : currentStep > Number(number)
                  ? "done"
                  : ""
            }
          >
            <span>{currentStep > Number(number) ? "✓" : number}</span>
            <b>{label}</b>
          </li>
        ))}
      </ol>
      {!active && (
        <div className="cashout-flow-grid">
          <section className="app-panel cashout-beneficiary-panel">
            <div className="cashout-section-heading">
              <div>
                <span className="panel-kicker">
                  {vi ? "BƯỚC 1 · NƠI NHẬN" : "STEP 1 · DESTINATION"}
                </span>
                <h2>
                  {selectedMethod === "bank"
                    ? vi
                      ? "Tài khoản ngân hàng"
                      : "Bank account"
                    : vi
                      ? "Ví " + methodLabel(selectedMethod, true)
                      : methodLabel(selectedMethod, false) + " wallet"}
                </h2>
              </div>
              <span className="cashout-security-chip">
                {vi ? "Chỉ lưu bản che" : "Masked only"}
              </span>
            </div>
            {methodBeneficiaries.length > 0 && (
              <label>
                {vi ? "Nơi nhận đã lưu" : "Saved destination"}
                <select
                  value={selectedBeneficiary?.id || ""}
                  onChange={(event) => setBeneficiaryId(event.target.value)}
                >
                  {methodBeneficiaries.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.bankCode} · •••• {item.accountLast4} ·{" "}
                      {item.accountHolderMasked}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <details
              className="cashout-beneficiary-form"
              open={!methodBeneficiaries.length}
            >
              <summary>
                {methodBeneficiaries.length
                  ? vi
                    ? "Thêm nơi nhận khác"
                    : "Add another destination"
                  : vi
                    ? "Thêm nơi nhận"
                    : "Add destination"}
              </summary>
              {selectedMethod === "bank" && (
                <div className="cashout-vietqr">
                  <label htmlFor="vietqr-payload">
                    {vi
                      ? "Có VietQR? Dán payload để điền nhanh"
                      : "Have VietQR? Paste payload to prefill"}
                    <textarea
                      id="vietqr-payload"
                      value={vietQrPayload}
                      onChange={(event) => setVietQrPayload(event.target.value)}
                      placeholder="000201..."
                      rows={2}
                    />
                  </label>
                  <button
                    type="button"
                    className="button button-quiet"
                    disabled={busy || !vietQrPayload.trim()}
                    onClick={() => void parseVietQr()}
                  >
                    {vi ? "Đọc VietQR" : "Read VietQR"}
                  </button>
                </div>
              )}
              <div className="cashout-form-grid">
                {selectedMethod === "bank" && (
                  <label>
                    {vi ? "Ngân hàng" : "Bank"}
                    <select
                      value={selectedBankCode}
                      onChange={(event) => {
                        setSelectedBankCode(event.target.value);
                        setVerification(null);
                      }}
                    >
                      {BANK_DIRECTORY.map((bank) => (
                        <option key={bank.code} value={bank.code}>
                          {bank.shortName} · {bank.bin}
                        </option>
                      ))}
                    </select>
                    <small>
                      {selectedBank
                        ? selectedBank.shortName + " · " + selectedBank.name
                        : "—"}
                    </small>
                  </label>
                )}
                <label className={selectedMethod === "bank" ? "" : "full"}>
                  {selectedMethod === "bank"
                    ? vi
                      ? "Số tài khoản"
                      : "Account number"
                    : vi
                      ? "Số điện thoại ví"
                      : "Wallet phone number"}
                  <input
                    inputMode="numeric"
                    autoComplete="off"
                    value={destination}
                    onChange={(event) => {
                      setDestination(event.target.value.replace(/\D/g, ""));
                      setVerification(null);
                    }}
                    placeholder={
                      selectedMethod === "bank" ? "0123456789" : "0901234567"
                    }
                  />
                  <small>
                    {vi
                      ? "Không lưu số đầy đủ sau khi bạn lưu nơi nhận."
                      : "The full number is not stored after saving."}
                  </small>
                </label>
                <label className="full">
                  {vi
                    ? "Tên người nhận bạn cung cấp"
                    : "Recipient name you provide"}
                  <input
                    autoComplete="name"
                    value={accountHolder}
                    onChange={(event) => setAccountHolder(event.target.value)}
                    placeholder="NGUYEN VAN A"
                  />
                  <small>
                    {vi
                      ? "Devnet chưa thể xác minh tên này với ngân hàng."
                      : "Devnet cannot bank-verify this name yet."}
                  </small>
                </label>
              </div>
              {destinationError && (
                <p className="field-error" role="alert">
                  {destinationError}
                </p>
              )}
              {verification && (
                <div className="cashout-verification">
                  <strong>
                    {vi ? "Đã kiểm tra định dạng" : "Format checked"}
                  </strong>
                  <span>{verification.message}</span>
                </div>
              )}
              <div className="cashout-form-actions">
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={busy || destination.length < 6}
                  onClick={() => void verifyDestination()}
                >
                  {busy
                    ? vi
                      ? "Đang kiểm tra…"
                      : "Checking…"
                    : vi
                      ? "Kiểm tra nơi nhận"
                      : "Check destination"}
                </button>
                <button
                  className="button button-primary"
                  type="button"
                  disabled={
                    busy || !verification || accountHolder.trim().length < 2
                  }
                  onClick={() => void saveBeneficiary()}
                >
                  {vi ? "Lưu nơi nhận" : "Save destination"}
                </button>
              </div>
            </details>
          </section>
          <section className="app-panel cashout-amount-panel">
            <div>
              <span className="panel-kicker">
                {vi ? "BƯỚC 2 · SỐ TIỀN & GIÁ" : "STEP 2 · AMOUNT & RATE"}
              </span>
              <h2>
                {vi
                  ? "Bạn muốn đổi bao nhiêu USDC?"
                  : "How much USDC do you want to convert?"}
              </h2>
              <p>
                {vi
                  ? "Số dư Devnet hiện đọc được: " + walletUsdc + " USDC."
                  : "Readable Devnet balance: " + walletUsdc + " USDC."}
              </p>
            </div>
            <div className="cashout-token-input">
              <input
                aria-label={vi ? "Số USDC Devnet" : "Devnet USDC amount"}
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="25"
              />
              <span>USDC</span>
            </div>
            <div className="cashout-rate-reference">
              <div>
                <span>{vi ? "Tham chiếu USDC/USD" : "USDC/USD reference"}</span>
                <strong>
                  {reference ? Number(reference.usdcUsd).toFixed(4) : "—"}
                </strong>
              </div>
              <div>
                <span>{vi ? "Tham chiếu USD/VND" : "USD/VND reference"}</span>
                <strong>{reference ? vnd(reference.usdVnd) : "—"}</strong>
              </div>
              <div>
                <span>{vi ? "Tham chiếu USDC/VND" : "USDC/VND reference"}</span>
                <strong>{reference ? vnd(reference.usdcVnd) : "—"}</strong>
              </div>
            </div>
            <div className="cashout-source-list" aria-live="polite">
              {reference?.sources.map((source) => (
                <span
                  key={source.provider + source.pair}
                  className={"source-" + source.freshness}
                >
                  {source.provider} · {source.pair} ·{" "}
                  {source.rate || (vi ? "không khả dụng" : "unavailable")}
                </span>
              )) || (
                <span>
                  {vi
                    ? "Đang lấy giá tham chiếu…"
                    : "Loading reference prices…"}
                </span>
              )}
              {reference?.warning && (
                <span className="source-delayed">
                  {vi
                    ? "Các nguồn chênh " + reference.deviationBps + " bps"
                    : "Sources diverge by " + reference.deviationBps + " bps"}
                </span>
              )}
            </div>
            <button
              className="button button-primary"
              type="button"
              disabled={
                busy ||
                !selectedBeneficiary ||
                !amount.trim() ||
                !capabilities?.devnetTransferEnabled
              }
              onClick={() => void createQuote()}
            >
              {busy
                ? vi
                  ? "Đang tạo báo giá…"
                  : "Creating quote…"
                : vi
                  ? "Tạo báo giá 60 giây"
                  : "Create 60-second quote"}
            </button>
            {selectedBeneficiary && (
              <small className="field-hint">
                {vi ? "Đối soát sandbox tới" : "Sandbox reconciliation to"}:{" "}
                {selectedBeneficiary.bankName || selectedBeneficiary.bankCode} ·
                •••• {selectedBeneficiary.accountLast4}
              </small>
            )}
          </section>
        </div>
      )}
      {active && (
        <section className="cashout-quote" aria-live="polite">
          <div className="cashout-quote-lead">
            <span>
              {vi
                ? "BÁO GIÁ CÓ THỜI HẠN · DEVNET TEST"
                : "TIME-LIMITED QUOTE · DEVNET TEST"}
            </span>
            <strong>{active.amountUsdc} USDC</strong>
            <small>{vi ? "Mã báo giá" : "Quote ID"} {active.quoteId || "—"}</small>
            <div
              className={"cashout-countdown " + (quoteExpired ? "expired" : "")}
            >
              <span aria-hidden="true">◷</span>
              {!["quote_ready", "awaiting_wallet_signature"].includes(active.status)
                ? (vi ? "Báo giá đã lưu" : "Saved quote")
                : quoteExpired
                ? vi
                  ? "Đã hết hạn"
                  : "Expired"
                : String(Math.floor(secondsLeft / 60)).padStart(2, "0") +
                  ":" +
                  String(secondsLeft % 60).padStart(2, "0")}
            </div>
          </div>
          <div className="cashout-quote-compare">
            <div>
              <span>
                {vi ? "Giá thị trường tham chiếu" : "Market reference"}
              </span>
              <strong>{vnd(active.referenceRateVnd)}</strong>
              <small>
                {active.referenceFreshness === "live"
                  ? vi
                    ? "Nguồn mới"
                    : "Fresh sources"
                  : active.referenceFreshness === "fallback"
                    ? "Sandbox fallback"
                    : vi
                      ? "Nguồn có độ trễ"
                      : "Delayed sources"}
              </small>
            </div>
            <div className="selected">
              <span>SkillBridge Devnet test</span>
              <strong>{vnd(active.rateVnd)}</strong>
              <small>
                {vi ? "Giá đổi trước phí" : "Pre-fee conversion rate"}
              </small>
            </div>
            <div>
              <span>{vi ? "Bạn thực nhận" : "You receive"}</span>
              <strong>{vnd(active.netVnd)}</strong>
              <small>
                {vi ? "Không phải payout VND thật" : "Not a real VND payout"}
              </small>
            </div>
          </div>
          <dl>
            <div>
              <dt>{vi ? "Giá trị quy đổi" : "Gross conversion"}</dt>
              <dd>{vnd(active.grossVnd)}</dd>
            </div>
            <div>
              <dt>{vi ? "Phí đối tác test" : "Test provider fee"}</dt>
              <dd>− {vnd(active.providerFeeVnd)}</dd>
            </div>
            <div>
              <dt>{vi ? "Phí mạng ước tính" : "Estimated network fee"}</dt>
              <dd>− {vnd(active.networkFeeVnd)}</dd>
            </div>
            <div className="cashout-net">
              <dt>{vi ? "VND sẽ nhận · test" : "VND received · test"}</dt>
              <dd>{vnd(active.netVnd)}</dd>
            </div>
          </dl>
          {active.status === "quote_ready" && (
            <div className="cashout-confirmation">
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(event) => setAcceptedTerms(event.target.checked)}
                />
                <span>
                  {vi
                    ? "Tôi hiểu USDC Devnet được gửi on-chain thật; giá là tham chiếu và VND/nơi nhận hiện chỉ là sandbox."
                    : "I understand that Devnet USDC moves on-chain; the price is a reference and the VND/destination remain sandbox-only."}
                </span>
              </label>
              <button
                className="button button-primary"
                type="button"
                disabled={busy || !acceptedTerms || quoteExpired}
                onClick={() => void acceptQuote()}
              >
                {busy
                  ? vi
                    ? "Đang xác nhận…"
                    : "Confirming…"
                  : vi
                    ? "Xác nhận & tiếp tục tới ví"
                    : "Confirm & continue to wallet"}
              </button>
              {quoteExpired && (
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={startNew}
                >
                  {vi ? "Lấy báo giá mới" : "Get a new quote"}
                </button>
              )}
            </div>
          )}
          {active.status === "quote_expired" && (
            <div className="cashout-expired-recovery">
              <strong>
                {vi
                  ? "Báo giá đã hết hiệu lực; không gửi USDC theo lệnh cũ."
                  : "The quote has expired; do not send USDC using the old order."}
              </strong>
              <button
                className="button button-secondary"
                type="button"
                onClick={startNew}
              >
                {vi ? "Tạo báo giá mới" : "Create a new quote"}
              </button>
            </div>
          )}
        </section>
      )}
      {active && active.status !== "quote_ready" && (
        <section className="app-panel cashout-wallet-panel">
          <div className="cashout-section-heading">
            <div>
              <span className="panel-kicker">
                {vi ? "BƯỚC 4 · KÝ & THEO DÕI" : "STEP 4 · SIGN & TRACK"}
              </span>
              <h2>{statusText(active.status)}</h2>
              <p>
                {vi
                  ? "Chỉ ký một lần. Nếu đã có signature, hãy xác minh lại signature đó thay vì gửi thêm USDC."
                  : "Sign once only. If you already have a signature, verify that signature instead of sending more USDC."}
              </p>
            </div>
            <span className={"cashout-status-pill status-" + active.status}>
              {statusText(active.status)}
            </span>
          </div>
          <div className="cashout-wallet-layout">
            <div className="cashout-payment-actions">
              {active.status === "awaiting_wallet_signature" &&
                !quoteExpired && !active.submittedTx && !active.paymentTx && active.mint && active.settlementWallet && (
                  <>
                    <WalletPaymentButton
                      cashoutId={active.id}
                      cashoutExpectation={{ network: active.network, mint: active.mint, recipientWallet: active.settlementWallet, amountAtomic: active.amountAtomic, reference: active.reference }}
                      onSubmitted={(signature) =>
                        verifyPayment(signature, "automatic")
                      }
                      label={
                        vi
                          ? "Gửi USDC Devnet bằng ví"
                          : "Send Devnet USDC with wallet"
                      }
                    />
                    {active.solanaPayUrl && (
                      <a
                        className="button button-secondary cashout-solana-pay"
                        href={active.solanaPayUrl}
                      >
                        {vi ? "Mở bằng Solana Pay" : "Open with Solana Pay"}
                      </a>
                    )}
                  </>
                )}
              {[
                "awaiting_wallet_signature",
                "onchain_pending",
                "onchain_failed",
                "quote_expired",
              ].includes(active.status) && (
                <div className="cashout-manual-verify">
                  <label htmlFor="cashout-signature">
                    {vi
                      ? "Đã gửi rồi? Dán transaction signature"
                      : "Already sent? Paste transaction signature"}
                    <input
                      id="cashout-signature"
                      value={manualSignature || active.submittedTx || ""}
                      onChange={(event) =>
                        setManualSignature(event.target.value)
                      }
                      placeholder={
                        vi
                          ? "Signature công khai từ Solana Explorer"
                          : "Public signature from Solana Explorer"
                      }
                    />
                  </label>
                  <small>
                    {vi
                      ? "Không nhập private key hoặc seed phrase."
                      : "Never enter a private key or seed phrase."}
                  </small>
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={busy || !(manualSignature.trim() || active.submittedTx)}
                    onClick={() =>
                      void verifyPayment(manualSignature.trim() || active.submittedTx || "", "manual")
                    }
                  >
                    {active.status === "onchain_pending"
                      ? vi
                        ? "Kiểm tra finalized lại"
                        : "Recheck finalization"
                      : vi
                        ? "Xác minh giao dịch"
                        : "Verify transaction"}
                  </button>
                </div>
              )}
              {active.status === "bank_processing" && (
                <div className="cashout-bank-sandbox">
                  <strong>
                    {vi
                      ? "USDC đã vào settlement wallet."
                      : "USDC reached the settlement wallet."}
                  </strong>
                  <p>
                    {vi
                      ? "Bước nhận " +
                        methodLabel(active.payoutMethod, true) +
                        " đang là sandbox. Chưa có VND thật được chuyển."
                      : "The " +
                        methodLabel(active.payoutMethod, false) +
                        " delivery step is sandbox-only; no real VND has moved."}
                  </p>
                  <button
                    className="button button-primary"
                    type="button"
                    disabled={busy}
                    onClick={() => void reconcileSandbox()}
                  >
                    {busy
                      ? vi
                        ? "Đang đối soát…"
                        : "Reconciling…"
                      : vi
                        ? "Hoàn tất đối soát thử nghiệm"
                        : "Complete test reconciliation"}
                  </button>
                </div>
              )}
              {["reconciliation_required", "payout_failed"].includes(active.status) && (
                <div className="cashout-bank-sandbox" role="status" aria-live="polite">
                  <strong>{vi ? "USDC đã được ghi nhận — không gửi thêm." : "USDC has been recorded — do not send again."}</strong>
                  <p>{vi
                    ? "Số tiền, thời điểm nhận hoặc chi trả mô phỏng cần được kiểm tra. Không có hoàn tiền tự động. Giữ mã lệnh và transaction để người vận hành đối soát."
                    : "The deposit amount, arrival time or simulated payout needs review. There is no automatic refund. Keep this order ID and transaction for operator reconciliation."}</p>
                  <p>{vi ? "Mã kiểm tra: " : "Review code: "}{active.lastErrorCode || "RECONCILIATION_REQUIRED"}</p>
                  <button className="button button-secondary" type="button" disabled={busy} onClick={() => void reconcileSandbox()}>
                    {vi ? "Kiểm tra lại trạng thái" : "Recheck status"}
                  </button>
                </div>
              )}
              {active.status === "sandbox_completed" && (
                <div className="cashout-complete">
                  <span aria-hidden="true">✓</span>
                  <div>
                    <strong>
                      {vi
                        ? "Luồng Devnet đã hoàn tất"
                        : "Devnet flow completed"}
                    </strong>
                    <p>
                      {vi
                        ? "Bằng chứng USDC on-chain là thật; chứng từ VND chỉ là sandbox."
                        : "The on-chain USDC proof is real; the VND receipt is sandbox-only."}
                    </p>
                  </div>
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={startNew}
                  >
                    {vi ? "Tạo lệnh khác" : "Create another order"}
                  </button>
                </div>
              )}
            </div>
            <div className="cashout-order-proof">
              <span>{vi ? "CHI TIẾT LỆNH" : "ORDER DETAILS"}</span>
              <dl>
                <div><dt>{vi ? "Mạng / tài sản" : "Network / asset"}</dt><dd>Solana Devnet · USDC</dd></div>
                <div><dt>{vi ? "Hạn nhận USDC" : "Funding deadline"}</dt><dd>{active.fundingDeadline ? new Date(active.fundingDeadline).toLocaleString(vi ? "vi-VN" : "en-US") : "—"}</dd></div>
                <div><dt>{vi ? "USDC on-chain" : "On-chain USDC"}</dt><dd>{active.paymentTx ? (vi ? "Đã nhận · finalized" : "Received · finalized") : active.submittedTx ? (vi ? "Đang xác minh" : "Verification pending") : (vi ? "Chưa xác minh" : "Not verified")}</dd></div>
                <div><dt>{vi ? "VND / KYC" : "VND / KYC"}</dt><dd>{vi ? "Mô phỏng · không yêu cầu KYC sandbox" : "Simulated · no sandbox KYC required"}</dd></div>
                <div>
                  <dt>{vi ? "Mã lệnh" : "Order"}</dt>
                  <dd>{active.providerReference}</dd>
                </div>
                <div>
                  <dt>{vi ? "Cách nhận" : "Receive method"}</dt>
                  <dd>
                    {methodLabel(active.payoutMethod, vi)} ·{" "}
                    {active.payoutProvider}
                  </dd>
                </div>
                <div>
                  <dt>{vi ? "Tỷ giá tham chiếu" : "Reference rate"}</dt>
                  <dd>{vnd(active.referenceRateVnd)}</dd>
                </div>
                <div>
                  <dt>{vi ? "Ví settlement" : "Settlement wallet"}</dt>
                  <dd title={active.settlementWallet || ""}>
                    {compact(active.settlementWallet)}
                  </dd>
                </div>
                <div>
                  <dt>{vi ? "Transaction" : "Transaction"}</dt>
                  <dd>
                    {active.explorerUrl ? (
                      <a
                        target="_blank"
                        rel="noreferrer"
                        href={active.explorerUrl}
                      >
                        {compact(active.paymentTx)} ↗
                      </a>
                    ) : vi ? (
                      "Chưa gửi"
                    ) : (
                      "Not submitted"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{vi ? "Nơi nhận test" : "Test destination"}</dt>
                  <dd>
                    {active.beneficiary
                      ? (active.beneficiary.bankName ||
                          active.beneficiary.bankCode) +
                        " · •••• " +
                        active.beneficiary.accountLast4
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>{vi ? "Mã đối soát" : "Reconciliation ref"}</dt>
                  <dd>{active.bankReference || "—"}</dd>
                </div>
              </dl>
            </div>
          </div>
          <ol
            className="cashout-timeline"
            aria-label={vi ? "Tiến trình lệnh" : "Order progress"}
          >
            {[
              [1, vi ? "Báo giá" : "Quote"],
              [2, vi ? "Ký & finalized" : "Sign & finalize"],
              [3, vi ? "Đối soát test" : "Test reconciliation"],
              [4, vi ? "Hoàn tất" : "Completed"],
            ].map(([rank, label]) => (
              <li
                key={rank}
                className={
                  activeRank > Number(rank)
                    ? "done"
                    : activeRank === Number(rank)
                      ? "current"
                      : ""
                }
              >
                <span>{activeRank > Number(rank) ? "✓" : rank}</span>
                <b>{label}</b>
              </li>
            ))}
          </ol>
        </section>
      )}
      <section className="app-panel cashout-history">
        <div className="cashout-section-heading">
          <div>
            <span className="panel-kicker">
              {vi ? "LỊCH SỬ CỦA BẠN" : "YOUR HISTORY"}
            </span>
            <h2>{vi ? "Lệnh Devnet gần đây" : "Recent Devnet orders"}</h2>
          </div>
          {active && (
            <button
              className="button button-secondary"
              type="button"
              onClick={startNew}
            >
              {vi ? "Lệnh mới" : "New order"}
            </button>
          )}
        </div>
        {history.length ? (
          <div className="cashout-history-list">
            {history.map((item) => (
              <button
                type="button"
                className={active?.id === item.id ? "active" : ""}
                key={item.id}
                onClick={() => {
                  setActive(item);
                  setSelectedMethod(item.payoutMethod);
                  setClock(Date.now());
                  setError(null);
                  setNotice(null);
                }}
              >
                <div>
                  <strong>{item.amountUsdc} USDC</strong>
                  <span>
                    {methodLabel(item.payoutMethod, vi)} ·{" "}
                    {item.providerReference}
                  </span>
                </div>
                <div>
                  <b>{vnd(item.netVnd)}</b>
                  <small>{statusText(item.status)}</small>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="field-hint">
            {vi ? "Chưa có lệnh nào." : "No orders yet."}
          </p>
        )}
      </section>
      {notice && (
        <p className="app-notice cashout-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="demo-error cashout-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

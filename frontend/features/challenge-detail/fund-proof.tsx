"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "../../i18n/i18n";
import styles from "./fund-proof.module.css";
type Proof = {
  kind: "escrow" | "legacy" | "none";
  address?: string;
  status: string;
  verified: boolean;
  asset?: string;
  slots?: number;
  perWinner?: string;
  required?: string;
  funded?: string;
  allocated?: string;
  paid?: string;
  remaining?: string;
  fundingTx?: string;
  checkedAt?: string;
};
export function FundProof({ challengeId }: { challengeId: string }) {
  const { locale } = useLanguage(),
    vi = locale === "vi";
  const [proof, setProof] = useState<Proof | null>(null),
    [error, setError] = useState(false),
    [reload, setReload] = useState(0),
    [copy, setCopy] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/challenges/${encodeURIComponent(challengeId)}/fund-proof`, {
      signal: abort.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const p = (await r.json()) as Proof;
        setProof(p);
        setError(false);
      })
      .catch(() => {
        if (!abort.signal.aborted) setError(true);
      });
    return () => abort.abort();
  }, [challengeId, reload]);
  const labels: Record<string, string> = vi
    ? {
        funded: "Đã nạp đủ quỹ",
        not_funded: "Chưa nạp đủ quỹ",
        allocated: "Đã phân bổ phần thưởng",
        paid: "Đã có người nhận thưởng",
        refunded: "Đã hoàn phần dư",
        unavailable: "Chưa kiểm tra được quỹ",
      }
    : {
        funded: "Funded",
        not_funded: "Funding incomplete",
        allocated: "Rewards allocated",
        paid: "Rewards claimed",
        refunded: "Unused funds refunded",
        unavailable: "Unable to verify fund",
      };
  return (
    <section
      id="reward-fund"
      className={`app-panel ${styles.panel}`}
      aria-label={vi ? "Quỹ bảo đảm phần thưởng" : "Reward fund"}
    >
      <h2>{vi ? "Quỹ bảo đảm phần thưởng" : "Reward fund"}</h2>
      {!proof && !error && (
        <p role="status">{vi ? "Đang kiểm tra quỹ…" : "Checking fund…"}</p>
      )}
      {error && <p role="alert">{labels.unavailable}</p>}
      {proof && (
        <>
          <strong>
            {proof.kind === "none"
              ? vi
                ? "Chưa có địa chỉ quỹ"
                : "No fund configured"
              : proof.kind === "legacy"
                ? vi
                  ? "Quỹ theo cơ chế cũ"
                  : "Legacy reward vault"
                : labels[proof.status]}
          </strong>
          {proof.kind === "legacy" && (
            <p>
              {vi
                ? "Ví quỹ dùng chung. Kiểm tra giao dịch nạp của thử thách; số dư cả ví không phải ngân sách riêng của thử thách này."
                : "Shared vault. Inspect this challenge’s funding transaction; the wallet balance is not this challenge’s budget."}
            </p>
          )}
          {proof.verified && (
            <>
              <p>
                {vi
                  ? "Đã xác minh trên Solana Devnet"
                  : "Verified on Solana Devnet"}{" "}
                · {new Date(proof.checkedAt!).toLocaleTimeString(locale)}
              </p>
              <dl>
                {[
                  [vi ? "Tổng ngân sách" : "Budget", proof.required],
                  [vi ? "Mỗi người nhận" : "Per recipient", proof.perWinner],
                  [vi ? "Số suất" : "Slots", String(proof.slots)],
                  [vi ? "Đã phân bổ" : "Allocated", proof.allocated],
                  [vi ? "Đã nhận" : "Claimed", proof.paid],
                  [vi ? "Còn trong quỹ" : "In fund", proof.remaining],
                  [vi ? "Đã nạp" : "Funded", proof.funded],
                ].map(([label, value], i) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>
                      {value}
                      {i !== 2 ? ` ${proof.asset}` : ""}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          )}
          {proof.address && (
            <>
              <p>{vi ? "Địa chỉ quỹ" : "Fund address"}</p>
              <code className={styles.address}>{proof.address}</code>
              <div className={styles.actions}>
                <button
                  className="button button-secondary"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(proof.address!)
                      .then(() => setCopy(vi ? "Đã sao chép" : "Copied"))
                      .catch(() =>
                        setCopy(
                          vi
                            ? "Hãy chọn và sao chép địa chỉ ở trên"
                            : "Select and copy the address above",
                        ),
                      )
                  }
                >
                  {vi ? "Sao chép" : "Copy"}
                </button>
                <a
                  target="_blank"
                  rel="noreferrer"
                  href={`https://explorer.solana.com/address/${proof.address}?cluster=devnet`}
                >
                  {vi ? "Xem trên Solana Explorer" : "View on Solana Explorer"}
                </a>
              </div>
              <p role="status">{copy}</p>
              {proof.kind === "escrow" && (
                <a
                  className="button button-primary"
                  href={`/claim-verifier/index.html?escrow=${encodeURIComponent(proof.address)}&lang=${locale}`}
                >
                  {vi ? "Kiểm tra phần thưởng của tôi" : "Check my rewards"}
                </a>
              )}
              {proof.kind === "legacy" && proof.fundingTx && (
                <a
                  target="_blank"
                  rel="noreferrer"
                  href={`https://explorer.solana.com/tx/${proof.fundingTx}?cluster=devnet`}
                >
                  {vi ? "Xem giao dịch nạp quỹ" : "View funding transaction"}
                </a>
              )}
            </>
          )}
        </>
      )}
      <button
        className="button button-secondary"
        onClick={() => {
          setError(false);
          setProof(null);
          setReload((n) => n + 1);
        }}
      >
        {vi ? "Kiểm tra lại" : "Check again"}
      </button>
    </section>
  );
}

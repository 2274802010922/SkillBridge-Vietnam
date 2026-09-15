"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "../../i18n/i18n";
import { ContentSkeleton } from "../../components/feedback/loading-ui";
import { WalletPaymentButton } from "../../components/wallet/wallet-payment-button";
import { SponsoredClaimButton } from "../../components/wallet/sponsored-claim-button";
import type {
  EscrowState,
  EscrowConfig,
  SubmissionState,
} from "../../../solana/client/challenge-escrow";
import { formatAtomic } from "../../../solana/client/wallet-discovery";
import styles from "./submission-progress.module.css";
type Progress = {
  submission: {
    id: string;
    state: string;
    challenge_id: string;
    title: string;
    reviewer_name: string;
    reflection: string;
    submitted_at: string | null;
    locked_at: string | null;
  };
  files: { id: string; original_name: string; sha256: string }[];
  assessment: { status: string; review_json: string | null } | null;
  credential: { id: string; status: string; issued_at: string | null } | null;
  chain: {
    verified: boolean;
    checkedAt: string | null;
    escrowAddress: string;
    state: EscrowState | null;
    submission: SubmissionState | null;
    config: EscrowConfig;
  } | null;
  operations: {
    action: string;
    signature: string | null;
    created_at: string;
  }[];
  legacy: {
    status: string;
    payment_tx: string | null;
    amount_usdc: string;
    asset: string;
  } | null;
  viewerWallet: string;
  isOwner: boolean;
};
export function SubmissionProgress({ id }: { id: string }) {
  const { locale } = useLanguage(),
    vi = locale === "vi";
  const [data, setData] = useState<Progress | null>(null),
    [error, setError] = useState(""),
    [refreshing, setRefreshing] = useState(false);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const r = await fetch(`/api/submissions/${id}/progress`, {
        cache: "no-store",
        signal,
      });
      if (!r.ok)
        throw Error(
          vi ? "Không tải được tiến trình." : "Unable to load progress.",
        );
      const result = (await r.json()) as Progress;
      setData(result);
      setError("");
      return result;
    },
    [id, vi],
  );
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => {
      if (document.visibilityState === "visible")
        void load(controller.signal).catch((e) => {
          if (!controller.signal.aborted) setError(e.message);
        });
    };
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [load]);
  const refresh = () => {
    setRefreshing(true);
    void load()
      .catch((e) => setError(e.message))
      .finally(() => setRefreshing(false));
  };
  if (!data)
    return (
      <div id="workspace-main" className="workspace-product-content">
        {error ? (
          <p role="alert">{error}</p>
        ) : (
          <ContentSkeleton delayed variant="detail" />
        )}
      </div>
    );
  const s = data.submission,
    c = data.chain,
    receipt = c?.submission;
  const review = data.assessment?.review_json
    ? (JSON.parse(data.assessment.review_json) as {
        officialScore?: number;
        note?: string;
        finalDraft?: { summary: string; totalScore: number };
      })
    : null;
  const official = ["approved", "rejected"].includes(
    data.assessment?.status || "",
  );
  const claimed = !!receipt?.paid || data.legacy?.status === "paid";
  const allocated = receipt?.decision === 3;
  const claimable = !!c?.verified && allocated && !claimed;
  const locked = !!s.locked_at || !!receipt;
  const steps = [
    {
      name: vi ? "Đã tham gia" : "Joined",
      done: true,
      source: vi ? "Ứng dụng" : "Application",
      detail: s.title,
    },
    {
      name: vi ? "Phiên bản bài nộp" : "Submission version",
      done: locked,
      source: receipt
        ? vi
          ? "Solana"
          : "Solana"
        : vi
          ? "Ứng dụng"
          : "Application",
      detail: locked
        ? vi
          ? "Bài nộp đã khóa. Nội dung và tệp được gắn với phiên bản này."
          : "Submission locked. Notes and files are tied to this version."
        : vi
          ? "Bạn có thể tiếp tục chỉnh sửa bản nháp."
          : "You can still edit your draft.",
    },
    {
      name: vi ? "Đánh giá chính thức" : "Official review",
      done: official,
      source: vi ? "Người đánh giá" : "Human reviewer",
      detail: s.reviewer_name || "—",
    },
    {
      name: vi ? "Phân bổ phần thưởng" : "Reward allocation",
      done: allocated,
      source: "Solana",
      detail: allocated
        ? vi
          ? "Đã dành phần thưởng cho ví của bạn."
          : "A reward is reserved for your wallet."
        : vi
          ? "Đạt bài chưa có nghĩa đã được phân bổ thưởng."
          : "Passing an assessment does not automatically allocate a reward.",
    },
    {
      name: vi ? "Nhận thưởng" : "Reward claim",
      done: claimed,
      source: c ? "Solana" : vi ? "Quỹ cũ" : "Legacy vault",
      detail: claimed
        ? vi
          ? "Đã nhận phần thưởng."
          : "Reward received."
        : claimable
          ? vi
            ? "Phần thưởng sẵn sàng để nhận."
            : "Reward ready to claim."
          : vi
            ? "Đang chờ phân bổ hoặc xác minh."
            : "Awaiting allocation or verification.",
    },
  ];
  return (
    <div
      id="workspace-main"
      tabIndex={-1}
      className={"workspace-product-content " + styles.page}
    >
      <Link href="/app/submissions">← {vi ? "Bài nộp" : "Submissions"}</Link>
      <h1>{vi ? "Tiến trình của tôi" : "My progress"}</h1>
      <h2>{s.title}</h2>
      <section className="app-panel">
        <h2>{vi ? "Việc tiếp theo" : "Next step"}</h2>
        <p>
          {!locked
            ? vi
              ? "Hoàn thiện và xác nhận nộp bài."
              : "Complete and confirm your submission."
            : !official
              ? vi
                ? "Bài đang chờ người đánh giá xử lý."
                : "Waiting for human review."
              : claimed
                ? vi
                  ? "Xem chứng nhận hoặc tìm cơ hội phù hợp."
                  : "View your credential or explore opportunities."
                : claimable
                  ? vi
                    ? "Nhận phần thưởng đã được phân bổ."
                    : "Claim your allocated reward."
                  : vi
                    ? "Đã có kết quả chấm. Theo dõi quyết định phân bổ phần thưởng."
                    : "Assessment completed. Follow the allocation decision."}
        </p>
        <div className={styles.actions}>
          {!locked && (
            <Link className="button button-primary" href="/app/submissions">
              {vi ? "Tiếp tục bài nộp" : "Continue submission"}
            </Link>
          )}
          <Link
            className="button button-secondary"
            href={`/app/challenges/${s.challenge_id}`}
          >
            {vi ? "Xem thử thách" : "View challenge"}
          </Link>
          <button
            className="button button-secondary"
            disabled={refreshing}
            onClick={refresh}
          >
            {refreshing
              ? vi
                ? "Đang cập nhật…"
                : "Refreshing…"
              : vi
                ? "Cập nhật tiến trình"
                : "Refresh progress"}
          </button>
        </div>
      </section>
      {error && <p role="alert">{error}</p>}
      {c && !c.verified && (
        <p role="status">
          {vi
            ? "Chưa cập nhật được Solana. Thông tin quỹ dưới đây là lần quan sát gần nhất, không phải xác nhận mới."
            : "Solana refresh unavailable. Fund data below is the last observation, not a fresh confirmation."}
        </p>
      )}
      <ol className={styles.timeline}>
        {steps.map((step, i) => (
          <li className="app-panel" key={step.name}>
            <span aria-hidden="true">{step.done ? "✓" : i + 1}</span>
            <div>
              <h3>{step.name}</h3>
              <small>
                {step.source} ·{" "}
                {step.done
                  ? vi
                    ? "Đã ghi nhận"
                    : "Recorded"
                  : vi
                    ? "Chưa hoàn tất"
                    : "Pending"}
              </small>
              <p>{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
      <section className="app-panel">
        <h2>{vi ? "Kết quả và chứng nhận" : "Result and credential"}</h2>
        {official ? (
          <>
            <p>
              {data.assessment?.status === "approved"
                ? vi
                  ? "Bài được phê duyệt"
                  : "Approved"
                : vi
                  ? "Bài chưa được phê duyệt"
                  : "Not approved"}{" "}
              · {review?.officialScore ?? review?.finalDraft?.totalScore ?? "—"}
              /100
            </p>
            <p>{review?.note || review?.finalDraft?.summary}</p>
            <a href={`/api/submissions/${id}/manifest?kind=result`}>
              {vi ? "Tải bản đối chiếu kết quả" : "Download result manifest"}
            </a>
          </>
        ) : (
          <p>{vi ? "Chưa có điểm chính thức." : "No official result yet."}</p>
        )}
        {data.credential ? (
          <>
            <p>
              {vi ? "Trạng thái chứng nhận: " : "Credential status: "}
              {data.credential.status}
            </p>
            <Link
              className="button button-secondary"
              href={`/verify/${data.credential.id}`}
            >
              {vi ? "Xem và chia sẻ chứng nhận" : "View and share credential"}
            </Link>
            <Link className="button button-primary" href="/app/opportunities">
              {vi ? "Tìm cơ hội ứng tuyển" : "Explore opportunities"}
            </Link>
          </>
        ) : (
          <p>
            {vi
              ? "Chứng nhận chưa được cấp. Việc cấp chứng nhận và nhận thưởng là hai bước riêng."
              : "No credential issued yet. Credential issuance and reward claims are separate steps."}
          </p>
        )}
      </section>
      {claimable && data.isOwner && c?.state && (
        <section className="app-panel">
          <h2>
            {vi ? "Phần thưởng của bạn" : "Your reward"}:{" "}
            {formatAtomic(
              c.state.amount,
              c.state.mint === "11111111111111111111111111111111" ? 9 : 6,
            )}{" "}
            {c.state.mint === "11111111111111111111111111111111"
              ? "SOL Devnet"
              : "USDC Devnet"}
          </h2>
          <SponsoredClaimButton
            escrow={c.escrowAddress}
            recipient={data.viewerWallet}
            onConfirmed={refresh}
          />
          <details>
            <summary>
              {vi ? "Tự trả phí bằng ví" : "Pay network fees myself"}
            </summary>
            <WalletPaymentButton
              escrowRequest={{
                challengeId: s.challenge_id,
                action: "claim_award",
                submissionId: id,
              }}
              label={vi ? "Nhận thưởng — tự trả phí" : "Claim — self-paid fees"}
              onSubmitted={async (signature, operationId) => {
                const r = await fetch(
                  `/api/challenges/${s.challenge_id}/escrow`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "sync",
                      signature,
                      operationId,
                    }),
                  },
                );
                if (!r.ok)
                  throw Error(
                    vi
                      ? "Chưa xác minh được giao dịch."
                      : "Transaction confirmation unavailable.",
                  );
                const next = await load();
                return {
                  status:
                    next.chain?.verified && next.chain.submission?.paid
                      ? "funded"
                      : "pending",
                };
              }}
            />
          </details>
        </section>
      )}
      <section className="app-panel">
        <h2>{vi ? "Bài nộp đã lưu" : "Saved submission"}</h2>
        <p>{s.reflection}</p>
        {data.files.map((f) => (
          <div className={styles.file} key={f.id}>
            <strong>{f.original_name}</strong>
            <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer">
              {vi ? "Xem tệp" : "View file"}
            </a>
            <a href={`/api/files/${f.id}?download=1`}>
              {vi ? "Tải xuống" : "Download"}
            </a>
          </div>
        ))}
      </section>
      <details className="app-panel">
        <summary>
          {vi ? "Xem bằng chứng và giao dịch" : "Evidence and transactions"}
        </summary>
        {c && (
          <>
            <p>
              {vi ? "Kiểm tra gần nhất: " : "Last checked: "}
              {c.checkedAt || "—"}
            </p>
            <a
              href={`/claim-verifier/index.html?escrow=${c.escrowAddress}&wallet=${data.viewerWallet}&lang=${locale}`}
            >
              {vi ? "Mở công cụ độc lập" : "Open independent verifier"}
            </a>
          </>
        )}
        <ul>
          {data.operations
            .filter((o) => o.signature)
            .map((o) => (
              <li key={o.signature}>
                <span>{o.action} · </span>
                <a
                  href={`https://explorer.solana.com/tx/${o.signature}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Solana Explorer
                </a>
              </li>
            ))}
        </ul>
        <a href={`/api/submissions/${id}/manifest`}>
          {vi ? "Tải bản đối chiếu bài nộp" : "Download submission manifest"}
        </a>
      </details>
    </div>
  );
}

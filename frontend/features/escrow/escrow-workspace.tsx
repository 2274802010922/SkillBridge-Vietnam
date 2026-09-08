"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "../../i18n/i18n";
import { ContentSkeleton } from "../../components/feedback/loading-ui";
import {
  WalletPaymentButton,
  type WalletPaymentResult,
} from "../../components/wallet/wallet-payment-button";
import type {
  EscrowConfig,
  EscrowState,
  SubmissionState,
  EscrowAction,
} from "@/solana/client/challenge-escrow";
type Fund = { id: string; title: string; legacy: number; status: string };
type Detail = {
  canConfigure?: boolean;
  reviewerOptions?: Array<{ address: string; name: string | null }>;
  challenge: { id: string; title: string; reward_type: string };
  config: EscrowConfig | null;
  state: EscrowState | null;
  wallet: string;
  escrowAddress?: string;
  submissions: SubmissionState[];
  dbSubmissions?: Array<{
    id: string;
    name: string;
    wallet: string;
    assessment_status: string;
  }>;
};
const actions: Record<EscrowAction, [string, string]> = {
  initialize: ["Nạp tiền thưởng", "Deposit rewards"],
  accept_role: ["Nhận nhiệm vụ đánh giá", "Accept reviewing role"],
  publish: ["Công bố thử thách", "Publish challenge"],
  register_submission: ["Xác nhận nộp bài", "Confirm submission"],
  record_result: ["Xác nhận kết quả chấm", "Confirm assessment result"],
  allocate_award: ["Xác nhận người nhận thưởng", "Select reward recipient"],
  claim_award: ["Nhận thưởng", "Claim reward"],
  refund_unused: ["Nhận lại tiền thưởng còn dư", "Return unused rewards"],
  finalize_results: ["Chốt toàn bộ kết quả", "Finalize all results"],
  cancel_empty: ["Hủy quỹ chưa nạp", "Cancel empty fund"],
};
function amount(value: string, mint: string) {
  const decimals = mint === "11111111111111111111111111111111" ? 9 : 6;
  const n = BigInt(value),
    d = BigInt("10") ** BigInt(decimals);
  return (
    String(n / d) +
    (n % d
      ? "." +
        String(n % d)
          .padStart(decimals, "0")
          .replace(/0+$/, "")
      : "")
  );
}
export function EscrowWorkspace({ initialId }: { initialId: string }) {
  const { locale } = useLanguage(),
    vi = locale === "vi";
  const [funds, setFunds] = useState<Fund[]>([]),
    [id, setId] = useState(initialId),
    [data, setData] = useState<Detail | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [clock, setClock] = useState(0);
  const [reviewer, setReviewer] = useState(""),
    [backup, setBackup] = useState(""),
    [submitEnd, setSubmitEnd] = useState(""),
    [reviewEnd, setReviewEnd] = useState(""),
    [consent, setConsent] = useState(false),
    [signature, setSignature] = useState("");
  const load = useCallback(async () => {
    if (!id) return;
    const r = await fetch("/api/challenges/" + id + "/escrow", {
      cache: "no-store",
    });
    const d = (await r.json()) as Detail & { error?: string };
    if (!r.ok) throw new Error(d.error || "Không thể đọc quỹ");
    setData(d);
    setClock(Date.now());
  }, [id]);
  useEffect(() => {
    let live = true;
    fetch("/api/escrows", { cache: "no-store" })
      .then(async (r) => {
        const d = (await r.json()) as { escrows?: Fund[]; error?: string };
        if (!r.ok) throw new Error(d.error);
        if (live) setFunds(d.escrows || []);
      })
      .catch((e) => {
        if (live) setError(String(e.message));
      }).finally(() => { if (live) setLoading(false); });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    let live = true;
    const refresh = () =>
      load().catch((e) => {
        if (live) setError(String(e.message));
      });
    const first = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 12000);
    return () => {
      live = false;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);
  async function configure(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/challenges/" + id + "/escrow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "configure",
          reviewer,
          backup,
          submitDeadline: new Date(submitEnd).toISOString(),
          reviewDeadline: new Date(reviewEnd).toISOString(),
        }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function sync(
    sig?: string,
    operationId?: string,
  ): Promise<WalletPaymentResult> {
    setError("");
    const r = await fetch("/api/challenges/" + id + "/escrow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "sync", signature: sig, operationId }),
    });
    const d = (await r.json()) as { error?: string; finalized?: boolean };
    if (!r.ok) throw new Error(d.error);
    await load();
    setNotice(
      d.finalized
        ? vi
          ? "Giao dịch đã được xác nhận."
          : "Transaction confirmed."
        : vi
          ? "Đang đồng bộ trạng thái. Bạn không cần gửi lại."
          : "Synchronizing. You do not need to send again.",
    );
    return { status: d.finalized ? "funded" : "pending" };
  }
  function button(action: EscrowAction, submissionId?: string) {
    return (
      <WalletPaymentButton
        key={action + submissionId}
        escrowRequest={{ challengeId: id, action, submissionId }}
        onSubmitted={sync}
        label={actions[action][vi ? 0 : 1]}
      />
    );
  }
  if (loading) return <div id="workspace-main" tabIndex={-1} className="workspace-product-content escrow-workspace"><ContentSkeleton delayed variant="finance" /></div>;
  const c = data?.config,
    s = data?.state;
  const mint = c?.mint || "11111111111111111111111111111111";
  const asset =
    mint === "11111111111111111111111111111111" ? "SOL Devnet" : "USDC Devnet";
  const owner = c?.funder === data?.wallet;
  const primary = c?.reviewer === data?.wallet;
  const standby = c?.backup === data?.wallet;
  const mayReview = c && (clock / 1000 > c.reviewDeadline ? standby : primary);
  const legacy = funds.find((f) => f.id === id)?.legacy;
  return (
    <div id="workspace-main" tabIndex={-1} className="workspace-product-content escrow-workspace">
      <section className="app-panel">
        <h2>{vi ? "Quyền của bạn có thể kiểm tra độc lập" : "Independently verifiable rights"}</h2>
        <p>{vi ? "Sau khi được phân bổ, bạn có thể ký nhận thưởng bằng công cụ riêng ngay cả khi API SkillBridge không hoạt động. Chương trình hiện còn quyền nâng cấp." : "Once allocated, rewards can be claimed with a separate tool even when the SkillBridge API is unavailable. The program remains upgradeable."}</p>
        <p>{vi ? "Nếu reviewer chính và dự phòng đều không xử lý, quỹ tiếp tục chờ. Không tự động hoàn tiền hoặc thay người đánh giá." : "If both reviewers do not act, funds remain pending. There is no automatic refund or reviewer replacement."}</p>
        <a className="button button-secondary" href="/claim-verifier/index.html" target="_blank" rel="noreferrer">{vi ? "Mở công cụ nhận thưởng độc lập" : "Open independent claim tool"}</a>
        {id && c && <a className="chain-proof-link" href={`/api/challenges/${id}/escrow/manifest`}>{vi ? "Tải bản cam kết để tự đối chiếu" : "Download the committed terms"}</a>}
      </section>
      <div className="app-welcome">
        <div>
          <span>
            {vi
              ? "NGÂN SÁCH RÕ RÀNG · TRAO THƯỞNG ĐÚNG NGƯỜI"
              : "CLEAR BUDGET · REWARDS TO THE RIGHT PEOPLE"}
          </span>
          <h1>{vi ? "Quỹ thưởng" : "Reward funds"}</h1>
          <p>
            {vi
              ? "Theo dõi tiền đã nạp, phần dành cho người thắng và bước tiếp theo."
              : "Track deposits, reserved rewards, and your next step."}
          </p>
        </div>
      </div>
      <label className="escrow-field">
        {vi ? "Chọn thử thách" : "Choose challenge"}
        <select
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            setData(null);
            setConsent(false);
            setError("");
            setNotice("");
          }}
        >
          <option value="">
            {vi ? "Chọn một thử thách" : "Select a challenge"}
          </option>
          {funds.map((f) => (
            <option key={f.id} value={f.id}>
              {f.title}
              {f.legacy ? (vi ? " · Quỹ cũ" : " · Legacy") : ""}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p className="demo-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="app-notice" role="status">
          {notice}
        </p>
      )}
      {legacy ? (
        <section className="app-panel">
          <h2>
            {vi
              ? "Quỹ này đã nạp theo cơ chế trước"
              : "Previously funded vault"}
          </h2>
          <p>
            {vi
              ? "Không nạp lại. Tiếp tục quản lý tại trang thử thách và giải ngân hiện tại."
              : "Do not deposit again. Use the existing challenge and payout pages."}
          </p>
          <Link className="button button-secondary" href="/app/challenges">
            {vi ? "Mở thử thách" : "Open challenges"}
          </Link>
        </section>
      ) : data && !c && data.canConfigure ? (
        <form
          onSubmit={(e) => void configure(e)}
          className="app-panel escrow-setup"
        >
          <h2>{data.challenge.title}</h2>
          <p>
            {vi
              ? "Thiết lập người đánh giá và thời hạn trước khi nạp. Sau khi lưu, điều khoản này được gắn cố định với quỹ; nếu cần thay đổi lớn, tạo thử thách mới."
              : "Set reviewers and deadlines before funding. Saving binds these terms to the fund; create a new challenge for major changes."}
          </p>
          <label>
            {vi ? "Ví người đánh giá chính" : "Primary reviewer wallet"}
            <select
              required
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value.trim())}
            >
              <option value="">
                {vi ? "Chọn người đánh giá" : "Select reviewer"}
              </option>
              {data.reviewerOptions?.map((o) => (
                <option key={o.address} value={o.address}>
                  {o.name || o.address.slice(0, 8)} · {o.address.slice(0, 5)}…
                  {o.address.slice(-4)}
                </option>
              ))}
            </select>
            <small>
              {vi
                ? "Người có quyền chấm trong đơn vị đánh giá đã chọn."
                : "Must have review permission in the selected reviewing organization."}
            </small>
          </label>
          <label>
            {vi ? "Ví người xử lý dự phòng" : "Backup reviewer wallet"}
            <select
              required
              value={backup}
              onChange={(e) => setBackup(e.target.value.trim())}
            >
              <option value="">
                {vi ? "Chọn người dự phòng" : "Select backup"}
              </option>
              {data.reviewerOptions
                ?.filter(
                  (o) => o.address !== data.wallet && o.address !== reviewer,
                )
                .map((o) => (
                  <option key={o.address} value={o.address}>
                    {o.name || o.address.slice(0, 8)} · {o.address.slice(0, 5)}…
                    {o.address.slice(-4)}
                  </option>
                ))}
            </select>
            <small>
              {vi
                ? "Khác ví nạp và ví đánh giá chính. Chỉ tiếp quản sau hạn đánh giá."
                : "Different from funder and primary reviewer. Takes over after the review deadline."}
            </small>
          </label>
          <div className="escrow-grid">
            <label>
              {vi ? "Hạn nộp bài" : "Submission deadline"}
              <input
                type="datetime-local"
                required
                value={submitEnd}
                onChange={(e) => setSubmitEnd(e.target.value)}
              />
            </label>
            <label>
              {vi ? "Hạn đánh giá" : "Review deadline"}
              <input
                type="datetime-local"
                required
                value={reviewEnd}
                onChange={(e) => setReviewEnd(e.target.value)}
              />
            </label>
          </div>
          <button className="button button-primary" disabled={busy}>
            {vi ? "Lưu điều khoản quỹ" : "Save fund terms"}
          </button>
        </form>
      ) : null}
      {data && c && (
        <>
          <section className="app-panel">
            <span className="panel-kicker">{asset}</span>
            <h2>{data.challenge.title}</h2>
            <p>
              {!s
                ? vi
                  ? "Chưa nạp tiền thưởng."
                  : "Rewards not deposited."
                : s.state === 0
                  ? vi
                    ? "Đã nạp. Chờ người đánh giá nhận nhiệm vụ và doanh nghiệp công bố."
                    : "Deposited. Waiting for reviewer acceptance and publication."
                  : s.state === 1
                    ? vi
                      ? "Đã công bố. Tiền thưởng được giữ theo điều khoản."
                      : "Published. Rewards are held under the agreed rules."
                    : s.state === 2
                      ? vi
                        ? "Đã chốt kết quả. Người thắng vẫn nhận được khoản đã dành cho mình."
                        : "Results finalized. Winners can still claim their reserved rewards."
                      : vi
                        ? "Quỹ đã hủy."
                        : "Fund cancelled."}
            </p>
            <dl className="escrow-ledger">
              {[
                [
                  vi ? "Tổng ngân sách" : "Budget",
                  String(BigInt(c.amount) * BigInt(c.slots)),
                ],
                [vi ? "Đã nạp" : "Deposited", s?.funded || "0"],
                [vi ? "Đã trao" : "Paid", s?.paid || "0"],
                [
                  vi
                    ? "Dành cho người thắng, chưa nhận"
                    : "Reserved, not claimed",
                  String(BigInt(s?.allocated || "0") - BigInt(s?.paid || "0")),
                ],
                [
                  vi ? "Chưa phân bổ" : "Unallocated",
                  String(
                    BigInt(s?.funded || "0") -
                      BigInt(s?.allocated || "0") -
                      BigInt(s?.refunded || "0"),
                  ),
                ],
                [vi ? "Đã hoàn" : "Returned", s?.refunded || "0"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>
                    {amount(value, mint)} <small>{asset}</small>
                  </dd>
                </div>
              ))}
            </dl>
            <p>
              {vi ? "Hạn nộp" : "Submit by"}:{" "}
              {new Date(c.submitDeadline * 1000).toLocaleString(
                vi ? "vi-VN" : "en-US",
              )}{" "}
              · {vi ? "Hạn đánh giá" : "Review by"}:{" "}
              {new Date(c.reviewDeadline * 1000).toLocaleString(
                vi ? "vi-VN" : "en-US",
              )}
            </p>
            {!s && owner && (
              <div className="escrow-action">
                <p>
                  {vi
                    ? "Bạn sẽ nạp toàn bộ ngân sách. Ví trả thêm phí mạng và chi phí tạo tài khoản, hiển thị trong ví trước khi xác nhận."
                    : "You will deposit the full budget. Network and account-creation costs are additional and shown in your wallet."}
                </p>
                <label className="profile-check">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  {vi
                    ? "Tôi đã kiểm tra số tiền, người đánh giá và điều khoản hoàn quỹ."
                    : "I reviewed the amount, reviewers and refund conditions."}
                </label>
                {consent && button("initialize")}
              </div>
            )}
            {s?.state === 0 &&
              ((primary && !(s.accepted & 1)) ||
                (standby && !(s.accepted & 2))) &&
              button("accept_role")}
            {s?.state === 0 && owner && (
              <div className="escrow-action">
                <p>
                  {vi
                    ? "Cần cả hai người đánh giá nhận nhiệm vụ trước khi công bố. Công bố sẽ khóa điều khoản và quyền hoàn quỹ đơn phương."
                    : "Both reviewers must accept before publication. Publishing locks the terms and unilateral refunds."}{" "}
                  ({s.accepted & 1 ? "1" : "0"} + {s.accepted & 2 ? "1" : "0"}
                  /2)
                </p>
                {s.accepted === 3 && button("publish")}
                {BigInt(s.funded) > BigInt("0")
                  ? button("refund_unused")
                  : button("cancel_empty")}
              </div>
            )}
            {s && s.state === 1 && mayReview && (
              <div className="escrow-action">
                <p>
                  {vi
                    ? "Bài đạt yêu cầu chưa chắc nhận thưởng. Chọn người thắng trong số suất đã công bố, rồi chốt khi mọi bài đã được xử lý."
                    : "Passing an assessment does not guarantee a reward. Select winners within the published slots, then finalize after all submissions are resolved."}
                </p>
                {clock / 1000 > c.submitDeadline &&
                s.submissions === s.resolved ? (
                  button("finalize_results")
                ) : (
                  <p>
                    {vi
                      ? "Chưa thể chốt: chờ hết hạn nộp và xử lý hết bài."
                      : "Cannot finalize until submissions close and every entry is resolved."}{" "}
                    {s.resolved}/{s.submissions}
                  </p>
                )}
              </div>
            )}
            {s?.state === 2 &&
              owner &&
              BigInt(s.funded) > BigInt(s.allocated) + BigInt(s.refunded) &&
              button("refund_unused")}
            <details>
              <summary>
                {vi
                  ? "Điều khoản và chi tiết blockchain"
                  : "Terms and blockchain details"}
              </summary>
              <p>
                {vi
                  ? "Người đánh giá quyết định chất lượng. Máy chủ xác nhận quyền nộp bài. Program giữ ngân sách và điều kiện chuyển tiền; program hiện còn quyền nâng cấp."
                  : "Humans judge quality. The server admits submissions. The program enforces budget and transfer rules; upgrade authority is currently retained."}
              </p>
              <p>
                {vi ? "Đánh giá chính" : "Primary"}: <code>{c.reviewer}</code>
              </p>
              <p>
                {vi ? "Dự phòng" : "Backup"}: <code>{c.backup}</code>
              </p>
              <p>
                {vi
                  ? "Hoàn quỹ về ví đã nạp; không hoàn phần đã dành cho người thắng."
                  : "Refunds go to the funding wallet; reserved rewards cannot be refunded."}
              </p>
              <code>{c.termsHash}</code>
              {data.escrowAddress && (
                <p>
                  <a
                    target="_blank"
                    rel="noreferrer"
                    href={
                      "https://explorer.solana.com/address/" +
                      data.escrowAddress +
                      "?cluster=devnet"
                    }
                  >
                    {vi
                      ? "Kiểm chứng quỹ trên Explorer"
                      : "Verify fund on Explorer"}{" "}
                    ↗
                  </a>
                </p>
              )}
              <pre className="escrow-terms">{c.termsText}</pre>
            </details>
            <button
              type="button"
              className="button button-secondary"
              onClick={() =>
                void load().catch((e) => setError(String(e.message)))
              }
            >
              {vi ? "Kiểm tra lại quỹ" : "Refresh fund"}
            </button>
          </section>
          <section className="app-panel">
            <h2>{vi ? "Bài nộp và phần thưởng" : "Submissions and rewards"}</h2>
            <p>
              <Link href="/app/submissions">
                {vi ? "Mở bài nộp" : "Open submissions"}
              </Link>{" "}
              ·{" "}
              <Link href="/app/reviews">
                {vi ? "Mở đánh giá" : "Open reviews"}
              </Link>
            </p>
            {data.dbSubmissions?.map((sub) => {
              const chain = data.submissions.find(
                (s) => s.student === sub.wallet,
              );
              return (
                <article className="escrow-entry" key={sub.id}>
                  <h3>{sub.name || sub.wallet.slice(0, 8)}</h3>
                  <p>
                    {chain
                      ? chain.paid
                        ? vi
                          ? "Đã nhận thưởng"
                          : "Reward received"
                        : chain.decision === 3
                          ? vi
                            ? "Đã dành phần thưởng"
                            : "Reward reserved"
                          : chain.decision === 1
                            ? vi
                              ? "Đạt; chưa được chọn nhận thưởng"
                              : "Eligible; not yet selected"
                            : chain.decision === 2
                              ? vi
                                ? "Không đạt"
                                : "Not eligible"
                              : vi
                                ? "Đã nộp; chờ kết quả"
                                : "Submitted; awaiting result"
                      : vi
                        ? "Bản nháp — cần ký để hoàn tất nộp bài"
                        : "Draft — sign to complete submission"}
                  </p>
                  {!chain &&
                    sub.wallet === data.wallet &&
                    s?.state === 1 &&
                    clock / 1000 <= c.submitDeadline &&
                    button("register_submission", sub.id)}
                  {chain &&
                    mayReview &&
                    s?.state === 1 &&
                    clock / 1000 > c.submitDeadline &&
                    chain.decision === 0 &&
                    ["approved", "rejected"].includes(sub.assessment_status) &&
                    button("record_result", sub.id)}
                  {chain?.decision === 1 &&
                    mayReview &&
                    s?.state === 1 &&
                    BigInt(s.allocated) < BigInt(c.amount) * BigInt(c.slots) &&
                    button("allocate_award", sub.id)}
                  {chain?.decision === 3 &&
                    !chain.paid &&
                    sub.wallet === data.wallet &&
                    button("claim_award", sub.id)}
                </article>
              );
            })}
          </section>
          <section className="app-panel">
            <h2>
              {vi
                ? "Đã ký nhưng trang chưa cập nhật?"
                : "Signed but the page has not updated?"}
            </h2>
            <p>
              {vi
                ? "Ưu tiên kiểm tra lại quỹ. Nếu có mã giao dịch, dán để kiểm tra xác nhận; không cần gửi thêm tiền."
                : "Refresh the fund first. If you have the transaction ID, paste it to check confirmation; do not send more funds."}
            </p>
            <label>
              {vi ? "Mã giao dịch" : "Transaction ID"}
              <input
                value={signature}
                onChange={(e) => setSignature(e.target.value.trim())}
              />
            </label>
            <button
              type="button"
              className="button button-secondary"
              disabled={!signature}
              onClick={() =>
                void sync(signature).catch((e) => setError(String(e.message)))
              }
            >
              {vi ? "Kiểm tra giao dịch" : "Check transaction"}
            </button>
          </section>
        </>
      )}
    </div>
  );
}

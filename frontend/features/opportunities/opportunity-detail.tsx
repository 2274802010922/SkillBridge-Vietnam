"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "../../i18n/i18n";
import { ContentSkeleton } from "../../components/feedback/loading-ui";
import type { Eligibility } from "../../../solana/client/opportunity-verification";
import type { ApplicationProfile } from "../../../shared/validation/job-application";
import styles from "./opportunities.module.css";
type Application = {
  id: string;
  status: string;
  profile_json: string;
  verification_json: string;
  receipt_address: string | null;
  submitted_at: string;
};
type Detail = {
  opportunity: {
    id: string;
    title: string;
    description: string;
    requirements: string;
    closes_at: string | null;
    minimum_score: string;
    status: string;
    policy_address: string | null;
  };
  credentials: {
    id: string;
    score: string;
    status: string;
    title: string;
    issuer_name: string;
  }[];
  application: Application | null;
  canManage: boolean;
};
function Checks({ value }: { value: Eligibility }) {
  const { locale } = useLanguage(),
    vi = locale === "vi";
  const names = {
    wallet: vi
      ? "Chứng nhận thuộc ví này"
      : "Credential belongs to this wallet",
    issuer: vi ? "Đúng đơn vị phát hành" : "Accepted issuer",
    active: vi ? "Còn hiệu lực" : "Active credential",
    score: vi ? "Đạt điểm yêu cầu" : "Meets score threshold",
    approved: vi ? "Có phê duyệt của con người" : "Human-approved",
  };
  return (
    <>
      <ul className={styles.checks}>
        {Object.entries(value.checks).map(([key, pass]) => (
          <li key={key}>
            <b
              aria-label={
                pass ? (vi ? "Đạt" : "Pass") : vi ? "Chưa đạt" : "Not met"
              }
            >
              {pass ? "✓" : "—"}
            </b>
            {names[key as keyof typeof names]}
          </li>
        ))}
      </ul>
      <p>
        {value.valid
          ? vi
            ? "Đủ điều kiện gửi hồ sơ; doanh nghiệp quyết định tuyển chọn."
            : "Eligible to apply; hiring remains the business’s decision."
          : vi
            ? "Chưa đủ điều kiện ứng tuyển."
            : "Not currently eligible."}
      </p>
      <small>
        {vi ? "Kiểm tra lúc " : "Checked at "}
        {new Date(value.checkedAt).toLocaleString(locale)} ·{" "}
        {value.score ?? "—"}/100
      </small>
    </>
  );
}
export function OpportunityDetail({ id }: { id: string }) {
  const { locale } = useLanguage(),
    vi = locale === "vi";
  const [now, setNow] = useState(0);
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0),
      timer = setInterval(() => setNow(Date.now()), 10000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  const [detail, setDetail] = useState<Detail | null>(null),
    [apps, setApps] = useState<Application[]>([]),
    [credential, setCredential] = useState("");
  const [check, setCheck] = useState<Eligibility | null>(null),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(false),
    [consent, setConsent] = useState(false);
  const [profile, setProfile] = useState<ApplicationProfile>({
    displayName: "",
    introduction: "",
    portfolio: "",
  });
  const [expanded, setExpanded] = useState<string | null>(null),
    [current, setCurrent] = useState<Eligibility | null>(null);
  async function load() {
    const r = await fetch(`/api/opportunities/${id}`, { cache: "no-store" });
    const d = (await r.json()) as Detail & { error?: string };
    if (!r.ok) throw Error(d.error || "Error");
    setDetail(d);
    if (d.canManage) {
      const a = await fetch(`/api/opportunities/${id}/applications`);
      if (!a.ok) throw Error("Không tải được hồ sơ / Applicants unavailable");
      setApps(
        ((await a.json()) as { applications: Application[] }).applications,
      );
    }
  }
  useEffect(() => {
    let live = true;
    fetch(`/api/opportunities/${id}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok)
          throw Error(vi ? "Không tải được cơ hội" : "Opportunity unavailable");
        const d = (await r.json()) as Detail;
        if (!live) return;
        setDetail(d);
        if (d.canManage) {
          const a = await fetch(`/api/opportunities/${id}/applications`);
          if (!a.ok) throw Error("Applicants unavailable");
          const data = (await a.json()) as { applications: Application[] };
          if (live) setApps(data.applications);
        }
      })
      .catch((e) => {
        if (live) setNotice(e.message);
      });
    return () => {
      live = false;
    };
  }, [id, vi]);
  async function action(kind: string, applicationId?: string) {
    setBusy(true);
    setNotice("");
    try {
      const isVerify = kind === "check",
        isApply = kind === "apply",
        isManage = kind === "publish" || kind === "close";
      const r = await fetch(
        `/api/opportunities/${id}${isVerify ? "/verify" : isManage ? "" : "/applications"}`,
        {
          method: isVerify || isApply ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isVerify
              ? { credentialId: credential || undefined }
              : isApply
                ? { credentialId: credential || undefined, profile, consent }
                : { action: kind, applicationId },
          ),
        },
      );
      const d = (await r.json().catch(() => ({ error: "Request failed" }))) as {
        eligibility?: Eligibility;
        credentialId?: string;
        error?: string;
      };
      if (d.eligibility) {
        if (applicationId) setCurrent(d.eligibility);
        else setCheck(d.eligibility);
        if (d.credentialId) setCredential(d.credentialId);
      }
      if (!r.ok && !d.eligibility) throw Error(d.error || "Error");
      if (r.ok && !isVerify && kind !== "verify") {
        setNotice(vi ? "Đã lưu thành công." : "Saved.");
        await load();
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Error");
      if (kind === "check") setCheck(null);
      if (kind === "verify") setCurrent(null);
    } finally {
      setBusy(false);
    }
  }
  if (!detail)
    return (
      <div id="workspace-main" className="workspace-product-content">
        {notice ? (
          <p role="alert">{notice}</p>
        ) : (
          <ContentSkeleton delayed variant="detail" />
        )}
      </div>
    );
  const op = detail.opportunity,
    accepting =
      op.status === "active" &&
      (!op.closes_at || Date.parse(op.closes_at) > now);
  const statuses: Record<string, string> = vi
    ? {
        submitted: "Đã gửi",
        reviewing: "Đang xem xét",
        shortlisted: "Vào danh sách ngắn",
        rejected: "Không được chọn",
      }
    : {
        submitted: "Submitted",
        reviewing: "Under review",
        shortlisted: "Shortlisted",
        rejected: "Not selected",
      };
  return (
    <div
      id="workspace-main"
      tabIndex={-1}
      className={"workspace-product-content " + styles.workspace}
    >
      <Link href="/app/opportunities">← {vi ? "Cơ hội" : "Opportunities"}</Link>
      <h1>{op.title}</h1>
      <p>{op.description}</p>
      <section className="app-panel">
        <h2>{vi ? "Yêu cầu và điều kiện" : "Requirements"}</h2>
        <p>{op.requirements || "—"}</p>
        <p>
          {vi ? "Điểm tối thiểu: " : "Minimum score: "}
          {op.minimum_score}/100
        </p>
        {op.closes_at && (
          <p>
            {vi ? "Hạn ứng tuyển: " : "Deadline: "}
            {new Date(op.closes_at).toLocaleString(locale)}
          </p>
        )}
        {op.policy_address && (
          <a
            href={`https://explorer.solana.com/address/${op.policy_address}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
          >
            {vi ? "Xem điều kiện trên Solana" : "View on-chain policy"}
          </a>
        )}
      </section>
      {detail.canManage ? (
        <>
          <div className={styles.actions}>
            {op.status === "draft" && (
              <button
                className="button button-primary"
                disabled={busy}
                onClick={() => void action("publish")}
              >
                {vi ? "Công bố cơ hội" : "Publish opportunity"}
              </button>
            )}
            {["active", "draft"].includes(op.status) && (
              <button
                className="button button-secondary"
                disabled={busy}
                onClick={() => void action("close")}
              >
                {vi ? "Đóng nhận hồ sơ" : "Close applications"}
              </button>
            )}
          </div>
          <h2>
            {vi ? "Hồ sơ ứng tuyển" : "Applications"} ({apps.length})
          </h2>
          {!apps.length && (
            <p>{vi ? "Chưa có hồ sơ." : "No applications yet."}</p>
          )}
          {apps.map((a) => {
            const p = JSON.parse(a.profile_json) as ApplicationProfile;
            return (
              <article className="app-panel" key={a.id}>
                <h3>{p.displayName}</h3>
                <p>{statuses[a.status]}</p>
                <p>
                  {vi
                    ? "Đã đủ điều kiện tại thời điểm nộp: "
                    : "Eligible when submitted: "}
                  {new Date(
                    a.submitted_at.replace(" ", "T") +
                      (a.submitted_at.endsWith("Z") ? "" : "Z"),
                  ).toLocaleString(locale)}
                </p>
                <button
                  className="button button-secondary"
                  disabled={busy}
                  onClick={() => {
                    setExpanded(a.id);
                    setCurrent(null);
                    void action("verify", a.id);
                  }}
                >
                  {vi
                    ? "Xem hồ sơ và kiểm tra hiệu lực"
                    : "View and recheck credential"}
                </button>
                {expanded === a.id && (
                  <>
                    <p>{p.introduction}</p>
                    {p.portfolio && (
                      <a href={p.portfolio} target="_blank" rel="noreferrer">
                        Portfolio
                      </a>
                    )}
                    {a.receipt_address && (
                      <p>
                        <a
                          href={`https://explorer.solana.com/address/${a.receipt_address}?cluster=devnet`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {vi
                            ? "Bằng chứng kiểm tra lúc ứng tuyển"
                            : "Application verification receipt"}
                        </a>
                      </p>
                    )}
                    {current ? (
                      <Checks value={current} />
                    ) : (
                      <p>
                        {busy
                          ? vi
                            ? "Đang kiểm tra…"
                            : "Checking…"
                          : vi
                            ? "Chưa xác minh được tình trạng hiện tại."
                            : "Current credential status unavailable."}
                      </p>
                    )}
                    <div className={styles.actions}>
                      {["reviewing", "shortlisted", "rejected"].map((s) => (
                        <button
                          className="button button-secondary"
                          key={s}
                          disabled={busy}
                          onClick={() => void action(s, a.id)}
                        >
                          {statuses[s]}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </>
      ) : detail.application ? (
        <section className="app-panel">
          <h2>{vi ? "Hồ sơ của bạn" : "Your application"}</h2>
          <p>{statuses[detail.application.status]}</p>
          <p>
            {vi
              ? "Đã gửi thành công. Chứng nhận sẽ được kiểm tra lại khi doanh nghiệp xem hồ sơ."
              : "Submitted. The credential is rechecked when the business reviews your application."}
          </p>
        </section>
      ) : (
        <section className="app-panel">
          <h2>{vi ? "Kiểm tra và ứng tuyển" : "Check and apply"}</h2>
          {!accepting ? (
            <p>
              {vi
                ? "Cơ hội đã đóng hoặc hết hạn."
                : "This opportunity is closed or past its deadline."}
            </p>
          ) : (
            <>
              <label>
                {vi ? "Chọn chứng nhận" : "Choose a credential"}
                <select
                  value={credential}
                  disabled={busy}
                  onChange={(e) => {
                    setCredential(e.target.value);
                    setCheck(null);
                    setPreview(false);
                    setConsent(false);
                  }}
                >
                  <option value="">
                    {vi
                      ? "Tự tìm chứng nhận phù hợp"
                      : "Find a matching credential"}
                  </option>
                  {detail.credentials.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} · {c.score}/100 · {c.issuer_name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button button-secondary"
                disabled={busy}
                onClick={() => void action("check")}
              >
                {vi ? "Kiểm tra điều kiện ứng tuyển" : "Check eligibility"}
              </button>
              {check && <Checks value={check} />}{" "}
              {check?.valid && (
                <form
                  className={styles.form}
                  onSubmit={(e) => {
                    e.preventDefault();
                    setPreview(true);
                  }}
                >
                  <label>
                    {vi ? "Tên hiển thị" : "Display name"}
                    <input
                      value={profile.displayName}
                      required
                      maxLength={80}
                      onChange={(e) => {
                        setProfile({ ...profile, displayName: e.target.value });
                        setPreview(false);
                      }}
                    />
                  </label>
                  <label>
                    {vi
                      ? "Giới thiệu và lý do ứng tuyển"
                      : "Introduction and motivation"}
                    <textarea
                      required
                      minLength={20}
                      maxLength={3000}
                      value={profile.introduction}
                      onChange={(e) => {
                        setProfile({
                          ...profile,
                          introduction: e.target.value,
                        });
                        setPreview(false);
                      }}
                    />
                  </label>
                  <label>
                    {vi
                      ? "Liên kết portfolio HTTPS (tùy chọn)"
                      : "HTTPS portfolio link (optional)"}
                    <input
                      type="url"
                      value={profile.portfolio}
                      maxLength={500}
                      onChange={(e) => {
                        setProfile({ ...profile, portfolio: e.target.value });
                        setPreview(false);
                      }}
                    />
                  </label>
                  <button className="button button-secondary" disabled={busy}>
                    {vi ? "Xem trước thông tin gửi" : "Preview application"}
                  </button>
                </form>
              )}
              {preview && check?.valid && (
                <div className={styles.snapshot}>
                  <h3>{profile.displayName}</h3>
                  <p>{profile.introduction}</p>
                  <p>{profile.portfolio}</p>
                  <p>
                    {vi
                      ? "Gửi các thông tin trên cùng ví và chứng nhận đã chọn. Tệp bài nộp và thông tin hồ sơ riêng khác không được gửi."
                      : "Shares the details above, your wallet and selected credential. Submission files and other private profile fields are not included."}
                  </p>
                  <label>
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />{" "}
                    {vi
                      ? "Tôi xác nhận gửi hồ sơ đến doanh nghiệp này"
                      : "I confirm sharing this application with this business"}
                  </label>
                  <button
                    className="button button-primary"
                    disabled={busy || !consent}
                    onClick={() => void action("apply")}
                  >
                    {vi ? "Gửi hồ sơ ứng tuyển" : "Submit application"}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}
      {notice && <p role="alert">{notice}</p>}
    </div>
  );
}

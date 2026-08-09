"use client";

import { useEffect, useMemo, useState } from "react";

type Role = "business" | "student" | "university";
type Stage = "draft" | "published" | "invited" | "accepted" | "submitted" | "ai_drafted" | "approved" | "issued" | "unlocked" | "revoked";
type Action = "publish_challenge" | "invite_student" | "accept_challenge" | "submit_evidence" | "generate_ai_draft" | "approve_assessment" | "issue_credential" | "verify_unlock" | "revoke_credential";

type WorkspaceState = {
  workspaceId: string;
  stage: Stage;
  challenge: { id: string; company: string; title: string; brief: string; skills: string[]; format: string; reward: string; status: string };
  participant: { id: string; name: string; university: string; status: string } | null;
  submission: { id: string; fileName: string; submittedAt: string; evidenceCount: number; evidenceHash: string } | null;
  assessment: {
    draft: {
      totalScore: number;
      confidence: number;
      summary: string;
      reviewerFlags: string[];
      grounding: { citationCoverage: number; unsupportedClaims: string[] };
      rubric: Array<{ id: string; label: string; score: number; maxScore: number; citations: Array<{ sourceId: string; locator: string; quote: string }> }>;
    };
    provenance: { mode: "openai" | "fixture" | "fixture_fallback"; model: string; validationPassed: boolean };
  } | null;
  review: { decision: "approved"; reviewer: string; approvedAt: string; resolvedFlags: string[] } | null;
  credential: {
    id: string;
    schema: string;
    score: number;
    status: "active" | "revoked";
    evidenceHash: string;
    issuedAt: string;
    chain: { network: "devnet"; mode: "preview"; address: null };
  } | null;
  opportunity: { id: string; title: string; company: string; minimumScore: number; status: "locked" | "unlocked"; reason: string };
  events: Array<{ actor: Role | "system"; label: string; detail: string; at: string }>;
  capabilities: Record<Role, Action[]>;
  viewer: { signedIn: boolean; displayName: string };
};

const roleMeta: Record<Role, { label: string; kicker: string; description: string; mark: string }> = {
  business: { label: "Doanh nghiệp", kicker: "CHALLENGE OWNER", description: "Tạo nhu cầu thật và kiểm tra talent signal.", mark: "B" },
  student: { label: "Sinh viên", kicker: "BUILDER", description: "Nhận brief, tạo sản phẩm và sở hữu proof.", mark: "S" },
  university: { label: "Nhà trường", kicker: "TRUST ISSUER", description: "Duyệt evidence, cấp và thu hồi credential.", mark: "U" },
};

const actionMeta: Record<Action, { label: string; helper: string }> = {
  publish_challenge: { label: "Publish challenge", helper: "Đưa business brief vào challenge pool." },
  invite_student: { label: "Mời ứng viên VLU", helper: "Gửi invitation tới sinh viên phù hợp." },
  accept_challenge: { label: "Nhận challenge", helper: "Cam kết tham gia sprint tám giờ." },
  submit_evidence: { label: "Nộp bài & evidence", helper: "Gửi strategy deck và reflection có source IDs." },
  generate_ai_draft: { label: "Chạy AI assessment", helper: "Tạo structured draft và kiểm tra citation grounding." },
  approve_assessment: { label: "Phê duyệt assessment", helper: "Reviewer xử lý flags và chịu trách nhiệm kết quả." },
  issue_credential: { label: "Cấp credential", helper: "Phát Proof of Skill sau human approval." },
  verify_unlock: { label: "Verify & unlock", helper: "Kiểm tra credential active và score threshold." },
  revoke_credential: { label: "Revoke credential", helper: "Thu hồi proof và loại bỏ opportunity access." },
};

const stages: Array<{ id: Stage; label: string }> = [
  { id: "draft", label: "Draft" },
  { id: "published", label: "Published" },
  { id: "invited", label: "Invited" },
  { id: "accepted", label: "Accepted" },
  { id: "submitted", label: "Evidence" },
  { id: "ai_drafted", label: "AI draft" },
  { id: "approved", label: "Approved" },
  { id: "issued", label: "Credential" },
  { id: "unlocked", label: "Unlocked" },
];

const nextRoleByStage: Record<Stage, Role | null> = {
  draft: "business",
  published: "business",
  invited: "student",
  accepted: "student",
  submitted: "university",
  ai_drafted: "university",
  approved: "university",
  issued: "business",
  unlocked: "university",
  revoked: null,
};

function stageIndex(stage: Stage) {
  if (stage === "revoked") return 7;
  return Math.max(0, stages.findIndex((item) => item.id === stage));
}

function shortHash(hash?: string) {
  if (!hash) return "—";
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export function RoleWorkspace() {
  const [role, setRole] = useState<Role>("business");
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/workspace", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Không thể tải role workspace.");
        return response.json() as Promise<WorkspaceState>;
      })
      .then((data) => { if (active) setState(data); })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : "Đã có lỗi xảy ra."); });
    return () => { active = false; };
  }, []);

  const activeIndex = useMemo(() => state ? stageIndex(state.stage) : 0, [state]);
  const nextRole = state ? nextRoleByStage[state.stage] : "business";
  const availableAction = state?.capabilities[role]?.[0];

  async function act(action: Action | "reset") {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role, action }),
      });
      const data = await response.json() as WorkspaceState & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Không thể cập nhật workspace.");
      setState(data);
      if (action === "reset") setRole("business");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Đã có lỗi xảy ra.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="role-workspace page-shell">
      <section className="workspace-intro">
        <div>
          <div className="eyebrow"><span /> One shared journey · three roles</div>
          <h1>Build một lần.<br /><em>Test qua từng vai trò.</em></h1>
          <p>Mỗi tab là một quyền khác nhau nhưng cùng dùng chung dữ liệu D1. Chuyển role để đưa challenge đi hết vòng đời.</p>
        </div>
        <div className="workspace-status-card">
          <span>CURRENT STATE</span>
          <strong>{state?.stage.replace("_", " ") ?? "loading"}</strong>
          <small>{state?.viewer.displayName ?? "MVP Tester"} · private test workspace</small>
          <button disabled={busy} onClick={() => act("reset")}>Reset scenario</button>
        </div>
      </section>

      <div className="role-mode-notice"><strong>ROLE SIMULATOR</strong><span>Role switching dành cho MVP test; production sẽ bind role vào danh tính đăng nhập ở server.</span></div>

      <nav className="role-tabs" aria-label="Chọn vai trò kiểm thử">
        {(Object.keys(roleMeta) as Role[]).map((item) => (
          <button className={role === item ? "active" : ""} key={item} onClick={() => setRole(item)}>
            <span>{roleMeta[item].mark}</span>
            <div><small>{roleMeta[item].kicker}</small><strong>{roleMeta[item].label}</strong></div>
            {state?.capabilities[item]?.length ? <i>YOUR TURN</i> : null}
          </button>
        ))}
      </nav>

      <section className="journey-rail" aria-label="Tiến độ end-to-end">
        {stages.map((item, index) => {
          const complete = index < activeIndex || state?.stage === "unlocked";
          const active = index === activeIndex && state?.stage !== "revoked";
          return <div className={`${complete ? "complete" : ""} ${active ? "active" : ""}`} key={item.id}><span>{complete ? "✓" : index + 1}</span><small>{item.label}</small></div>;
        })}
      </section>

      <div className="role-dashboard">
        <section className="role-main-panel">
          <div className="role-panel-heading">
            <div><span>{roleMeta[role].kicker}</span><h2>{roleMeta[role].label}</h2><p>{roleMeta[role].description}</p></div>
            <span className="role-mark">{roleMeta[role].mark}</span>
          </div>

          {role === "business" && state && (
            <div className="role-content-grid">
              <article className="workspace-entity primary">
                <div className="entity-top"><span>CHALLENGE · {state.challenge.id}</span><b>{state.challenge.status}</b></div>
                <h3>{state.challenge.title}</h3><p>{state.challenge.brief}</p>
                <div className="entity-tags">{state.challenge.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
                <dl><div><dt>FORMAT</dt><dd>{state.challenge.format}</dd></div><div><dt>REWARD</dt><dd>{state.challenge.reward}</dd></div></dl>
              </article>
              <article className={`workspace-entity opportunity ${state.opportunity.status}`}>
                <div className="entity-top"><span>OPPORTUNITY GATE</span><b>{state.opportunity.status}</b></div>
                <h3>{state.opportunity.title}</h3><p>{state.opportunity.reason}</p>
                <dl><div><dt>MIN SCORE</dt><dd>{state.opportunity.minimumScore}</dd></div><div><dt>CREDENTIAL</dt><dd>{state.credential?.status ?? "missing"}</dd></div></dl>
              </article>
            </div>
          )}

          {role === "student" && state && (
            <div className="role-content-grid">
              <article className="workspace-entity primary">
                <div className="entity-top"><span>INVITATION</span><b>{state.participant?.status ?? "not sent"}</b></div>
                <h3>{state.challenge.title}</h3><p>{state.challenge.company} mời bạn giải một brief thực tế và dùng kết quả làm proof of skill.</p>
                <dl><div><dt>STUDENT</dt><dd>{state.participant?.name ?? "—"}</dd></div><div><dt>UNIVERSITY</dt><dd>{state.participant?.university ?? "—"}</dd></div></dl>
              </article>
              <article className="workspace-entity">
                <div className="entity-top"><span>SUBMISSION</span><b>{state.submission ? "submitted" : "empty"}</b></div>
                <h3>{state.submission?.fileName ?? "Chưa có bài nộp"}</h3><p>{state.submission ? `${state.submission.evidenceCount} evidence sources đã được hash và khóa cho assessment.` : "Nhận challenge trước khi nộp strategy deck."}</p>
                <div className="hash-line"><span>EVIDENCE HASH</span><code>{shortHash(state.submission?.evidenceHash)}</code></div>
              </article>
              <article className={`workspace-entity credential-mini ${state.credential?.status ?? "empty"}`}>
                <div className="entity-top"><span>SKILL PASSPORT</span><b>{state.credential?.status ?? "not issued"}</b></div>
                <strong className="mini-score">{state.credential?.score ?? "—"}</strong><h3>Growth Strategy</h3>
                <p>{state.credential ? `Credential ${state.credential.id} · ${state.credential.chain.network} ${state.credential.chain.mode}` : "Credential xuất hiện sau khi nhà trường duyệt và cấp."}</p>
              </article>
            </div>
          )}

          {role === "university" && state && (
            <div className="role-content-grid">
              <article className="workspace-entity primary">
                <div className="entity-top"><span>REVIEW QUEUE</span><b>{state.assessment ? "assessment ready" : state.submission ? "submission ready" : "waiting"}</b></div>
                <h3>{state.participant?.name ?? "Ứng viên chưa được mời"}</h3><p>{state.submission ? `${state.submission.fileName} · ${state.submission.evidenceCount} evidence sources` : "Đang chờ sinh viên nộp evidence."}</p>
                {state.assessment && <div className="review-score"><strong>{state.assessment.draft.totalScore}</strong><div><span>GROUNDING {Math.round(state.assessment.draft.grounding.citationCoverage * 100)}%</span><small>{state.assessment.provenance.mode} · confidence {state.assessment.draft.confidence.toFixed(2)}</small></div></div>}
                {state.assessment?.draft.reviewerFlags[0] && <blockquote>{state.assessment.draft.reviewerFlags[0]}</blockquote>}
              </article>
              <article className="workspace-entity">
                <div className="entity-top"><span>HUMAN DECISION</span><b>{state.review?.decision ?? "pending"}</b></div>
                <h3>{state.review?.reviewer ?? "Reviewer chưa phê duyệt"}</h3><p>{state.review ? `${state.review.resolvedFlags.length} flag đã được xem xét trước issuance.` : "AI không thể tự cấp credential. Reviewer chịu trách nhiệm quyết định cuối."}</p>
              </article>
              <article className={`workspace-entity credential-mini ${state.credential?.status ?? "empty"}`}>
                <div className="entity-top"><span>ISSUER CONTROL</span><b>{state.credential?.status ?? "not issued"}</b></div>
                <h3>{state.credential?.id ?? "Proof of Skill"}</h3><p>{state.credential ? `Schema ${state.credential.schema} · evidence ${shortHash(state.credential.evidenceHash)}` : "Chỉ cấp sau assessment contract và human approval."}</p>
              </article>
            </div>
          )}

          <div className="role-action-zone">
            {availableAction ? (
              <><div><small>AUTHORIZED ACTION</small><strong>{actionMeta[availableAction].helper}</strong></div><button className="button button-primary" disabled={busy} onClick={() => act(availableAction)}>{busy ? "Đang xử lý…" : actionMeta[availableAction].label}</button></>
            ) : nextRole ? (
              <><div><small>WAITING FOR NEXT OWNER</small><strong>Bước tiếp theo thuộc vai trò {roleMeta[nextRole].label}.</strong></div><button className="button button-dark" onClick={() => setRole(nextRole)}>Chuyển sang {roleMeta[nextRole].label}</button></>
            ) : (
              <><div><small>SCENARIO COMPLETE</small><strong>Credential đã revoke và opportunity access đã bị thu hồi.</strong></div><button className="button button-dark" onClick={() => act("reset")}>Chạy lại từ đầu</button></>
            )}
          </div>
          {error && <p className="demo-error" role="alert">{error}</p>}
        </section>

        <aside className="shared-state-panel">
          <div className="shared-state-heading"><span>SHARED AUDIT TRAIL</span><strong>{state?.events.length ?? 0} EVENTS</strong></div>
          <div className="shared-state-summary">
            <div><span>Challenge</span><strong>{state?.challenge.status ?? "—"}</strong></div>
            <div><span>Submission</span><strong>{state?.submission ? "ready" : "missing"}</strong></div>
            <div><span>Assessment</span><strong>{state?.assessment?.provenance.validationPassed ? "valid" : "missing"}</strong></div>
            <div><span>Credential</span><strong>{state?.credential?.status ?? "missing"}</strong></div>
          </div>
          <div className="role-activity">
            {state?.events.slice().reverse().map((event, index) => (
              <div className="role-event" key={`${event.at}-${index}`}><span className={`actor-dot ${event.actor}`} /><div><small>{event.actor.toUpperCase()}</small><strong>{event.label}</strong><p>{event.detail}</p></div></div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

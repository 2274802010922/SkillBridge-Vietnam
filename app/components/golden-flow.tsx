"use client";

import { useEffect, useMemo, useState } from "react";

type Stage = "invited" | "submitted" | "ai_drafted" | "approved" | "issued" | "unlocked" | "revoked";
type DemoEvent = { label: string; detail: string; at: string };
type EvidenceSource = { id: string; locator: string; content: string };
type AssessmentEnvelope = {
  draft: {
    totalScore: number;
    confidence: number;
    summary: string;
    rubric: Array<{
      id: string;
      label: string;
      score: number;
      maxScore: number;
      rationale: string;
      citations: Array<{ sourceId: string; locator: string; quote: string }>;
    }>;
    reviewerFlags: string[];
    grounding: { citationCoverage: number; unsupportedClaims: string[] };
    risk: { promptInjectionDetected: boolean; insufficientEvidence: boolean };
  };
  provenance: {
    mode: "openai" | "fixture" | "fixture_fallback";
    provider: string;
    model: string;
    validationPassed: boolean;
  };
};
type ReviewDecision = { decision: "approved"; reviewer: string; approvedAt: string; resolvedFlags: string[] };
type DemoState = {
  sessionId: string;
  stage: Stage;
  events: DemoEvent[];
  evidence: EvidenceSource[];
  assessment: AssessmentEnvelope | null;
  review: ReviewDecision | null;
};

const stages: Array<{ id: Stage; short: string; title: string; owner: string }> = [
  { id: "invited", short: "01", title: "Challenge", owner: "Doanh nghiệp" },
  { id: "submitted", short: "02", title: "Evidence", owner: "Sinh viên" },
  { id: "ai_drafted", short: "03", title: "AI draft", owner: "AI copilot" },
  { id: "approved", short: "04", title: "Review", owner: "Giảng viên" },
  { id: "issued", short: "05", title: "Credential", owner: "Solana" },
  { id: "unlocked", short: "06", title: "Invitation", owner: "Cơ hội" },
];

const actionByStage: Record<Exclude<Stage, "revoked">, { action: string; label: string; helper: string }> = {
  invited: { action: "submit_evidence", label: "Nộp evidence", helper: "Sinh viên gửi strategy deck và reflection." },
  submitted: { action: "generate_ai_draft", label: "Chạy AI assessment", helper: "AI trả về schema cố định; citation giả sẽ bị contract từ chối." },
  ai_drafted: { action: "approve_assessment", label: "Reviewer phê duyệt", helper: "Con người kiểm tra evidence, xử lý flags và chịu trách nhiệm." },
  approved: { action: "issue_credential", label: "Preview cấp credential", helper: "Tạo claim theo schema đã technical-spike." },
  issued: { action: "unlock_opportunity", label: "Kiểm tra & mở khóa", helper: "Gate kiểm tra score, evidence hash và trạng thái." },
  unlocked: { action: "revoke_credential", label: "Thử revoke credential", helper: "Chứng minh utility biến mất sau thu hồi." },
};

function stageIndex(stage: Stage) {
  if (stage === "revoked") return 4;
  return Math.max(0, stages.findIndex((item) => item.id === stage));
}

export function GoldenFlow() {
  const [state, setState] = useState<DemoState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/demo", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Không thể tải phiên demo.");
        return response.json() as Promise<DemoState>;
      })
      .then((nextState) => {
        if (active) setState(nextState);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Đã có lỗi xảy ra.");
      });
    return () => { active = false; };
  }, []);

  const activeIndex = useMemo(() => (state ? stageIndex(state.stage) : 0), [state]);

  async function act(action: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json()) as DemoState & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Không thể cập nhật demo.");
      setState(payload);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Đã có lỗi xảy ra.");
    } finally {
      setBusy(false);
    }
  }

  const action = state && state.stage !== "revoked" ? actionByStage[state.stage] : null;
  const assessment = state?.assessment;
  const assessmentDraft = assessment?.draft;
  const assessmentMode = assessment?.provenance.mode;
  const credentialScore = assessmentDraft?.totalScore ?? 0;

  return (
    <div className="demo-console">
      <div className="demo-notice">
        <span>VERIFIABLE AI</span>
        Assessment contract và reviewer history chạy thật; OpenAI dùng khi có server key, Solana devnet vẫn đang preview.
      </div>

      <div className="stage-rail" aria-label="Tiến độ golden flow">
        {stages.map((item, index) => {
          const complete = index < activeIndex || (state?.stage === "unlocked" && index === activeIndex);
          const active = index === activeIndex && state?.stage !== "revoked";
          return (
            <div className={`stage-item ${complete ? "complete" : ""} ${active ? "active" : ""}`} key={item.id}>
              <span>{complete ? "✓" : item.short}</span>
              <strong>{item.title}</strong><small>{item.owner}</small>
            </div>
          );
        })}
      </div>

      <div className="demo-grid">
        <section className="workspace-panel">
          <div className="panel-topline"><span>BUSINESS CHALLENGE</span><span className="live-dot">ACTIVE</span></div>
          <h3>Growth plan cho thương hiệu thời trang bền vững</h3>
          <p className="challenge-brief">Xây chiến lược tăng trưởng 90 ngày cho một startup Việt Nam, ưu tiên Gen Z tại TP.HCM và ngân sách thực tế.</p>
          <div className="challenge-meta"><span>⏱ 8 giờ</span><span>◎ Marketing</span><span>◇ Team 1–3</span></div>

          <div className="evidence-box">
            <div><span className="file-type">PDF</span><div><strong>growth-strategy-v3.pdf</strong><small>18 trang · evidence hash sẵn sàng</small></div></div>
            <span className={activeIndex >= 1 ? "status-good" : "status-muted"}>{activeIndex >= 1 ? "ĐÃ NỘP" : "CHỜ NỘP"}</span>
          </div>

          <div className={`assessment-box ${assessmentDraft ? "visible" : ""}`}>
            {assessmentDraft && (
              <>
                <div className="assessment-head">
                  <div><small>AI ASSESSMENT · CONTRACT v1</small><strong>{assessmentDraft.totalScore} / 100</strong></div>
                  <div className="assessment-badges">
                    <span>Confidence {assessmentDraft.confidence.toFixed(2)}</span>
                    <span className={`engine-badge ${assessmentMode === "openai" ? "live" : "fixture"}`}>
                      {assessmentMode === "openai" ? assessment.provenance.model : "TRANSPARENT FIXTURE"}
                    </span>
                  </div>
                </div>
                {assessmentDraft.rubric.map((item) => (
                  <div className="rubric-row" key={item.id}>
                    <span>{item.label}</span>
                    <div><i style={{ width: `${(item.score / item.maxScore) * 100}%` }} /></div>
                    <strong>{item.score}/{item.maxScore}</strong>
                  </div>
                ))}
                <p className="assessment-summary">{assessmentDraft.summary}</p>
                <div className="citation-list">
                  {assessmentDraft.rubric.flatMap((item) => item.citations).slice(0, 3).map((citation, index) => (
                    <div className="citation-chip" key={`${citation.sourceId}-${index}`}>
                      <span>{citation.sourceId} · {citation.locator}</span>
                      <q>{citation.quote}</q>
                    </div>
                  ))}
                </div>
                <div className="assessment-quality">
                  <span>GROUNDING {Math.round(assessmentDraft.grounding.citationCoverage * 100)}%</span>
                  <span>{assessmentDraft.reviewerFlags.length} REVIEWER FLAG</span>
                  <span>{assessment.provenance.validationPassed ? "CONTRACT PASS" : "CONTRACT FAIL"}</span>
                </div>
                {assessmentDraft.reviewerFlags[0] && <blockquote>{assessmentDraft.reviewerFlags[0]}</blockquote>}
                <div className={`human-seal ${state?.review ? "approved" : ""}`}>
                  {state?.review ? `✓ HUMAN APPROVED · ${state.review.reviewer}` : "AWAITING HUMAN REVIEW"}
                </div>
              </>
            )}
          </div>

          {action ? (
            <div className="next-action">
              <div><small>BƯỚC TIẾP THEO</small><strong>{action.helper}</strong></div>
              <button className="button button-primary" disabled={busy} onClick={() => act(action.action)}>{busy ? "Đang xử lý…" : action.label}</button>
            </div>
          ) : (
            <div className="next-action revoked-action">
              <div><small>UTILITY CHECK</small><strong>Credential đã revoke; invitation không còn truy cập được.</strong></div>
              <button className="button button-dark" disabled={busy} onClick={() => act("reset")}>Chạy lại demo</button>
            </div>
          )}
          {error && <p className="demo-error" role="alert">{error}</p>}
        </section>

        <aside className="proof-panel">
          <div className="proof-panel-label">SKILL PASSPORT</div>
          <div className={`credential-card ${activeIndex >= 4 ? "issued" : ""} ${state?.stage === "revoked" ? "revoked" : ""}`}>
            <div className="credential-top"><span>VLU × SKILLBRIDGE</span><span>PS-001</span></div>
            <div className="credential-score"><strong>{activeIndex >= 4 ? credentialScore : "—"}</strong><span>GROWTH<br />STRATEGY</span></div>
            <p>Evidence-linked Proof of Skill</p>
            <div className="credential-lines"><span /><span /><span /></div>
            <div className="credential-status">
              {state?.stage === "revoked" ? "REVOKED · ACCESS DENIED" : activeIndex >= 4 ? "ACTIVE · HUMAN APPROVED" : "NOT ISSUED"}
            </div>
          </div>

          <div className={`opportunity-card ${state?.stage === "unlocked" ? "unlocked" : ""}`}>
            <div><span>LEVEL 2 OPPORTUNITY</span><strong>Growth Sprint Interview</strong></div>
            <span className="lock-mark">{state?.stage === "unlocked" ? "OPEN" : "LOCKED"}</span>
          </div>

          <div className="activity-log">
            <div className="activity-title"><span>ACTIVITY</span><button onClick={() => act("reset")} disabled={busy}>Reset</button></div>
            {!state && <p>Đang tạo phiên demo…</p>}
            {state?.events.slice().reverse().slice(0, 4).map((event, index) => (
              <div className="activity-item" key={`${event.at}-${index}`}><span /><div><strong>{event.label}</strong><small>{event.detail}</small></div></div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

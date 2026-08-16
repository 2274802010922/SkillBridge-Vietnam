"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "./i18n";

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
    mode: "tokenrouter" | "gemini" | "openai" | "fixture" | "fixture_fallback";
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
  { id: "invited", short: "01", title: "demo.stage.challenge", owner: "demo.role.business" },
  { id: "submitted", short: "02", title: "demo.stage.evidence", owner: "demo.role.student" },
  { id: "ai_drafted", short: "03", title: "demo.stage.aiDraft", owner: "demo.role.ai" },
  { id: "approved", short: "04", title: "demo.stage.review", owner: "demo.role.lecturer" },
  { id: "issued", short: "05", title: "demo.stage.credential", owner: "demo.role.solana" },
  { id: "unlocked", short: "06", title: "demo.stage.invitation", owner: "demo.role.opportunity" },
];

const actionByStage: Record<Exclude<Stage, "revoked">, { action: string; label: string; helper: string }> = {
  invited: { action: "submit_evidence", label: "demo.action.submit", helper: "demo.action.submitHelper" },
  submitted: { action: "generate_ai_draft", label: "demo.action.assess", helper: "demo.action.assessHelper" },
  ai_drafted: { action: "approve_assessment", label: "demo.action.review", helper: "demo.action.reviewHelper" },
  approved: { action: "issue_credential", label: "demo.action.issue", helper: "demo.action.issueHelper" },
  issued: { action: "unlock_opportunity", label: "demo.action.unlock", helper: "demo.action.unlockHelper" },
  unlocked: { action: "revoke_credential", label: "demo.action.revoke", helper: "demo.action.revokeHelper" },
};

function stageIndex(stage: Stage) {
  if (stage === "revoked") return 4;
  return Math.max(0, stages.findIndex((item) => item.id === stage));
}

export function GoldenFlow() {
  const { t } = useLanguage();
  const [state, setState] = useState<DemoState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/demo", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(t("demo.loadError"));
        return response.json() as Promise<DemoState>;
      })
      .then((nextState) => {
        if (active) setState(nextState);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : t("demo.error"));
      });
    return () => { active = false; };
  }, [t]);

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
      if (!response.ok) throw new Error(payload.error ?? t("demo.updateError"));
      setState(payload);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : t("demo.error"));
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
        <span>{t("demo.verifiable")}</span>
        {t("demo.notice")}
      </div>

      <div className="stage-rail" aria-label={t("demo.progress")}>
        {stages.map((item, index) => {
          const complete = index < activeIndex || (state?.stage === "unlocked" && index === activeIndex);
          const active = index === activeIndex && state?.stage !== "revoked";
          return (
            <div className={`stage-item ${complete ? "complete" : ""} ${active ? "active" : ""}`} key={item.id}>
              <span>{complete ? "✓" : item.short}</span>
              <strong>{t(item.title as Parameters<typeof t>[0])}</strong><small>{t(item.owner as Parameters<typeof t>[0])}</small>
            </div>
          );
        })}
      </div>

      <div className="demo-grid">
        <section className="workspace-panel">
          <div className="panel-topline"><span>{t("demo.businessChallenge")}</span><span className="live-dot">{t("demo.active")}</span></div>
          <h3>{t("demo.challengeTitle")}</h3>
          <p className="challenge-brief">{t("demo.challengeBrief")}</p>
          <div className="challenge-meta"><span>{t("demo.hours")}</span><span>{t("demo.marketing")}</span><span>{t("demo.team")}</span></div>

          <div className="evidence-box">
            <div><span className="file-type">PDF</span><div><strong>growth-strategy-v3.pdf</strong><small>{t("demo.pagesHash")}</small></div></div>
            <span className={activeIndex >= 1 ? "status-good" : "status-muted"}>{activeIndex >= 1 ? t("demo.submitted") : t("demo.submit")}</span>
          </div>

          <div className={`assessment-box ${assessmentDraft ? "visible" : ""}`}>
            {assessmentDraft && (
              <>
                <div className="assessment-head">
                  <div><small>{t("demo.assessmentContract")}</small><strong>{assessmentDraft.totalScore} / 100</strong></div>
                  <div className="assessment-badges">
                    <span>{t("demo.confidence")} {assessmentDraft.confidence.toFixed(2)}</span>
                    <span className={`engine-badge ${assessmentMode === "openai" || assessmentMode === "gemini" || assessmentMode === "tokenrouter" ? "live" : "fixture"}`}>
                      {assessmentMode === "openai" || assessmentMode === "gemini" || assessmentMode === "tokenrouter" ? assessment.provenance.model : t("demo.fixture")}
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
                  <span>{t("demo.grounding")} {Math.round(assessmentDraft.grounding.citationCoverage * 100)}%</span>
                  <span>{assessmentDraft.reviewerFlags.length} {t("demo.reviewerFlag")}</span>
                  <span>{assessment.provenance.validationPassed ? t("demo.contractPass") : t("demo.contractFail")}</span>
                </div>
                {assessmentDraft.reviewerFlags[0] && <blockquote>{assessmentDraft.reviewerFlags[0]}</blockquote>}
                <div className={`human-seal ${state?.review ? "approved" : ""}`}>
                  {state?.review ? `✓ ${t("demo.activeApproved")} · ${state.review.reviewer}` : t("demo.humanAwaiting")}
                </div>
              </>
            )}
          </div>

          {action ? (
            <div className="next-action">
              <div><small>{t("demo.nextStep")}</small><strong>{t(action.helper as Parameters<typeof t>[0])}</strong></div>
              <button className="button button-primary" disabled={busy} onClick={() => act(action.action)}>{busy ? t("demo.processing") : t(action.label as Parameters<typeof t>[0])}</button>
            </div>
          ) : (
            <div className="next-action revoked-action">
              <div><small>{t("demo.utilityCheck")}</small><strong>{t("demo.revokedDescription")}</strong></div>
              <button className="button button-dark" disabled={busy} onClick={() => act("reset")}>{t("demo.runAgain")}</button>
            </div>
          )}
          {error && <p className="demo-error" role="alert">{error}</p>}
        </section>

        <aside className="proof-panel">
          <div className="proof-panel-label">{t("demo.skillPassport")}</div>
          <div className={`credential-card ${activeIndex >= 4 ? "issued" : ""} ${state?.stage === "revoked" ? "revoked" : ""}`}>
            <div className="credential-top"><span>VLU × SKILLBRIDGE</span><span>PS-001</span></div>
            <div className="credential-score"><strong>{activeIndex >= 4 ? credentialScore : "—"}</strong><span>{t("demo.credentialStrategy")}</span></div>
            <p>{t("demo.credentialProof")}</p>
            <div className="credential-lines"><span /><span /><span /></div>
            <div className="credential-status">
              {state?.stage === "revoked" ? t("demo.revokedDenied") : activeIndex >= 4 ? t("demo.activeApproved") : t("demo.notIssued")}
            </div>
          </div>

          <div className={`opportunity-card ${state?.stage === "unlocked" ? "unlocked" : ""}`}>
            <div><span>{t("demo.levelOpportunity")}</span><strong>{t("demo.opportunityTitle")}</strong></div>
            <span className="lock-mark">{state?.stage === "unlocked" ? t("demo.open") : t("demo.locked")}</span>
          </div>

          <div className="activity-log">
            <div className="activity-title"><span>{t("demo.activity")}</span><button onClick={() => act("reset")} disabled={busy}>{t("demo.reset")}</button></div>
            {!state && <p>{t("demo.starting")}</p>}
            {state?.events.slice().reverse().slice(0, 4).map((event, index) => (
              <div className="activity-item" key={`${event.at}-${index}`}><span /><div><strong>{event.label}</strong><small>{event.detail}</small></div></div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

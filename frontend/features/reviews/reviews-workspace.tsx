"use client";
import { apiFetch } from "../../lib/api-fetch";
import { AiAssistant } from "../../components/feedback/ai-assistant";
import { SourcePermission } from "../portfolios/source-permission";
import {EvidenceReader,type CitationSelection} from "./evidence-reader";
import {scoreChanges} from "../../../shared/validation/review-changes";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AssessmentDraft } from "../../../shared/validation/assessment-contract";
import { buildManualDraft, parseManualRubric } from "../../../shared/validation/manual-assessment";
import { translateStatus, useLanguage } from "../../i18n/i18n";
import { parseChallengeContent } from "../../../shared/validation/challenge-content";
import { ContentSkeleton } from "../../components/feedback/loading-ui";

type ReviewRow = {
  can_issue?: number;
  submission_id: string; submission_state: string; reflection: string;
  student_name: string | null; student_wallet: string; challenge_title: string;
  challenge_brief: string; content_json: string | null; rubric_json: string; business_name: string; reviewer_organization_name: string; reviewer_organization_kind: "business" | "university"; review_mode: "self" | "independent";
  reviewer_organization_id: string; assessment_id: string | null;
  assessment_status: string | null; assessment_mode: string | null; assessment_json: string | null; review_json: string | null;
  file_count: number; credential_id: string | null; credential_status: string | null;
  attestation_address: string | null;
};
type FileRow = { id: string; original_name: string; size_bytes: string; sha256: string };
type StoredReview = { decision?: string; note?: string | null; finalDraft?: AssessmentDraft; officialScore?: number | null };
type StoredEnvelope = { draft?: AssessmentDraft; provenance?: { mode?: string; provider?:string; model?:string }; usage?:{inputTokens:number;outputTokens:number}; retrieval?:{inputTokenEstimate:number} };

function cloneDraft(draft: AssessmentDraft) {
  return JSON.parse(JSON.stringify(draft)) as AssessmentDraft;
}

function readEnvelope(value: string | null) {
  if (!value) return null;
  try { return JSON.parse(value) as StoredEnvelope; } catch { return null; }
}

function readDraft(value: string | null) {
  const envelope = readEnvelope(value);
  if (!envelope || envelope.provenance?.mode === "manual") return null;
  return envelope.draft ?? null;
}

function readStoredDraft(value: string | null) {
  return readEnvelope(value)?.draft ?? null;
}

function readReview(value: string | null) {
  if (!value) return null;
  try { return JSON.parse(value) as StoredReview; } catch { return null; }
}

export function ReviewsWorkspace() {
  const { t, locale } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [aiDraft, setAiDraft] = useState<AssessmentDraft | null>(null);
  const [humanDraft, setHumanDraft] = useState<AssessmentDraft | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [citation,setCitation]=useState<CitationSelection|null>(null);
  const [reviewTab,setReviewTab]=useState("human");
  const [notice, setNotice] = useState<string | null>(null);

  const choice=useRef(0);
  const choose=useCallback(async (row: ReviewRow) => {
    const requestId=++choice.current; setFiles([]);
    setSelected(row.submission_id);
    setCitation(null);
    const envelope = readEnvelope(row.assessment_json);
    const nextAiDraft = readDraft(row.assessment_json);
    const review = readReview(row.review_json);
    const isManual = row.assessment_mode === "manual" || envelope?.provenance?.mode === "manual";
    const officialReview = row.assessment_status !== "in_review" && review?.finalDraft ? review.finalDraft : null;
    setManualMode(isManual);
    setAiDraft(nextAiDraft);
    setHumanDraft(officialReview ? cloneDraft(officialReview) : isManual ? (readStoredDraft(row.assessment_json) ? cloneDraft(readStoredDraft(row.assessment_json) as AssessmentDraft) : null) : nextAiDraft ? cloneDraft(nextAiDraft) : null);
    setNote(review?.note ?? "");
    const response = await apiFetch(`/api/reviews/${row.submission_id}/files`, { cache: "no-store" });
    if(requestId!==choice.current)return;
    if(!response.ok) {setNotice(t("review.networkError"));return;}
    setFiles(response.ok ? ((await response.json()) as { files: FileRow[] }).files : []);
  },[t]);

  async function load() {
    const response = await apiFetch("/api/reviews", { cache: "no-store" });
    if (!response.ok) throw new Error(t("review.networkError"));
    const data = await response.json() as { reviews: ReviewRow[] };
    setRows(data.reviews);
    const current = data.reviews.find((row) => row.submission_id === selected) ?? data.reviews[0];
    if (current) await choose(current);
  }

  useEffect(() => {
    let active = true;
    apiFetch("/api/reviews", { cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error("load"); return response.json() as Promise<{ reviews: ReviewRow[] }>; })
      .then(async (data) => {
        if (!active) return;
        setRows(data.reviews);
        if (data.reviews[0]) await choose(data.reviews[0]);
      })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [choose]);

  const active = useMemo(() => rows.find((row) => row.submission_id === selected) ?? null, [rows, selected]);
  const activeContent = active ? parseChallengeContent(active.content_json, active.challenge_brief) : null;
  const canEdit = active?.assessment_status === "in_review";

  async function generate() {
    if (!active) return;
    setBusy(true); setNotice(null);
    try {
      const response = await apiFetch("/api/assessments/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ submissionId: active.submission_id }) });
      const data = await response.json().catch(() => ({ error: undefined })) as { error?: string;cached?:boolean };
      setNotice(response.ok ? (data.cached ? (locale==="vi"?"Đã dùng kết quả lưu sẵn, không gọi AI mới.":"Cached assessment reused; no new AI call.") : t("review.aiSuccess")) : data.error ?? t("review.aiUnavailable"));
      if (response.ok) await load();
    } catch {
      setNotice(t("review.networkError"));
    } finally {
      setBusy(false);
    }
  }

  async function startManual() {
    if (!active) return;
    const definitions = parseManualRubric(JSON.parse(active.rubric_json));
    if (!definitions) { setNotice(t("review.decisionError")); return; }
    setBusy(true); setNotice(null);
    try {
      const response = await apiFetch("/api/assessments/manual", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "start", submissionId: active.submission_id }) });
      const data = await response.json().catch(() => ({ error: undefined })) as { error?: string };
      if (!response.ok) { setNotice(data.error ?? t("review.decisionError")); return; }
      setManualMode(true);
      setAiDraft(null);
      setHumanDraft(buildManualDraft(definitions));
      setNotice(t("review.manualStarted"));
      await load();
    } catch {
      setNotice(t("review.networkError"));
    } finally {
      setBusy(false);
    }
  }

  function updateHumanDraft(index: number, patch: Partial<AssessmentDraft["rubric"][number]>) {
    setHumanDraft((current) => {
      if (!current) return current;
      const rubric = current.rubric.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item);
      return { ...current, rubric, totalScore: rubric.reduce((sum, item) => sum + item.score, 0) };
    });
  }

  function updateHumanSummary(summary: string) {
    setHumanDraft((current) => current ? { ...current, summary } : current);
  }

  async function decide(decision: "approved" | "rejected" | "changes_requested") {
    if (!active || !humanDraft) return;
    if(aiDraft&&scoreChanges(aiDraft,humanDraft).length&&note.trim().length<5){setNotice(locale==="vi"?"Hãy ghi lý do điều chỉnh điểm AI trước khi xác nhận.":"Explain score changes before confirming.");return;}
    setBusy(true); setNotice(null);
    const endpoint = manualMode ? "/api/assessments/manual" : `/api/assessments/${active.assessment_id}/review`;
    const body = manualMode
      ? { action: "decide", assessmentId: active.assessment_id, decision, note, finalDraft: humanDraft }
      : { decision, note, finalDraft: humanDraft };
    try {
      const response = await apiFetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => ({ error: undefined })) as { error?: string };
      setNotice(response.ok ? t("review.decisionSaved") : data.error ?? t("review.decisionError"));
      if (response.ok) await load();
    } catch {
      setNotice(t("review.decisionError"));
    } finally {
      setBusy(false);
    }
  }

  async function bootstrap() {
    if (!active) return;
    setBusy(true); setNotice(null);
    try {
    const response = await apiFetch("/api/solana/bootstrap", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId: active.reviewer_organization_id }) });
    const data = await response.json() as { error?: string };
    setNotice(response.status===202 ? (locale==="vi"?"Đang xác nhận đơn vị cấp. Bấm kiểm tra lại cùng yêu cầu sau ít giây.":"Issuer confirmation pending. Recheck the same request shortly.") : response.ok ? t("review.issuerReady") : data.error ?? t("review.issuerError"));
    }catch(e){setNotice(e instanceof Error?e.message:t("review.networkError"));}finally{setBusy(false);}
  }

  async function issue() {
    if (!active?.assessment_id) return;
    setBusy(true); setNotice(null);
    try {
    const response = await apiFetch("/api/credentials", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ assessmentId: active.assessment_id }) });
    const data = await response.json() as { error?: string; message?: string; operation?: { signature?: string } };
    setNotice(response.status === 202
      ? (locale === "vi" ? "Đang xác nhận chứng nhận. Bạn có thể bấm cấp chứng nhận lần nữa để kiểm tra cùng yêu cầu; không tạo bản cấp trùng." : "Credential confirmation is pending. Use Issue credential again to recheck the same request; it will not issue twice.")
      : response.ok ? t("review.credentialIssued") : data.error ?? t("review.credentialError")); await load();
    }catch(e){setNotice(e instanceof Error?e.message:t("review.networkError"));}finally{setBusy(false);}
  }

  const humanPanel = humanDraft ? <article className="assessment-column human-assessment-column" data-panel="human"><div className="assessment-column-heading"><div><span>{manualMode ? t("review.manualPathLabel") : t("review.humanFinalLabel")}</span><h3>{t("review.humanScore")}</h3></div><b>{t("review.officialBadge")}</b></div><p className="manual-path-description">{manualMode ? t("review.manualPathDescription") : t("review.officialScoreHint")}</p><div className="assessment-summary human-summary"><div><strong>{humanDraft.totalScore}</strong><span>/100</span></div>{canEdit ? <textarea aria-label={t("review.humanSummaryPlaceholder")} value={humanDraft.summary} onChange={(event) => updateHumanSummary(event.target.value)} placeholder={t("review.humanSummaryPlaceholder")} /> : <p>{humanDraft.summary}</p>}</div><div className="review-rubric">{humanDraft.rubric.map((item, index) => <article key={item.id}><div><strong>{item.label}</strong><label><input aria-label={`${t("review.humanScore")} ${item.label}`} type="number" min="0" max={item.maxScore} value={item.score} disabled={!canEdit} onChange={(event) => updateHumanDraft(index, { score: Math.max(0, Math.min(item.maxScore, Number(event.target.value))) })} /><span>/{item.maxScore}</span></label></div>{canEdit ? <textarea aria-label={`${t("review.humanRationalePlaceholder")} ${item.label}`} className="rubric-note" value={item.rationale} onChange={(event) => updateHumanDraft(index, { rationale: event.target.value })} placeholder={t("review.humanRationalePlaceholder")} /> : <p>{item.rationale}</p>}<small className="official-mark">{t("review.officialScoreHint")}</small></article>)}</div>{canEdit && <><textarea aria-label={t("review.reviewerNote")} className="review-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("review.reviewerNote")} /><div className="review-decisions"><button disabled={busy} onClick={() => decide("changes_requested")}>{t("review.requestChanges")}</button><button disabled={busy} onClick={() => decide("rejected")}>{t("review.reject")}</button><button className="button button-primary" disabled={busy} onClick={() => decide("approved")}>{t("review.approve")}</button></div></>}{!canEdit && active?.submission_state === "submitted" && <button className="button button-dark review-reopen" disabled={busy} onClick={startManual}>{t("review.startManual")}</button>}</article> : null;

  return <div id="workspace-main" tabIndex={-1} className="workspace-product-content"><a className="profile-menu-link" href="/app/escrow">{t("nav.escrow")} →</a>
    {active?.assessment_status === "approved" && <AiAssistant key={active.submission_id} kind="feedback" submissionId={active.submission_id} />}
    <div className="app-welcome"><div><span>{t("review.kicker")}</span><h1>{t("review.title")}</h1><p>{t("review.description")}</p></div><div className="identity-card"><small>{t("review.queue")}</small><strong className="metric-number">{rows.filter((row) => ["submitted", "in_review"].includes(row.submission_state)).length}</strong><b>{rows.length} {t("review.authorized")}</b></div></div>
    {loading ? <ContentSkeleton delayed variant="review" /> : loadError ? <section className="app-panel"><p role="alert">{locale === "vi" ? "Không thể tải danh sách đánh giá. Hãy thử lại." : "Unable to load reviews. Please try again."}</p><button className="button button-dark" onClick={() => window.location.reload()}>{locale === "vi" ? "Thử lại" : "Try again"}</button></section> : rows.length === 0 ? <section className="app-panel empty-product"><h2>{t("review.noSubmissions")}</h2><p>{t("review.noSubmissionsDescription")}</p></section> : <div className="review-layout"><aside className="submission-list">{rows.map((row) => <button className={selected === row.submission_id ? "active" : ""} key={row.submission_id} onClick={() => void choose(row).catch(e=>setNotice(String(e.message)))}><small>{row.business_name}</small><strong>{row.student_name || row.student_wallet.slice(0, 9)}</strong><span>{translateStatus(t, row.submission_state)} · {row.file_count} {t("review.file")}</span></button>)}</aside>
      {active && activeContent && <section className="app-panel review-editor"><div className="entity-top"><span>{active.challenge_title}</span><b>{translateStatus(t, active.credential_status ?? active.assessment_status) || t("review.aiNotRun")}</b></div><div className={`review-provenance ${active.review_mode === "self" ? "internal" : "independent"}`}><span>{active.review_mode === "self" ? t("review.internalLabel") : t("review.independentLabel")}</span><strong>{active.reviewer_organization_name}</strong></div><h2><a href={`/u/${active.student_wallet}`}>{active.student_name || active.student_wallet}</a></h2><div className="review-challenge-brief"><p className="review-brief">{activeContent.summary}</p>{activeContent.context && <section><strong>{t("challenge.contextLabel")}</strong><p>{activeContent.context}</p></section>}{activeContent.objectives.length > 0 && <section><strong>{t("challenge.objectivesLabel")}</strong><ul>{activeContent.objectives.map((item) => <li key={item}>{item}</li>)}</ul></section>}{activeContent.deliverables.length > 0 && <section><strong>{t("challenge.deliverablesLabel")}</strong><ul>{activeContent.deliverables.map((item) => <li key={item}>{item}</li>)}</ul></section>}</div>{active.reflection && <blockquote>{active.reflection}</blockquote>}<div className="file-list">{files.map((file) => <article key={file.id}><div><strong>{file.original_name}</strong><small>{Math.ceil(Number(file.size_bytes) / 1024)} KB · {file.sha256.slice(0, 12)}…</small></div><div className="file-actions"><a href={`/api/files/${file.id}`} target="_blank" rel="noreferrer">{t("review.viewFile")}</a><a href={`/api/files/${file.id}?download=1`}>{t("review.downloadFile")}</a></div></article>)}</div>
        {humanDraft&&<><div className="review-panel-tabs">{[["human",locale==="vi"?"Điểm chính thức":"Official review"],["evidence",locale==="vi"?"Tài liệu":"Documents"],["ai",locale==="vi"?"Gợi ý AI":"AI suggestions"]].filter(([id])=>id!=="ai"||aiDraft).map(([id,label])=><button type="button" key={id} aria-pressed={reviewTab===id} onClick={()=>setReviewTab(id)}>{label}</button>)}</div>{aiDraft&&<details className="app-panel"><summary>{locale==="vi"?"So sánh điểm và thông tin AI":"Score changes and AI usage"}</summary>{scoreChanges(aiDraft,humanDraft).map(change=><p key={change.id}>{change.label}: AI {change.aiScore} → {locale==="vi"?"Chính thức":"Official"} {change.officialScore}</p>)}<p>{locale==="vi"?"Ghi lý do điều chỉnh điểm trong ô nhận xét trước khi xác nhận.":"Explain score changes in the review note before confirming."}</p><p>{readEnvelope(active.assessment_json)?.provenance?.provider} · {readEnvelope(active.assessment_json)?.provenance?.model}</p><p>Token: {readEnvelope(active.assessment_json)?.usage?.inputTokens??"—"} / {readEnvelope(active.assessment_json)?.usage?.outputTokens??"—"}</p></details>}</>}
        {!aiDraft && !humanDraft ? <div className="review-path-choice"><article className="review-path-card manual-path-card"><span>{t("review.officialPathBadge")}</span><h3>{t("review.manualOptionTitle")}</h3><p>{t("review.manualOptionDescription")}</p><button className="button button-primary" disabled={busy || !["submitted", "in_review", "changes_requested"].includes(active.submission_state)} onClick={startManual}>{busy ? t("review.reading") : t("review.startManual")}</button></article><article className="review-path-card ai-path-card"><span>{t("review.aiOptionalBadge")}</span><h3>{t("review.aiOptionTitle")}</h3><p>{t("review.aiOptionDescription")}</p><button className="button button-dark" disabled={busy || !["submitted", "in_review"].includes(active.submission_state)} onClick={generate}>{busy ? t("review.reading") : t("review.runAiOptional")}</button></article></div> : aiDraft ? <div className="review-assessment-columns evidence-columns" data-active-panel={reviewTab}>{humanPanel}<EvidenceReader key={(active.assessment_id||active.submission_id)+(citation?.sourceId||"")+(citation?.quote||"")} assessmentId={active.assessment_id} files={files} citation={citation}/><details className="ai-disclosure" data-panel="ai" open><summary>{t("review.aiComments")} · {t("review.aiOptionalBadge")}</summary><article className="assessment-column ai-assessment-column"><div className="assessment-column-heading"><div><span>{t("review.aiDraftLabel")}</span><h3>{t("review.aiComments")}</h3></div><b>{t("review.readOnlyBadge")}</b></div><div className="assessment-summary"><div><strong>{aiDraft.totalScore}</strong><span>/100</span></div><p>{aiDraft.summary}</p></div>{(aiDraft.reviewerFlags.length>0||aiDraft.grounding.unsupportedClaims.length>0)&&<div className="app-notice"><strong>{locale==="vi"?"Nội dung cần con người kiểm tra":"Items requiring human verification"}</strong><ul>{[...aiDraft.reviewerFlags,...aiDraft.grounding.unsupportedClaims].map((flag,index)=><li key={index}>{flag}</li>)}</ul></div>}<div className="review-rubric">{aiDraft.rubric.map((item) => <article key={item.id}><div><strong>{item.label}</strong><span className="ai-score-badge">{item.score}/{item.maxScore}</span></div><p>{item.rationale}</p>{item.citations.map((citation, citationIndex) => <blockquote key={citationIndex}><small>{citation.sourceId} · {citation.locator}</small>“{citation.quote}”<button className="button button-secondary" type="button" onClick={()=>{setCitation({sourceId:citation.sourceId,quote:citation.quote});setReviewTab("evidence");requestAnimationFrame(()=>{if(window.matchMedia("(max-width:1600px)").matches)document.querySelector('[data-panel="evidence"]')?.scrollIntoView({block:"center"});});}}>{locale==="vi"?"Xem đoạn bằng chứng":"Open evidence"}</button></blockquote>)}</article>)}</div><p className="assessment-footnote">{t("review.aiReadOnly")}</p></article></details></div> : <div className="review-assessment-columns manual-only evidence-columns" data-active-panel={reviewTab}>{humanPanel}<EvidenceReader key={active.submission_id} assessmentId={active.assessment_id} files={files} citation={null}/></div>}
        {notice && <p className="app-notice" role="status">{notice}</p>}
        {active.assessment_status === "approved" && !active.credential_id && <div className="chain-actions"><button className="button button-dark" disabled={busy || !active.can_issue} onClick={bootstrap}>{t("review.initializeIssuer")}</button><button className="button button-primary" disabled={busy || !active.can_issue} onClick={issue}>{t("review.issueCredential")}</button></div>}
        {active.assessment_status==="approved" && !active.can_issue && !active.credential_id && <p className="field-hint">{locale==="vi"?"Cần quản trị viên hoặc người có quyền cấp chứng nhận. Việc nhận thưởng vẫn là luồng riêng.":"An administrator or credential issuer must issue the credential. Reward claims are a separate flow."}</p>}
        {active.credential_id && <a className="chain-proof-link" href={`/verify/${active.credential_id}`}>{t("review.openVerification")}</a>}
        {active.assessment_status === "approved" && active.assessment_id && <SourcePermission key={active.assessment_id} assessmentId={active.assessment_id}/>}
      </section>}
    </div>}
    {notice && <p className="app-notice" role="status">{notice}</p>}
  </div>;
}

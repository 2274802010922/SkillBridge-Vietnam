"use client";

import { useEffect, useMemo, useState } from "react";
import type { AssessmentDraft } from "../../lib/assessment-contract";

type ReviewRow = {
  submission_id: string; submission_state: string; reflection: string;
  student_name: string | null; student_wallet: string; challenge_title: string;
  challenge_brief: string; business_name: string; reviewer_organization_name: string;
  reviewer_organization_id: string; assessment_id: string | null;
  assessment_status: string | null; assessment_json: string | null;
  file_count: number; credential_id: string | null; credential_status: string | null;
  attestation_address: string | null;
};
type FileRow = { id: string; original_name: string; size_bytes: string; sha256: string };

export function ReviewsWorkspace() {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [draft, setDraft] = useState<AssessmentDraft | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/reviews", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { reviews: ReviewRow[] };
    setRows(data.reviews);
    const current = data.reviews.find((row) => row.submission_id === selected) ?? data.reviews[0];
    if (current) await choose(current);
  }
  async function choose(row: ReviewRow) {
    setSelected(row.submission_id);
    setDraft(row.assessment_json ? (JSON.parse(row.assessment_json) as { draft: AssessmentDraft }).draft : null);
    const response = await fetch(`/api/reviews/${row.submission_id}/files`, { cache: "no-store" });
    setFiles(response.ok ? ((await response.json()) as { files: FileRow[] }).files : []);
  }
  useEffect(() => {
    let active = true;
    fetch("/api/reviews", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<{ reviews: ReviewRow[] }> : { reviews: [] }).then(async (data) => {
      if (!active) return;
      setRows(data.reviews);
      const first = data.reviews[0];
      if (!first) return;
      setSelected(first.submission_id);
      setDraft(first.assessment_json ? (JSON.parse(first.assessment_json) as { draft: AssessmentDraft }).draft : null);
      const fileResponse = await fetch(`/api/reviews/${first.submission_id}/files`, { cache: "no-store" });
      if (active && fileResponse.ok) setFiles(((await fileResponse.json()) as { files: FileRow[] }).files);
    });
    return () => { active = false; };
  }, []);

  const active = useMemo(() => rows.find((row) => row.submission_id === selected) ?? null, [rows, selected]);
  async function generate() {
    if (!active) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/assessments/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ submissionId: active.submission_id }),
      });
      const data = await response.json().catch(() => ({ error: undefined })) as { error?: string };
      setNotice(response.ok
        ? "AI draft thật đã được tạo và vượt qua assessment contract."
        : data.error ?? "Dịch vụ AI chưa phản hồi. Vui lòng đợi khoảng 1 phút rồi thử lại.");
      if (response.ok) await load();
    } catch {
      setNotice("Mất kết nối khi đang chạy AI. Vui lòng kiểm tra mạng và thử lại.");
    } finally {
      setBusy(false);
    }
  }
  function updateScore(index: number, value: number) {
    setDraft((current) => { if (!current) return current; const rubric = current.rubric.map((item, itemIndex) => itemIndex === index ? { ...item, score: Math.max(0, Math.min(item.maxScore, value)) } : item); return { ...current, rubric, totalScore: rubric.reduce((sum, item) => sum + item.score, 0) }; });
  }
  async function decide(decision: "approved" | "rejected" | "changes_requested") {
    if (!active?.assessment_id) return; setBusy(true); setNotice(null);
    const response = await fetch(`/api/assessments/${active.assessment_id}/review`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision, note, finalDraft: draft }) });
    const data = await response.json() as { error?: string };
    setNotice(response.ok ? `Đã ghi quyết định ${decision} vào audit trail.` : data.error ?? "Không thể lưu review.");
    await load(); setBusy(false);
  }
  async function bootstrap() {
    if (!active) return; setBusy(true); setNotice(null);
    const response = await fetch("/api/solana/bootstrap", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId: active.reviewer_organization_id }) });
    const data = await response.json() as { error?: string };
    setNotice(response.ok ? "Issuer và schema đã sẵn sàng trên Solana Devnet." : data.error ?? "Không thể bootstrap issuer."); setBusy(false);
  }
  async function issue() {
    if (!active?.assessment_id) return; setBusy(true); setNotice(null);
    const response = await fetch("/api/credentials", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ assessmentId: active.assessment_id }) });
    const data = await response.json() as { error?: string };
    setNotice(response.ok ? "Credential đã được phát hành trên Solana Devnet." : data.error ?? "Không thể phát hành credential."); await load(); setBusy(false);
  }

  return <div className="workspace-product-content">
    <div className="app-welcome"><div><span>HUMAN REVIEW QUEUE</span><h1>AI đề xuất. Người quyết định.</h1><p>Reviewer kiểm tra citation, sửa điểm và chịu trách nhiệm cho kết quả cuối.</p></div><div className="identity-card"><small>QUEUE</small><strong className="metric-number">{rows.filter((row) => ["submitted", "in_review"].includes(row.submission_state)).length}</strong><b>{rows.length} bài nộp được phân quyền</b></div></div>
    {rows.length === 0 ? <section className="app-panel empty-product"><h2>Chưa có bài nộp trong queue</h2><p>Challenge phải chọn đúng organization nhà trường và sinh viên phải submit trước.</p></section> : <div className="review-layout"><aside className="submission-list">{rows.map((row) => <button className={selected === row.submission_id ? "active" : ""} key={row.submission_id} onClick={() => choose(row)}><small>{row.business_name}</small><strong>{row.student_name || row.student_wallet.slice(0, 9)}</strong><span>{row.submission_state} · {row.file_count} file</span></button>)}</aside>
      {active && <section className="app-panel review-editor"><div className="entity-top"><span>{active.challenge_title}</span><b>{active.credential_status ?? active.assessment_status ?? "AI not run"}</b></div><h2>{active.student_name || active.student_wallet}</h2><p className="review-brief">{active.challenge_brief}</p><blockquote>{active.reflection}</blockquote><div className="file-list">{files.map((file) => <article key={file.id}><div><a href={`/api/files/${file.id}`} target="_blank" rel="noreferrer">{file.original_name}</a><small>{Math.ceil(Number(file.size_bytes) / 1024)} KB · {file.sha256.slice(0, 12)}…</small></div></article>)}</div>
        {!draft ? <button className="button button-primary ai-run" disabled={busy || active.submission_state !== "submitted"} onClick={generate}>{busy ? "Đang đọc evidence…" : "Chạy AI assessment thật"}</button> : <><div className="assessment-summary"><div><strong>{draft.totalScore}</strong><span>/100</span></div><p>{draft.summary}</p></div><div className="review-rubric">{draft.rubric.map((item, index) => <article key={item.id}><div><strong>{item.label}</strong><label><input type="number" min="0" max={item.maxScore} value={item.score} disabled={active.assessment_status !== "in_review"} onChange={(event) => updateScore(index, Number(event.target.value))} /><span>/{item.maxScore}</span></label></div><p>{item.rationale}</p>{item.citations.map((citation, citationIndex) => <blockquote key={citationIndex}><small>{citation.sourceId} · {citation.locator}</small>“{citation.quote}”</blockquote>)}</article>)}</div>
          {active.assessment_status === "in_review" && <><textarea className="review-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ghi chú của reviewer…" /><div className="review-decisions"><button disabled={busy} onClick={() => decide("changes_requested")}>Yêu cầu sửa</button><button disabled={busy} onClick={() => decide("rejected")}>Từ chối</button><button className="button button-primary" disabled={busy} onClick={() => decide("approved")}>Phê duyệt</button></div></>}
          {active.assessment_status === "approved" && !active.credential_id && <div className="chain-actions"><button className="button button-dark" disabled={busy} onClick={bootstrap}>1. Khởi tạo issuer/schema</button><button className="button button-primary" disabled={busy} onClick={issue}>2. Cấp credential Devnet</button></div>}
          {active.credential_id && <a className="chain-proof-link" href={`/verify/${active.credential_id}`}>Mở public verification →</a>}
        </>}
      </section>}
    </div>}
    {notice && <p className="app-notice">{notice}</p>}
  </div>;
}

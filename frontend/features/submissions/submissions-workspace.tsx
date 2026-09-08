"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { upload as uploadToBlob } from "@vercel/blob/client";
import { translateStatus, useLanguage } from "../../i18n/i18n";
import { ContentSkeleton, InlineLoading } from "../../components/feedback/loading-ui";

type SubmissionListItem = { id: string; state: string; reflection: string; evidence_json: string; challenge_title: string; organization_name: string; reward: string; file_count: number; assessment_status: string | null };
type FileItem = { id: string; original_name: string; content_type: string; size_bytes: string; sha256: string };
const CLIENT_UPLOAD_THRESHOLD = 4 * 1024 * 1024;

function safeUploadName(value: string) {
  return value.normalize("NFKC").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-100) || "evidence";
}

async function hashFile(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function SubmissionsWorkspace() {
  const { t, locale } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [items, setItems] = useState<SubmissionListItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [preview, setPreview] = useState<FileItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<"save" | "submit" | "upload" | "remove" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const openRequest = useRef(0);

  async function open(id: string) {
    const requestId = ++openRequest.current;
    setSelected(id);
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/submissions/${id}`, { cache: "no-store" });
      if (!response.ok) throw new Error(locale === "vi" ? "Không thể tải bài nộp." : "Unable to load the submission.");
      const data = await response.json() as { submission: { reflection: string }; files: FileItem[] };
      if (requestId !== openRequest.current) return;
      setNote(data.submission.reflection);
      setFiles(data.files);
      setPreview(null);
    } catch (error) {
      if (requestId === openRequest.current) setNotice(error instanceof Error ? error.message : t("submission.uploadError"));
    } finally {
      if (requestId === openRequest.current) setDetailLoading(false);
    }
  }

  async function loadList() {
    const response = await fetch("/api/submissions", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json() as { submissions: SubmissionListItem[] };
    setItems(data.submissions);
    if (!selected && data.submissions[0]) await open(data.submissions[0].id);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/submissions", { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error("load");
      return response.json() as Promise<{ submissions: SubmissionListItem[] }>;
    }).then(async (data) => {
      if (!active) return;
      setItems(data.submissions);
      const first = data.submissions[0];
      if (!first) return;
      const detail = await fetch(`/api/submissions/${first.id}`, { cache: "no-store" });
      if (!active || !detail.ok) return;
      const payload = await detail.json() as { submission: { reflection: string }; files: FileItem[] };
      setSelected(first.id);
      setNote(payload.submission.reflection);
      setFiles(payload.files);
    }).catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; openRequest.current += 1; };
  }, []);

  async function save(action: "save" | "submit") {
    if (!selected) return;
    if (action === "submit" && files.length === 0) {
      setNotice(t("submission.needFile"));
      return;
    }
    setBusy(true); setBusyAction(action); setNotice(null);
    const response = await fetch(`/api/submissions/${selected}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ note, action }) });
    const data = await response.json() as { error?: string; requiresEscrowSignature?: boolean; escrowUrl?: string };
    if(response.ok && data.requiresEscrowSignature && data.escrowUrl){window.location.assign(data.escrowUrl);return;}
    setNotice(response.ok ? (action === "submit" ? t("submission.submitted") : t("submission.saved")) : data.error ?? t("submission.uploadError"));
    if (response.ok) await loadList();
    setBusy(false); setBusyAction(null);
  }

  async function upload(file: File) {
    if (!selected) return;
    setBusy(true); setBusyAction("upload"); setNotice(null);
    try {
      if (file.size > CLIENT_UPLOAD_THRESHOLD) {
        const fileId = crypto.randomUUID();
        const sha256 = await hashFile(file);
        await uploadToBlob(`submissions/${selected}/${fileId}-${safeUploadName(file.name)}`, file, {
          access: "private",
          handleUploadUrl: `/api/submissions/${selected}/files/client-upload`,
          contentType: file.type,
          clientPayload: JSON.stringify({ submissionId: selected, fileId, originalName: file.name, contentType: file.type, sizeBytes: file.size, sha256 }),
        });
        setNotice(t("submission.uploaded"));
      } else {
        const form = new FormData(); form.set("file", file);
        const response = await fetch(`/api/submissions/${selected}/files`, { method: "POST", body: form });
        const data = await response.json() as { error?: string; requiresEscrowSignature?: boolean; escrowUrl?: string };
        setNotice(response.ok ? t("submission.uploaded") : data.error ?? t("submission.uploadError"));
      }
      await open(selected);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t("submission.uploadError"));
    } finally {
      setBusy(false); setBusyAction(null);
    }
  }

  async function uploadMany(fileList: FileList | null) {
    if (!fileList) return;
    for (const file of Array.from(fileList)) await upload(file);
  }

  async function removeFile(fileId: string) {
    if (!selected) return;
    setBusy(true); setBusyAction("remove");
    await fetch(`/api/submissions/${selected}/files?fileId=${encodeURIComponent(fileId)}`, { method: "DELETE" });
    await open(selected);
    setBusy(false); setBusyAction(null);
  }

  const active = items.find((item) => item.id === selected);
  const editable = active?.state === "draft" || active?.state === "changes_requested";
  const fileUrl = (file: FileItem, download = false) => `/api/files/${file.id}${download ? "?download=1" : ""}`;
  const submissionSteps = ["draft", "submitted", "in_review", "approved"] as const;
  const currentStep = active ? Math.max(0, submissionSteps.indexOf(active.state as (typeof submissionSteps)[number])) : 0;

  return <div id="workspace-main" tabIndex={-1} className="workspace-product-content"><a className="profile-menu-link" href="/app/escrow">{t("nav.escrow")} →</a>
    <div className="app-welcome"><div><span>{t("submission.kicker")}</span><h1>{t("submission.title")}</h1><p>{t("submission.description")}</p></div><div className="identity-card"><small>{t("submission.count")}</small><strong className="metric-number">{items.length}</strong><b>{items.filter((item) => item.state === "submitted").length} {t("submission.waitingReview")}</b></div></div>
    {loading ? <ContentSkeleton delayed variant="detail" /> : loadError ? <section className="app-panel"><p role="alert">{locale === "vi" ? "Không thể tải danh sách bài nộp. Hãy thử lại." : "Unable to load submissions. Please try again."}</p><button className="button button-dark" onClick={() => window.location.reload()}>{locale === "vi" ? "Thử lại" : "Try again"}</button></section> : items.length === 0 ? <section className="app-panel empty-product"><h2>{t("submission.noChallenge")}</h2><p>{t("submission.noChallengeDescription")}</p><Link className="button button-dark" href="/app/challenges">{t("submission.viewChallenges")}</Link></section> : <div className="submission-layout">
      <aside className="submission-list">{items.map((item) => <button className={selected === item.id ? "active" : ""} onClick={() => open(item.id)} key={item.id}><small>{item.organization_name}</small><strong>{item.challenge_title}</strong><span>{translateStatus(t, item.state)} · {item.file_count} {t("submission.fileCount")}</span></button>)}</aside>
      <section className="app-panel submission-editor">
        {detailLoading ? <ContentSkeleton variant="detail" /> : <>
        <div className="entity-top"><span>{active?.challenge_title}</span><b>{translateStatus(t, active?.state)}</b></div>
        <div className="submission-progress"><span>{t("submission.progressTitle")}</span><ol>{submissionSteps.map((step, index) => <li className={index <= currentStep ? "done" : ""} key={step}><i>{index < currentStep ? "✓" : index + 1}</i><strong>{translateStatus(t, step)}</strong></li>)}</ol></div>
        <label>{t("submission.note")}<textarea disabled={!editable} value={note} onChange={(event) => setNote(event.target.value)} placeholder={t("submission.notePlaceholder")} /><small>{t("submission.noteHelp")}</small></label>
        <div className="file-uploader"><div><strong>{t("submission.files")}</strong><small>{t("submission.fileHelp")}</small></div>{editable && <label className="button button-dark">{t("submission.chooseFiles")}<input type="file" multiple hidden onChange={(event) => { void uploadMany(event.target.files); event.currentTarget.value = ""; }} /></label>}</div>
        <div className="file-list">{files.map((file) => <article key={file.id}><div><strong>{file.original_name}</strong><small>{Math.ceil(Number(file.size_bytes) / 1024)} KB · SHA {file.sha256.slice(0, 10)}…</small></div><div className="file-actions"><button onClick={() => setPreview(file)}>{t("submission.view")}</button><a href={fileUrl(file, true)}>{t("submission.download")}</a>{editable && <button onClick={() => removeFile(file.id)}>{t("submission.remove")}</button>}</div></article>)}</div>
        {preview && <div className="file-preview"><div className="editor-heading"><strong>{t("submission.preview")}: {preview.original_name}</strong><button onClick={() => setPreview(null)}>{t("submission.closePreview")}</button></div><iframe title={preview.original_name} src={fileUrl(preview)} /></div>}
        {busyAction === "upload" && <InlineLoading label={locale === "vi" ? "Đang tải tệp lên…" : "Uploading file…"} />}
        {editable && <div className="submission-actions"><button aria-busy={busyAction === "save"} className="button button-dark" disabled={busy} onClick={() => save("save")}>{busyAction === "save" ? (locale === "vi" ? "Đang lưu…" : "Saving…") : t("submission.saveDraft")}</button><button aria-busy={busyAction === "submit"} className="button button-primary" disabled={busy || files.length === 0} onClick={() => save("submit")}>{busyAction === "submit" ? (locale === "vi" ? "Đang gửi bài…" : "Submitting…") : t("submission.submit")}</button></div>}
        </>}
      </section>
    </div>}
    {notice && <p className="app-notice" role="status">{notice}</p>}
  </div>;
}

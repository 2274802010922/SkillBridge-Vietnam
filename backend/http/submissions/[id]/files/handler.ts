import { env } from "@/backend/config/runtime-env";
import { auditStatement } from "../../../../services/audit/audit";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../../auth/auth";
import { deleteEvidence, putEvidence } from "../../../../storage/evidence-store";
import { consumeRateLimit } from "../../../../auth/rate-limit";

import { evidenceMime, validTextEvidence } from "../../../../../shared/validation/evidence-file";

const MAX_BYTES = 10 * 1024 * 1024;
const allowedTypes = new Set([
  "application/pdf", "text/plain", "text/markdown", "application/json",
  "image/png", "image/jpeg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

function safeName(value: string) {
  return value.normalize("NFKC").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-100) || "evidence";
}
async function hashBytes(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    await consumeRateLimit(env.DB, "evidence_upload", user.id, 30, 60 * 60);
    const { id } = await params;
    const owned = await env.DB.prepare(`
      SELECT s.state FROM submissions s
      JOIN participations p ON p.id = s.participation_id
      WHERE s.id = ? AND p.student_user_id = ?
    `).bind(id, user.id).first<{ state: string }>();
    if (!owned) return Response.json({ error: "Bài nộp không tồn tại." }, { status: 404 });
    if (owned.state !== "draft" && owned.state !== "changes_requested") {
      return Response.json({ error: "Bài nộp đã khóa." }, { status: 409 });
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Thiếu file." }, { status: 400 });
    const mime=evidenceMime(file.name,file.type);
    if (file.size < 1 || file.size > MAX_BYTES || !allowedTypes.has(mime)) {
      return Response.json({ error: "File không hợp lệ hoặc vượt quá 10 MB." }, { status: 400 });
    }
    const bytes = await file.arrayBuffer();
    if(!validTextEvidence(new Uint8Array(bytes),mime))return Response.json({error:"Tệp văn bản không đúng định dạng UTF-8."},{status:400});
    const idFile = crypto.randomUUID();
    const r2Key = `submissions/${id}/${idFile}-${safeName(file.name)}`;
    const sha256 = await hashBytes(bytes);
    await putEvidence(r2Key, bytes, mime);
    try {
      const writes=await env.DB.batch([
        env.DB.prepare(`
          INSERT INTO submission_files
            (id, submission_id, r2_key, original_name, content_type, size_bytes, sha256, uploaded_by_user_id)
          SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS(SELECT 1 FROM submissions WHERE id=? AND state IN ('draft','changes_requested'))
        `).bind(idFile, id, r2Key, file.name, mime, String(file.size), sha256, user.id, id),
        auditStatement(env.DB, {
          actorUserId: user.id,
          action: "evidence.uploaded",
          targetType: "submission_file",
          targetId: idFile,
          metadata: { submissionId: id, contentType: mime, sizeBytes: file.size, sha256 },
        }),
      ]);
      if(!writes[0].meta.changes)throw new Error("Bài nộp đã khóa. Tệp chưa được thêm.");
    } catch (error) {
      await deleteEvidence(r2Key);
      throw error;
    }
    return Response.json({ file: { id: idFile, originalName: file.name, contentType: mime, sizeBytes: file.size, sha256 } }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const { id } = await params;
    const fileId = new URL(request.url).searchParams.get("fileId");
    if (!fileId) return Response.json({ error: "Thiếu fileId." }, { status: 400 });
    const row = await env.DB.prepare(`
      SELECT f.r2_key, s.state FROM submission_files f
      JOIN submissions s ON s.id = f.submission_id
      JOIN participations p ON p.id = s.participation_id
      WHERE f.id = ? AND f.submission_id = ? AND p.student_user_id = ?
    `).bind(fileId, id, user.id).first<{ r2_key: string; state: string }>();
    if (!row) return Response.json({ error: "File không tồn tại." }, { status: 404 });
    if (row.state !== "draft" && row.state !== "changes_requested") {
      return Response.json({ error: "Bài nộp đã khóa." }, { status: 409 });
    }
    const writes=await env.DB.batch([
      env.DB.prepare("DELETE FROM submission_files WHERE id = ? AND EXISTS(SELECT 1 FROM submissions WHERE id=submission_files.submission_id AND state IN ('draft','changes_requested'))").bind(fileId),
      auditStatement(env.DB, { actorUserId:user.id,action:"evidence.deleted",targetType:"submission_file",targetId:fileId,metadata:{submissionId:id} }),
    ]);
    if(!writes[0].meta.changes)return Response.json({error:"Bài nộp đã khóa."},{status:409});
    await deleteEvidence(row.r2_key);
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

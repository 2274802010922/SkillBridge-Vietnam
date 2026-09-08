import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { env } from "@/backend/config/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../../../auth/auth";
import { auditStatement } from "../../../../../services/audit/audit";

const MAX_BYTES = 10 * 1024 * 1024;
const allowedTypes = new Set([
  "application/pdf", "text/plain", "text/markdown", "application/json",
  "image/png", "image/jpeg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

type UploadPayload = {
  submissionId: string;
  fileId: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  userId?: string;
};

function parsePayload(value: string | null, requireUserId = false): UploadPayload {
  if (!value) throw new Error("Upload token payload is missing.");
  const payload = JSON.parse(value) as Partial<UploadPayload>;
  if (!payload.submissionId || !payload.fileId || !payload.originalName || !payload.contentType || !payload.sha256 || (requireUserId && !payload.userId)) throw new Error("Upload token payload is invalid.");
  const sizeBytes = payload.sizeBytes;
  if (typeof sizeBytes !== "number" || !Number.isFinite(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_BYTES) throw new Error("File size is invalid.");
  if (!allowedTypes.has(payload.contentType)) throw new Error("File type is not allowed.");
  return { ...payload, sizeBytes } as UploadPayload;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json() as HandleUploadBody;
    const isCompletionCallback = body.type === "blob.upload-completed";
    let userId: string | null = null;
    if (!isCompletionCallback) {
      assertSameOrigin(request);
      userId = (await requireSessionUser(request)).id;
    }
    const clientPayload = !isCompletionCallback && "clientPayload" in body.payload ? body.payload.clientPayload : null;
    const parsed = clientPayload ? parsePayload(clientPayload) : null;
    if (parsed && parsed.submissionId !== id) return Response.json({ error: "Upload không thuộc bài nộp hiện tại." }, { status: 403 });
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, payload) => {
        if (!userId) throw new Error("Upload token must be requested by a signed-in user.");
        const tokenPayload = parsePayload(payload);
        if (tokenPayload.submissionId !== id || !pathname.startsWith(`submissions/${id}/`)) throw new Error("Upload path is invalid.");
        const owned = await env.DB.prepare(`
          SELECT s.state FROM submissions s
          JOIN participations p ON p.id = s.participation_id
          WHERE s.id = ? AND p.student_user_id = ?
        `).bind(id, userId).first<{ state: string }>();
        if (!owned || !["draft", "changes_requested"].includes(owned.state)) throw new Error("Bài nộp đã khóa.");
        return {
          allowedContentTypes: [...allowedTypes],
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: false,
          allowOverwrite: false,
          tokenPayload: JSON.stringify({ ...tokenPayload, userId }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const token = parsePayload(tokenPayload ?? null, true);
        if (token.submissionId !== id) throw new Error("Upload callback không thuộc bài nộp hiện tại.");
        if (!blob.pathname.startsWith(`submissions/${token.submissionId}/`)) throw new Error("Uploaded blob path is invalid.");
        const owned = await env.DB.prepare(`
          SELECT s.state FROM submissions s
          JOIN participations p ON p.id = s.participation_id
          WHERE s.id = ? AND p.student_user_id = ?
        `).bind(token.submissionId, token.userId).first<{ state: string }>();
        if (!owned || !["draft", "changes_requested"].includes(owned.state)) throw new Error("Bài nộp đã khóa.");
        await env.DB.batch([
          env.DB.prepare(`
            INSERT OR IGNORE INTO submission_files
              (id, submission_id, r2_key, original_name, content_type, size_bytes, sha256, uploaded_by_user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(token.fileId, token.submissionId, blob.pathname, token.originalName, token.contentType, String(token.sizeBytes), token.sha256, token.userId),
          auditStatement(env.DB, { actorUserId: token.userId, action: "evidence.uploaded", targetType: "submission_file", targetId: token.fileId, metadata: { submissionId: token.submissionId, contentType: token.contentType, sizeBytes: token.sizeBytes, sha256: token.sha256, uploadMode: "client_blob" } }),
        ]);
      },
    });
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}

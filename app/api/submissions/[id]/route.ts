import { env } from "@/lib/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../../lib/auth";
import type { EvidenceSource } from "../../../../lib/assessment-contract";
import { auditStatement } from "../../../../lib/audit";

async function ownedSubmission(userId: string, id: string) {
  return env.DB.prepare(`
    SELECT s.id, s.state, s.reflection, s.evidence_json
    FROM submissions s JOIN participations p ON p.id = s.participation_id
    WHERE s.id = ? AND p.student_user_id = ?
  `).bind(id, userId).first<{ id: string; state: string; reflection: string; evidence_json: string }>();
}

function validateEvidence(value: unknown): EvidenceSource[] | null {
  if (!Array.isArray(value) || value.length > 20) return null;
  const sources = value.map((item, index) => {
    const source = item as Partial<EvidenceSource>;
    return { id: `E${index + 1}`, locator: source.locator?.trim() ?? "", content: source.content?.trim() ?? "" };
  });
  if (sources.some((item) => item.locator.length < 2 || item.locator.length > 160 || item.content.length < 10 || item.content.length > 5000)) return null;
  return sources;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser(request);
    const { id } = await params;
    const submission = await ownedSubmission(user.id, id);
    if (!submission) return Response.json({ error: "Bài nộp không tồn tại." }, { status: 404 });
    const files = await env.DB.prepare(`SELECT id, original_name, content_type, size_bytes, sha256, created_at FROM submission_files WHERE submission_id = ? ORDER BY created_at`).bind(id).all();
    return Response.json({ submission: { ...submission, evidence: JSON.parse(submission.evidence_json) }, files: files.results }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const { id } = await params;
    const submission = await ownedSubmission(user.id, id);
    if (!submission) return Response.json({ error: "Bài nộp không tồn tại." }, { status: 404 });
    if (submission.state !== "draft" && submission.state !== "changes_requested") return Response.json({ error: "Bài nộp đã khóa." }, { status: 409 });
    const body = (await request.json()) as { note?: string; reflection?: string; evidence?: unknown; action?: "save" | "submit" };
    const reflection = (body.note ?? body.reflection ?? "").trim();
    const evidence = body.evidence === undefined ? [] : validateEvidence(body.evidence);
    if (reflection.length > 2000 || evidence === null) return Response.json({ error: "Ghi chú hoặc evidence không hợp lệ." }, { status: 400 });
    if (body.action === "submit") {
      const files = await env.DB.prepare("SELECT COUNT(*) AS count FROM submission_files WHERE submission_id = ?").bind(id).first<{ count: number }>();
      if (Number(files?.count ?? 0) === 0) return Response.json({ error: "Cần ít nhất một file trước khi nộp bài." }, { status: 400 });
      await env.DB.batch([
        env.DB.prepare(`UPDATE submissions SET state = 'submitted', reflection = ?, evidence_json = ?, submitted_at = CURRENT_TIMESTAMP, locked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(reflection, JSON.stringify(evidence), id),
        env.DB.prepare(`UPDATE participations SET state = 'submitted', updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT participation_id FROM submissions WHERE id = ?)`).bind(id),
        auditStatement(env.DB,{actorUserId:user.id,action:"submission.submitted",targetType:"submission",targetId:id,metadata:{evidenceSources:evidence.length}}),
      ]);
      return Response.json({ submission: { id, state: "submitted" } });
    }
    await env.DB.prepare("UPDATE submissions SET reflection = ?, evidence_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(reflection, JSON.stringify(evidence), id).run();
    return Response.json({ submission: { id, state: submission.state, reflection, evidence } });
  } catch (error) { return jsonError(error); }
}

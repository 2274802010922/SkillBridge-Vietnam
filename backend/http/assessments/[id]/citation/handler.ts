import { env } from "@/backend/config/runtime-env";
import { requireSessionUser, jsonError, sha256 } from "@/backend/auth/auth";
import { requireChallengeReviewer } from "@/backend/auth/authorization";
import { getEvidence } from "@/backend/storage/evidence-store";
import { extractDocumentSections } from "@/backend/ai/document-text";
import type {
  EvidenceSource,
  AssessmentDraft,
} from "@/shared/validation/assessment-contract";
import { locateQuote } from "@/shared/validation/citation-location";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireSessionUser(request),
      { id } = await params;
    const row = await env.DB.prepare(
      "SELECT a.assessment_json,a.submission_id,c.reviewer_organization_id,p.student_user_id FROM assessments a JOIN submissions s ON s.id=a.submission_id JOIN participations p ON p.id=s.participation_id JOIN challenges c ON c.id=p.challenge_id WHERE a.id=?",
    )
      .bind(id)
      .first<{
        assessment_json: string;
        submission_id: string;
        reviewer_organization_id: string;
        student_user_id: string;
      }>();
    if (!row) return Response.json({ error: "Not found" }, { status: 404 });
    if (row.student_user_id !== user.id)
      await requireChallengeReviewer(user.id, row.reviewer_organization_id);
    const sourceId = new URL(request.url).searchParams.get("sourceId"),
      quote = new URL(request.url).searchParams.get("quote") || "";
    if (quote.length > 5000)
      return Response.json({ error: "Citation too long" }, { status: 400 });
    const envelope = JSON.parse(row.assessment_json) as {
      evidence?: EvidenceSource[];
      draft: AssessmentDraft;
    };
    const source = envelope.evidence?.find((s) => s.id === sourceId);
    if (
      !source ||
      !quote ||
      !locateQuote(source.content, quote) ||
      !envelope.draft.rubric.some((r) =>
        r.citations.some((c) => c.sourceId === sourceId && c.quote === quote),
      )
    )
      return Response.json(
        { error: "Không xác định được trích dẫn trong bản đánh giá đã lưu." },
        { status: 422 },
      );
    if (!source.fileId || !source.fileHash)
      return Response.json(
        {
          source,
          quote: locateQuote(source.content, quote)!.text,
          content: source.content,
          file: null,
          warning: "SOURCE_HAS_NO_FILE_BINDING",
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    const file = await env.DB.prepare(
      "SELECT id,sha256,r2_key,original_name,content_type,size_bytes FROM submission_files WHERE id=? AND submission_id=?",
    )
      .bind(source.fileId, row.submission_id)
      .first<{
        id: string;
        sha256: string;
        r2_key: string;
        original_name: string;
        content_type: string;
        size_bytes: string;
      }>();
    if (!file || file.sha256 !== source.fileHash)
      return Response.json(
        { error: "Tệp không khớp phiên bản đã đánh giá." },
        { status: 409 },
      );
    if (Number(file.size_bytes) > 20 * 1024 * 1024)
      return Response.json(
        { error: "Tệp quá lớn để đọc trực tiếp." },
        { status: 413 },
      );
    const object = await getEvidence(file.r2_key);
    if (!object)
      return Response.json({ error: "File unavailable" }, { status: 404 });
    const bytes = await object.arrayBuffer();
    const digest = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("");
    if (digest !== source.fileHash)
      return Response.json(
        { error: "Nội dung tệp đã thay đổi." },
        { status: 409 },
      );
    const parsed = await extractDocumentSections([
      { filename: file.original_name, contentType: file.content_type, bytes },
    ]);
    const section = parsed.sections.find(
      (s) => s.locator === source.locator && locateQuote(s.content, quote),
    );
    const content = section?.content || source.content;
    return Response.json(
      {
        source,
        quote: locateQuote(content, quote)!.text,
        content,
        file: {
          id: file.id,
          name: file.original_name,
          type: file.content_type,
          hash: file.sha256,
          page: source.page || null,
        },
        warning: section ? null : "EXACT_POSITION_UNAVAILABLE",
        bindingHash: await sha256(
          JSON.stringify({
            submission: row.submission_id,
            file: file.id,
            hash: file.sha256,
          }),
        ),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return jsonError(e);
  }
}

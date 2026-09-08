import { GET as readSubmission } from "../handler";
import { env } from "@/backend/config/runtime-env";
import { hashBytes } from "@/solana/client/challenge-escrow";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const response = await readSubmission(request, context);
  if (!response.ok) return response;
  const { id } = await context.params;
  if (new URL(request.url).searchParams.get("kind") === "result") {
    const assessment = await env.DB.prepare(
      "SELECT a.status,a.final_result_hash,(SELECT review_json FROM reviews WHERE assessment_id=a.id ORDER BY created_at DESC LIMIT 1) AS review_json FROM assessments a WHERE a.submission_id=?",
    )
      .bind(id)
      .first<{
        status: string;
        final_result_hash: string | null;
        review_json: string | null;
      }>();
    if (!assessment || !["approved", "rejected"].includes(assessment.status))
      return Response.json(
        { error: "Chưa có kết quả chính thức." },
        { status: 409 },
      );
    const committedText = JSON.stringify({
      submissionId: id,
      status: assessment.status,
      finalHash: assessment.final_result_hash,
    });
    const review = assessment.review_json
      ? JSON.parse(assessment.review_json)
      : null;
    const finalDraftText = review?.finalDraft
      ? JSON.stringify(review.finalDraft)
      : null;
    if (
      assessment.final_result_hash &&
      (!finalDraftText ||
        (await hashBytes(finalDraftText)).toString("hex") !==
          assessment.final_result_hash)
    )
      return Response.json(
        { error: "Nội dung kết quả không khớp hash chính thức." },
        { status: 409 },
      );
    return Response.json(
      {
        format: "skillbridge.result.v1",
        kind: "result",
        committedText,
        finalDraftText,
        hash: (await hashBytes(committedText)).toString("hex"),
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Disposition":
            'attachment; filename="skillbridge-result.json"',
        },
      },
    );
  }
  const data = (await response.json()) as {
    submission: { reflection: string; evidence_json: string };
    files: Array<{ id: string; sha256: string }>;
  };
  const lock = await env.DB.prepare(
    "SELECT evidence_hash FROM escrow_submission_locks WHERE submission_id=?",
  )
    .bind(id)
    .first<{ evidence_hash: string }>();
  const files = data.files
    .map((f) => ({ id: f.id, sha256: f.sha256 }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const committedText = JSON.stringify({
    note: data.submission.reflection,
    evidence: data.submission.evidence_json,
    files,
  });
  const hash = (await hashBytes(committedText)).toString("hex");
  if (lock && hash !== lock.evidence_hash)
    return Response.json(
      { error: "Không thể xuất bản khớp hash đã khóa." },
      { status: 409 },
    );
  return Response.json(
    {
      format: "skillbridge.submission.v1",
      kind: "submission",
      submissionId: id,
      committedText,
      hash,
      locked: !!lock,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition":
          'attachment; filename="skillbridge-submission.json"',
      },
    },
  );
}

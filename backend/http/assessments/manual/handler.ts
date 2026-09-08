import { env } from "@/backend/config/runtime-env";
import type { AssessmentDraft } from "../../../../shared/validation/assessment-contract";
import { auditStatement } from "../../../services/audit/audit";
import { assertSameOrigin, jsonError, requireSessionUser, sha256 } from "../../../auth/auth";
import { requireChallengeReviewer } from "../../../auth/authorization";
import { buildManualDraft, parseManualRubric, validateManualDraft } from "../../../../shared/validation/manual-assessment";

type SubmissionContext = {
  submission_id: string;
  submission_state: string;
  evidence_json: string;
  rubric_json: string;
  reviewer_organization_id: string;
  assessment_id: string | null;
  assessment_status: string | null;
  assessment_json: string | null;
  ai_result_hash: string | null;
  assessment_mode: string | null;
};

type Body = {
  action?: "start" | "decide";
  submissionId?: string;
  assessmentId?: string;
  decision?: "approved" | "rejected" | "changes_requested";
  note?: string;
  finalDraft?: AssessmentDraft;
};

async function contextFor(submissionId: string | undefined, assessmentId: string | undefined) {
  const where = assessmentId ? "a.id = ?" : "s.id = ?";
  return env.DB.prepare(`
    SELECT s.id AS submission_id, s.state AS submission_state, s.evidence_json,
      c.rubric_json, c.reviewer_organization_id,
      a.id AS assessment_id, a.status AS assessment_status, a.assessment_json,
      a.ai_result_hash, a.assessment_mode
    FROM submissions s
    JOIN participations p ON p.id = s.participation_id
    JOIN challenges c ON c.id = p.challenge_id
    LEFT JOIN assessments a ON a.submission_id = s.id
    WHERE ${where}
  `).bind(assessmentId ?? submissionId).first<SubmissionContext>();
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const body = await request.json() as Body;
    if (!body.submissionId && !body.assessmentId) return Response.json({ error: "Thiếu bài nộp." }, { status: 400 });
    const row = await contextFor(body.submissionId, body.assessmentId);
    if (!row) return Response.json({ error: "Bài nộp không tồn tại." }, { status: 404 });
    await requireChallengeReviewer(user.id, row.reviewer_organization_id);
    if(body.decision==="changes_requested" && await env.DB.prepare("SELECT submission_id FROM escrow_submission_locks WHERE submission_id=?").bind(row.submission_id).first()) return Response.json({error:"Bài đã ký gắn với quỹ có phiên bản cố định. Hãy phê duyệt hoặc từ chối kèm nhận xét."},{status:409});
    if (!["submitted", "in_review", "changes_requested"].includes(row.submission_state)) {
      return Response.json({ error: "Bài nộp không ở trạng thái có thể đánh giá." }, { status: 409 });
    }
    const definitions = parseManualRubric(JSON.parse(row.rubric_json));
    if (!definitions) return Response.json({ error: "Rubric của challenge không hợp lệ." }, { status: 422 });

    if ((body.action ?? "decide") === "start") {
      if (row.assessment_status === "approved") return Response.json({ error: "Bài đã được phê duyệt." }, { status: 409 });
      const draft = buildManualDraft(definitions);
      const previous = row.assessment_json ? JSON.parse(row.assessment_json) as { draft?: AssessmentDraft } : null;
      const envelope = {
        draft,
        provenance: {
          mode: "manual" as const,
          provider: "human-review" as const,
          model: "manual-review",
          generatedAt: new Date().toISOString(),
          validationPassed: true,
          validationErrors: [],
        },
        ...(previous?.draft && row.assessment_mode !== "manual" ? { aiDraft: previous.draft } : {}),
      };
      const assessmentId = row.assessment_id ?? crypto.randomUUID();
      const resultHash = row.ai_result_hash ?? await sha256(`manual:${JSON.stringify(draft)}`);
      const statements = row.assessment_id
        ? [env.DB.prepare(`UPDATE assessments SET provider='human-review', model='manual-review', schema_version=?, assessment_json=?, status='in_review', assessment_mode='manual', final_result_hash=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(draft.schemaVersion, JSON.stringify(envelope), assessmentId)]
        : [env.DB.prepare(`INSERT INTO assessments (id,submission_id,provider,model,schema_version,assessment_json,status,ai_result_hash,assessment_mode) VALUES (?,?,?,?,?,?,?,?,?)`).bind(assessmentId, row.submission_id, "human-review", "manual-review", draft.schemaVersion, JSON.stringify(envelope), "in_review", resultHash, "manual")];
      statements.push(
        env.DB.prepare("UPDATE submissions SET state='in_review', updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.submission_id),
        env.DB.prepare("UPDATE participations SET state='in_review', updated_at=CURRENT_TIMESTAMP WHERE id=(SELECT participation_id FROM submissions WHERE id=?)").bind(row.submission_id),
        auditStatement(env.DB, { actorUserId: user.id, organizationId: row.reviewer_organization_id, action: "assessment.manual_started", targetType: "assessment", targetId: assessmentId, metadata: { submissionId: row.submission_id } }),
      );
      await env.DB.batch(statements);
      return Response.json({ assessmentId, mode: "manual", status: "in_review" });
    }

    if (!row.assessment_id || row.assessment_mode !== "manual" || row.assessment_status !== "in_review") {
      return Response.json({ error: "Đánh giá thủ công chưa được bắt đầu hoặc đã chốt." }, { status: 409 });
    }
    const decision = body.decision;
    if (!decision || !( ["approved", "rejected", "changes_requested"] as const).includes(decision)) {
      return Response.json({ error: "Quyết định không hợp lệ." }, { status: 400 });
    }
    const finalDraft = buildManualDraft(definitions, {
      rubric: body.finalDraft?.rubric,
      summary: body.finalDraft?.summary,
    });
    const validation = validateManualDraft(finalDraft, definitions, decision === "approved");
    if (!validation.valid) return Response.json({ error: "Bản chấm thủ công chưa đầy đủ.", validationErrors: validation.errors }, { status: 422 });
    if ((decision === "rejected" || decision === "changes_requested") && !body.note?.trim()) {
      return Response.json({ error: "Cần ghi chú lý do cho quyết định này." }, { status: 400 });
    }
    const finalHash = decision === "approved" ? await sha256(JSON.stringify(finalDraft)) : null;
    const reviewId = crypto.randomUUID();
    const reviewJson = JSON.stringify({
      decision,
      note: body.note?.trim() || null,
      finalDraft,
      validation,
      source: "human_reviewer",
      mode: "manual",
      officialScore: decision === "approved" ? finalDraft.totalScore : null,
      reviewedAt: new Date().toISOString(),
    });
    const envelope = JSON.stringify({
      draft: finalDraft,
      provenance: { mode: "manual", provider: "human-review", model: "manual-review", generatedAt: new Date().toISOString(), validationPassed: true, validationErrors: [] },
    });
    await env.DB.batch([
      env.DB.prepare("INSERT INTO reviews (id,assessment_id,reviewer_user_id,decision,review_json) VALUES (?,?,?,?,?)").bind(reviewId, row.assessment_id, user.id, decision, reviewJson),
      env.DB.prepare("UPDATE assessments SET status=?, assessment_json=?, final_result_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(decision, envelope, finalHash, row.assessment_id),
      env.DB.prepare("UPDATE submissions SET state=?, locked_at=CASE WHEN ?='changes_requested' THEN NULL ELSE locked_at END, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(decision, decision, row.submission_id),
      env.DB.prepare("UPDATE participations SET state=?, updated_at=CURRENT_TIMESTAMP WHERE id=(SELECT participation_id FROM submissions WHERE id=?)").bind(decision, row.submission_id),
      auditStatement(env.DB, { actorUserId: user.id, organizationId: row.reviewer_organization_id, action: `assessment.manual_${decision}`, targetType: "assessment", targetId: row.assessment_id, metadata: { reviewId, submissionId: row.submission_id, finalResultHash: finalHash, officialScore: decision === "approved" ? finalDraft.totalScore : null } }),
    ]);
    return Response.json({ review: { decision, finalResultHash: finalHash, officialScore: decision === "approved" ? finalDraft.totalScore : null } });
  } catch (error) {
    return jsonError(error);
  }
}

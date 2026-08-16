import { env } from "@/lib/runtime-env";
import { validateAssessment, type AssessmentDraft, type EvidenceSource } from "../../../../../lib/assessment-contract";
import { auditStatement } from "../../../../../lib/audit";
import { assertSameOrigin, jsonError, requireSessionUser, sha256 } from "../../../../../lib/auth";
import { requireUniversityReviewer } from "../../../../../lib/authorization";

type Row = {
  id:string; submission_id:string; status:string; assessment_json:string;
  evidence_json:string; reviewer_organization_id:string;
};

export async function POST(request:Request, { params }:{params:Promise<{id:string}>}) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const { id } = await params;
    const row = await env.DB.prepare(`
      SELECT a.id, a.submission_id, a.status, a.assessment_json,
        s.evidence_json, c.reviewer_organization_id
      FROM assessments a
      JOIN submissions s ON s.id = a.submission_id
      JOIN participations p ON p.id = s.participation_id
      JOIN challenges c ON c.id = p.challenge_id
      WHERE a.id = ?
    `).bind(id).first<Row>();
    if (!row) return Response.json({error:"Assessment không tồn tại."},{status:404});
    await requireUniversityReviewer(user.id,row.reviewer_organization_id);
    if (row.status !== "in_review") return Response.json({error:"Assessment không ở trạng thái chờ review."},{status:409});
    const body = await request.json() as {
      decision?:"approved"|"rejected"|"changes_requested";
      note?:string;
      finalDraft?:AssessmentDraft;
    };
    if (!body.decision || !(["approved","rejected","changes_requested"] as const).includes(body.decision)) {
      return Response.json({error:"Decision không hợp lệ."},{status:400});
    }
    const stored = JSON.parse(row.assessment_json) as {draft:AssessmentDraft};
    if (body.decision === "approved" && !body.finalDraft) {
      return Response.json({error:"Reviewer phải nhập và xác nhận điểm chính thức trước khi phê duyệt."},{status:400});
    }
    const finalDraft = body.finalDraft ?? stored.draft;
    const validation = validateAssessment(finalDraft,JSON.parse(row.evidence_json) as EvidenceSource[]);
    if (body.decision === "approved" && !validation.valid) {
      return Response.json({error:"Kết quả cuối không vượt qua assessment contract.",validationErrors:validation.errors},{status:422});
    }
    const finalHash = body.decision === "approved" ? await sha256(JSON.stringify(finalDraft)) : null;
    const reviewId = crypto.randomUUID();
    const reviewJson = JSON.stringify({
      decision:body.decision,note:body.note?.trim()||null,finalDraft,validation,
      source:"human_reviewer",officialScore:body.decision === "approved" ? finalDraft.totalScore : null,
      reviewedAt:new Date().toISOString(),
    });
    await env.DB.batch([
      env.DB.prepare("INSERT INTO reviews (id,assessment_id,reviewer_user_id,decision,review_json) VALUES (?,?,?,?,?)")
        .bind(reviewId,id,user.id,body.decision,reviewJson),
      env.DB.prepare("UPDATE assessments SET status=?,final_result_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(body.decision,finalHash,id),
      env.DB.prepare("UPDATE submissions SET state=?,locked_at=CASE WHEN ?='changes_requested' THEN NULL ELSE locked_at END,updated_at=CURRENT_TIMESTAMP WHERE id=?")
        .bind(body.decision,body.decision,row.submission_id),
      env.DB.prepare("UPDATE participations SET state=?,updated_at=CURRENT_TIMESTAMP WHERE id=(SELECT participation_id FROM submissions WHERE id=?)")
        .bind(body.decision,row.submission_id),
      auditStatement(env.DB,{
        actorUserId:user.id,organizationId:row.reviewer_organization_id,
        action:`assessment.${body.decision}`,targetType:"assessment",targetId:id,
        metadata:{reviewId,submissionId:row.submission_id,finalResultHash:finalHash,noteProvided:Boolean(body.note?.trim())},
      }),
    ]);
    return Response.json({review:{decision:body.decision,finalResultHash:finalHash}});
  } catch(error) {
    return jsonError(error);
  }
}

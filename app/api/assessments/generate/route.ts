import { env } from "cloudflare:workers";
import type { EvidenceSource } from "../../../../lib/assessment-contract";
import { extractEvidenceSources, generateLiveAssessment } from "../../../../lib/assessment-engine";
import { assertSameOrigin, jsonError, requireSessionUser, sha256 } from "../../../../lib/auth";
import { requireUniversityReviewer } from "../../../../lib/authorization";
import { auditStatement } from "../../../../lib/audit";
import { consumeRateLimit } from "../../../../lib/rate-limit";

type Context = { submission_id:string; state:string; reflection:string; evidence_json:string; title:string; brief:string; rubric_json:string; reviewer_organization_id:string };
type FileRow = { r2_key:string; original_name:string; content_type:string; size_bytes:string };

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    await consumeRateLimit(env.DB, "ai_assessment", user.id, 10, 60 * 60);
    if (!env.OPENAI_API_KEY) return Response.json({ error: "AI production key chưa được cấu hình; hệ thống không dùng fixture cho bài thật." }, { status: 503 });
    const body = (await request.json()) as { submissionId?: string };
    if (!body.submissionId) return Response.json({ error: "Thiếu submissionId." }, { status: 400 });
    const context = await env.DB.prepare(`
      SELECT s.id AS submission_id,s.state,s.reflection,s.evidence_json,
        c.title,c.brief,c.rubric_json,c.reviewer_organization_id
      FROM submissions s JOIN participations p ON p.id=s.participation_id
      JOIN challenges c ON c.id=p.challenge_id WHERE s.id=?
    `).bind(body.submissionId).first<Context>();
    if (!context || !context.reviewer_organization_id) return Response.json({ error: "Bài nộp hoặc đơn vị review không tồn tại." }, { status: 404 });
    await requireUniversityReviewer(user.id, context.reviewer_organization_id);
    if (!(["submitted", "in_review"] as const).includes(context.state as "submitted"|"in_review")) return Response.json({ error: "Bài nộp chưa sẵn sàng để AI đánh giá." }, { status: 409 });

    const fileRows = await env.DB.prepare("SELECT r2_key,original_name,content_type,size_bytes FROM submission_files WHERE submission_id=? ORDER BY created_at").bind(context.submission_id).all<FileRow>();
    const totalBytes = fileRows.results.reduce((sum,file)=>sum+Number(file.size_bytes),0);
    if (totalBytes > 20*1024*1024) return Response.json({ error: "Tổng file cho một lượt AI không được vượt quá 20 MB." }, { status: 413 });
    const files=[] as Array<{filename:string;contentType:string;bytes:ArrayBuffer}>;
    for (const file of fileRows.results) { const object=await env.EVIDENCE.get(file.r2_key); if(object) files.push({filename:file.original_name,contentType:file.content_type,bytes:await object.arrayBuffer()}); }
    const submitted = JSON.parse(context.evidence_json) as EvidenceSource[];
    const extracted = files.length ? await extractEvidenceSources(env, context.submission_id, context.reflection, files) : { evidence: [] as EvidenceSource[], model: "none", warnings: [] as string[] };
    const evidence = [...submitted, ...extracted.evidence].slice(0,20).map((source,index)=>({...source,id:`E${index+1}`}));
    if (!evidence.length) return Response.json({ error: "Không tìm thấy evidence đủ điều kiện trong bài nộp." }, { status: 422 });
    const envelope = await generateLiveAssessment(env, context.submission_id, { title:context.title,brief:context.brief,rubric:JSON.parse(context.rubric_json) }, evidence);
    const assessmentId=crypto.randomUUID(); const resultHash=await sha256(JSON.stringify(envelope.draft)); const status=envelope.provenance.validationPassed?"in_review":"contract_failed";
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO assessments (id,submission_id,provider,model,schema_version,assessment_json,status,ai_result_hash) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(submission_id) DO UPDATE SET provider=excluded.provider,model=excluded.model,schema_version=excluded.schema_version,assessment_json=excluded.assessment_json,status=excluded.status,ai_result_hash=excluded.ai_result_hash,final_result_hash=NULL,updated_at=CURRENT_TIMESTAMP`).bind(assessmentId,context.submission_id,envelope.provenance.provider,envelope.provenance.model,envelope.draft.schemaVersion,JSON.stringify({...envelope,extraction:{model:extracted.model,warnings:extracted.warnings}}),status,resultHash),
      env.DB.prepare("UPDATE submissions SET evidence_json=?,state=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(JSON.stringify(evidence),status==="in_review"?"in_review":"submitted",context.submission_id),
      env.DB.prepare("UPDATE participations SET state=?,updated_at=CURRENT_TIMESTAMP WHERE id=(SELECT participation_id FROM submissions WHERE id=?)").bind(status==="in_review"?"in_review":"submitted",context.submission_id),
      auditStatement(env.DB, { actorUserId:user.id,organizationId:context.reviewer_organization_id,action:"assessment.ai_generated",targetType:"assessment",targetId:assessmentId,metadata:{submissionId:context.submission_id,model:envelope.provenance.model,status} }),
    ]);
    if (!envelope.provenance.validationPassed) return Response.json({ error:"AI output không vượt qua assessment contract.",validationErrors:envelope.provenance.validationErrors },{status:422});
    return Response.json({ assessment:{ id:assessmentId,status,envelope } },{status:201});
  } catch(error){return jsonError(error);}
}

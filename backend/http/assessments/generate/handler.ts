import { selectedAi } from "../../../ai/provider-selection";
import { env } from "@/backend/config/runtime-env";
import type { EvidenceSource } from "../../../../shared/validation/assessment-contract";
import { chunkDocumentSections, estimateTokenCount, extractDocumentSections, type DocumentChunk } from "../../../ai/document-text";
import { retrieveEvidence } from "../../../ai/evidence-retrieval";
import { generateLiveAssessment } from "../../../ai/assessment-engine";
import { assertSameOrigin, jsonError, requireSessionUser, sha256 } from "../../../auth/auth";
import { requireChallengeReviewer } from "../../../auth/authorization";
import { auditStatement } from "../../../services/audit/audit";
import { getEvidence } from "../../../storage/evidence-store";
import { consumeRateLimit } from "../../../auth/rate-limit";
import { contentForPrompt, parseChallengeContent } from "../../../../shared/validation/challenge-content";

export const runtime = "nodejs";
export const maxDuration = 60;

type Context = {
  submission_id: string;
  state: string;
  reflection: string;
  evidence_json: string;
  title: string;
  brief: string;
  content_json: string | null;
  rubric_json: string;
  reviewer_organization_id: string;
};
type FileRow = { id: string; r2_key: string; original_name: string; content_type: string; size_bytes: string; sha256: string };
type StoredChunk = DocumentChunk & { id: string; file_id: string; file_hash: string };

function numeric(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.floor(parsed))) : fallback;
}

async function loadOrCreateChunks(files: FileRow[], submissionId: string) {
  const cached = await env.DB.prepare(`
    SELECT id, file_id, file_hash, locator, ordinal, content, token_estimate AS tokenEstimate
    FROM evidence_chunks WHERE submission_id = ? ORDER BY file_id, ordinal
  `).bind(submissionId).all<StoredChunk>();
  const cacheByFile = new Map<string, StoredChunk[]>();
  for (const chunk of cached.results) cacheByFile.set(chunk.file_id, [...(cacheByFile.get(chunk.file_id) ?? []), chunk]);
  const allChunks: StoredChunk[] = [];
  const warnings: string[] = [];

  for (const file of files) {
    const existing = cacheByFile.get(file.id) ?? [];
    if (existing.length > 0 && existing.every((chunk) => chunk.file_hash === file.sha256)) {
      allChunks.push(...existing);
      continue;
    }
    const object = await getEvidence(file.r2_key);
    if (!object) {
      warnings.push(`${file.original_name}: không tìm thấy file trong Blob.`);
      continue;
    }
    const bytes=await object.arrayBuffer();
    const actualHash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),b=>b.toString(16).padStart(2,"0")).join("");
    if(actualHash!==file.sha256)throw new Response("Tệp không khớp phiên bản đã nộp.",{status:409});
    const extracted = await extractDocumentSections([{
      filename: file.original_name,
      contentType: file.content_type,
      bytes,
    }]);
    warnings.push(...extracted.warnings);
    const chunks = chunkDocumentSections(
      extracted.sections,
      numeric(env.AI_CHUNK_TOKENS, 600, 200, 1_200),
      numeric(env.AI_CHUNK_OVERLAP_TOKENS, 60, 0, 240),
    );
    const persisted = chunks.map((chunk) => ({ ...chunk, id: crypto.randomUUID(), file_id: file.id, file_hash: file.sha256 }));
    await env.DB.batch([
      env.DB.prepare("DELETE FROM evidence_chunks WHERE file_id = ?").bind(file.id),
      ...persisted.map((chunk) => env.DB.prepare(`
        INSERT INTO evidence_chunks (id, submission_id, file_id, file_hash, locator, ordinal, content, token_estimate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(chunk.id, submissionId, file.id, file.sha256, chunk.locator, chunk.ordinal, chunk.content, chunk.tokenEstimate)),
    ]);
    allChunks.push(...persisted);
  }
  return { chunks: allChunks, warnings };
}

export async function POST(request: Request) {
  const requestDeadline=Date.now()+55_000;
  let generationId = "", generationLease = "";
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const body = await request.json() as { submissionId?: string };
    if (!body.submissionId) return Response.json({ error: "Thiếu submissionId." }, { status: 400 });
    const context = await env.DB.prepare(`
      SELECT s.id AS submission_id, s.state, s.reflection, s.evidence_json,
        c.title, c.brief, c.content_json, c.rubric_json, c.reviewer_organization_id
      FROM submissions s
      JOIN participations p ON p.id = s.participation_id
      JOIN challenges c ON c.id = p.challenge_id
      WHERE s.id = ?
    `).bind(body.submissionId).first<Context>();
    if (!context || !context.reviewer_organization_id) return Response.json({ error: "Bài nộp hoặc đơn vị review không tồn tại." }, { status: 404 });
    await requireChallengeReviewer(user.id, context.reviewer_organization_id);
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS ai_generation_locks(submission_id TEXT PRIMARY KEY,lease TEXT NOT NULL,expires_at INTEGER NOT NULL)").run();
    generationLease = crypto.randomUUID();
    const locked = await env.DB.prepare("INSERT INTO ai_generation_locks(submission_id,lease,expires_at) VALUES (?,?,?) ON CONFLICT(submission_id) DO UPDATE SET lease=excluded.lease,expires_at=excluded.expires_at WHERE ai_generation_locks.expires_at<?")
      .bind(context.submission_id,generationLease,Date.now()+120000,Date.now()).run();
    if (!locked.meta.changes) return Response.json({error:"Bài này đang được AI xử lý. Hãy chờ kết quả, không cần gọi lại."},{status:409});
    generationId = context.submission_id;
    if (!( ["submitted", "in_review"] as const).includes(context.state as "submitted" | "in_review")) return Response.json({ error: "Bài nộp chưa sẵn sàng để AI đánh giá." }, { status: 409 });

    const fileRows = await env.DB.prepare("SELECT id, r2_key, original_name, content_type, size_bytes, sha256 FROM submission_files WHERE submission_id = ? ORDER BY created_at").bind(context.submission_id).all<FileRow>();
    const files = fileRows.results;
    const submitted = JSON.parse(context.evidence_json) as EvidenceSource[];
    const rubric = JSON.parse(context.rubric_json) as Array<{ id: string; label: string; maxScore: number }>;
    const structuredBrief = contentForPrompt(parseChallengeContent(context.content_json, context.brief)) || context.brief;
    const fileFingerprint = files.map((file) => ({ id: file.id, sha256: file.sha256, size: file.size_bytes, type: file.content_type }));
    const cacheKey = await sha256(JSON.stringify({
      submissionId: context.submission_id,
      files: fileFingerprint,
      reflection: context.reflection,
      submitted,
      brief: structuredBrief,
      rubric,
      extractionVersion: "local-chunks-v2",
      promptVersion: "assessment-v3-file-bindings",
      provider: selectedAi(env).provider,
      model: selectedAi(env).model,
    }));
    const cached = await env.DB.prepare(`
      SELECT id, status, assessment_json, input_token_estimate, output_token_estimate
      FROM assessments WHERE submission_id = ? AND assessment_mode = 'ai_assisted' AND cache_key = ?
      LIMIT 1
    `).bind(context.submission_id, cacheKey).first<{ id: string; status: string; assessment_json: string; input_token_estimate: number | null; output_token_estimate: number | null }>();
    if (cached) {
      const envelope=JSON.parse(cached.assessment_json) as {provenance?:{validationPassed?:boolean;validationErrors?:string[]}};
      if(cached.status==="contract_failed" || envelope.provenance?.validationPassed!==true)
        return Response.json({error:"Kết quả AI đã lưu không đạt kiểm tra bằng chứng. Hãy dùng chấm thủ công.",validationErrors:envelope.provenance?.validationErrors??[]},{status:422});
      return Response.json({
        assessment: { id: cached.id, status: cached.status, envelope: JSON.parse(cached.assessment_json) },
        cached: true,
        tokenEstimate: { input: cached.input_token_estimate ?? 0, output: cached.output_token_estimate ?? 0 },
      }, { status: 200 });
    }

    if (!env.OPENROUTER_API_KEY && !env.TOKENROUTER_API_KEY && !env.GEMINI_API_KEY && !env.OPENAI_API_KEY) return Response.json({ error: "AI production key chưa được cấu hình; hệ thống không dùng fixture cho bài thật." }, { status: 503 });
    const dailyLimit = numeric(env.AI_DAILY_LIMIT_PER_REVIEWER, 5, 1, 30);
    await consumeRateLimit(env.DB, "ai_assessment_daily", user.id, dailyLimit, 24 * 60 * 60);

    const totalBytes = files.reduce((sum, file) => sum + Number(file.size_bytes), 0);
    if (totalBytes > 20 * 1024 * 1024) return Response.json({ error: "Tổng file cho một lượt AI không được vượt quá 20 MB." }, { status: 413 });
    const { chunks, warnings } = await loadOrCreateChunks(files, context.submission_id);
    const retrieved = retrieveEvidence(
      submitted,
      chunks,
      { title: context.title, brief: structuredBrief, rubric },
      {
        topKPerRubric: numeric(env.AI_TOP_K_PER_RUBRIC, 2, 1, 4),
        maxTokens: numeric(env.AI_MAX_INPUT_TOKENS, 6_000, 1_500, 12_000),
      },
    );
    if (!retrieved.evidence.length) return Response.json({ error: "Không tìm thấy evidence đủ điều kiện trong bài nộp." }, { status: 422 });
    const inputTokenEstimate = estimateTokenCount(JSON.stringify({ title: context.title, brief: structuredBrief, rubric, evidence: retrieved.evidence }));
    if (inputTokenEstimate > numeric(env.AI_MAX_INPUT_TOKENS, 6_000, 1_500, 12_000)) return Response.json({error:"Đề bài và bằng chứng vượt ngân sách token. Hãy rút gọn đề bài hoặc chấm thủ công."},{status:413});
    const envelope = await generateLiveAssessment({...env,AI_REQUEST_DEADLINE_MS:requestDeadline}, context.submission_id, { title: context.title, brief: structuredBrief, rubric }, retrieved.evidence);
    const storedEnvelope = {
      ...envelope,
      evidence: retrieved.evidence,
      extraction: { model: "local-document-parser", warnings },
      retrieval: { selectedChunkCount: retrieved.selectedChunkCount, tokenBudget: numeric(env.AI_MAX_INPUT_TOKENS, 6_000, 1_500, 12_000), inputTokenEstimate },
    };
    const priorId=await env.DB.prepare("SELECT id FROM assessments WHERE submission_id=?").bind(context.submission_id).first<{id:string}>();
    const assessmentId = priorId?.id ?? crypto.randomUUID();
    const resultHash = await sha256(JSON.stringify(envelope.draft));
    const status = envelope.provenance.validationPassed ? "in_review" : "contract_failed";
    const outputTokenEstimate = envelope.usage?.outputTokens ?? estimateTokenCount(JSON.stringify(envelope.draft));
    const writes = await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO assessments (id, submission_id, provider, model, schema_version, assessment_json, status, ai_result_hash, assessment_mode, cache_key, input_token_estimate, output_token_estimate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ai_assisted', ?, ?, ?)
        ON CONFLICT(submission_id) DO UPDATE SET
          provider=excluded.provider, model=excluded.model, schema_version=excluded.schema_version,
          assessment_json=excluded.assessment_json, status=excluded.status, ai_result_hash=excluded.ai_result_hash,
          assessment_mode='ai_assisted', cache_key=excluded.cache_key, input_token_estimate=excluded.input_token_estimate,
          output_token_estimate=excluded.output_token_estimate, final_result_hash=NULL, updated_at=CURRENT_TIMESTAMP
          WHERE assessments.status NOT IN ('approved','rejected')
      `).bind(assessmentId, context.submission_id, envelope.provenance.provider, envelope.provenance.model, envelope.draft.schemaVersion, JSON.stringify(storedEnvelope), status, resultHash, cacheKey, inputTokenEstimate, outputTokenEstimate),
      env.DB.prepare("UPDATE submissions SET state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND state IN ('submitted','in_review')").bind(status === "in_review" ? "in_review" : "submitted", context.submission_id),
      env.DB.prepare("UPDATE participations SET state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT participation_id FROM submissions WHERE id = ?) AND state IN ('submitted','in_review')").bind(status === "in_review" ? "in_review" : "submitted", context.submission_id),
      auditStatement(env.DB, { actorUserId: user.id, organizationId: context.reviewer_organization_id, action: "assessment.ai_generated", targetType: "assessment", targetId: assessmentId, metadata: { submissionId: context.submission_id, model: envelope.provenance.model, status, cacheKey, inputTokenEstimate, outputTokenEstimate, selectedChunkCount: retrieved.selectedChunkCount } }),
    ]);
    if (!writes[0].meta.changes) return Response.json({error:"Kết quả chính thức đã được lưu trong lúc AI xử lý. AI không ghi đè quyết định của con người."},{status:409});
    if (!envelope.provenance.validationPassed) return Response.json({ error: "AI output không vượt qua assessment contract.", validationErrors: envelope.provenance.validationErrors }, { status: 422 });
    return Response.json({ assessment: { id: assessmentId, status, envelope: storedEnvelope }, cached: false, tokenEstimate: { input: inputTokenEstimate, output: outputTokenEstimate } }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  } finally {
    if (generationId) await env.DB.prepare("DELETE FROM ai_generation_locks WHERE submission_id=? AND lease=?").bind(generationId,generationLease).run().catch(()=>{});
  }
}

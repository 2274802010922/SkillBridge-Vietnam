import { env } from "cloudflare:workers";
import { DEMO_EVIDENCE, validateAssessment, type AssessmentEnvelope } from "../../../lib/assessment-contract";
import { generateAssessment } from "../../../lib/assessment-engine";

type Stage = "invited" | "submitted" | "ai_drafted" | "approved" | "issued" | "unlocked" | "revoked";
type DemoEvent = { label: string; detail: string; at: string };
type DemoRow = { id: string; stage: Stage; events_json: string };
type AssessmentRow = {
  assessment_json: string;
  review_json: string | null;
  provider: string;
  model: string;
  status: "draft" | "approved";
};
type ReviewDecision = {
  decision: "approved";
  reviewer: string;
  approvedAt: string;
  resolvedFlags: string[];
};

const COOKIE = "skillbridge_demo";
const MAX_AGE = 60 * 60 * 24 * 7;

const transitions: Record<string, { from: Stage[]; to: Stage; label: string; detail: string }> = {
  submit_evidence: { from: ["invited"], to: "submitted", label: "Evidence submitted", detail: "4 evidence excerpts · immutable source IDs" },
  generate_ai_draft: { from: ["submitted"], to: "ai_drafted", label: "AI assessment validated", detail: "Schema + citation grounding passed" },
  approve_assessment: { from: ["ai_drafted"], to: "approved", label: "Human review approved", detail: "Reviewer confirmed rubric, evidence & flags" },
  issue_credential: { from: ["approved"], to: "issued", label: "Credential preview issued", detail: "Isolated judge walkthrough · no Devnet transaction" },
  unlock_opportunity: { from: ["issued"], to: "unlocked", label: "Opportunity unlocked", detail: "Score ≥ 80 · credential active" },
  revoke_credential: { from: ["issued", "unlocked"], to: "revoked", label: "Credential revoked", detail: "Invitation access removed" },
};

const createRunsTableSql = `
  CREATE TABLE IF NOT EXISTS demo_runs (
    id TEXT PRIMARY KEY,
    stage TEXT NOT NULL DEFAULT 'invited',
    events_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

const createAssessmentsTableSql = `
  CREATE TABLE IF NOT EXISTS demo_assessments (
    run_id TEXT PRIMARY KEY,
    assessment_json TEXT NOT NULL,
    review_json TEXT,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (run_id) REFERENCES demo_runs(id) ON DELETE CASCADE
  )
`;

function parseCookie(request: Request) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE) return rest.join("=");
  }
  return null;
}

function initialEvents(): DemoEvent[] {
  return [{ label: "Challenge invitation", detail: "VLU Marketing Challenge", at: new Date().toISOString() }];
}

function safeJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function ensureRun(request: Request) {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  await env.DB.batch([
    env.DB.prepare(createRunsTableSql),
    env.DB.prepare(createAssessmentsTableSql),
  ]);

  const existingId = parseCookie(request);
  const sessionId = existingId && /^[a-f0-9-]{36}$/i.test(existingId) ? existingId : crypto.randomUUID();
  let row = await env.DB.prepare("SELECT id, stage, events_json FROM demo_runs WHERE id = ?")
    .bind(sessionId).first<DemoRow>();

  if (!row) {
    const events = JSON.stringify(initialEvents());
    await env.DB.prepare("INSERT INTO demo_runs (id, stage, events_json) VALUES (?, 'invited', ?)")
      .bind(sessionId, events).run();
    row = { id: sessionId, stage: "invited", events_json: events };
  }
  return row;
}

async function readAssessment(runId: string) {
  return env.DB.prepare(
    "SELECT assessment_json, review_json, provider, model, status FROM demo_assessments WHERE run_id = ?",
  ).bind(runId).first<AssessmentRow>();
}

function responseFor(row: DemoRow, assessmentRow: AssessmentRow | null, status = 200, error?: string) {
  const assessment = safeJson<AssessmentEnvelope | null>(assessmentRow?.assessment_json ?? null, null);
  const review = safeJson<ReviewDecision | null>(assessmentRow?.review_json ?? null, null);
  return Response.json(
    {
      sessionId: row.id,
      stage: row.stage,
      events: safeJson<DemoEvent[]>(row.events_json, []),
      evidence: DEMO_EVIDENCE,
      assessment,
      review,
      ...(error ? { error } : {}),
    },
    { status, headers: { "set-cookie": `${COOKIE}=${row.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}` } },
  );
}

export async function GET(request: Request) {
  try {
    const row = await ensureRun(request);
    return responseFor(row, await readAssessment(row.id));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const row = await ensureRun(request);
    const payload = (await request.json()) as { action?: string };

    if (payload.action === "reset") {
      const events = JSON.stringify(initialEvents());
      await env.DB.batch([
        env.DB.prepare("DELETE FROM demo_assessments WHERE run_id = ?").bind(row.id),
        env.DB.prepare("UPDATE demo_runs SET stage = 'invited', events_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(events, row.id),
      ]);
      return responseFor({ ...row, stage: "invited", events_json: events }, null);
    }

    const transition = payload.action ? transitions[payload.action] : undefined;
    if (!transition) return responseFor(row, await readAssessment(row.id), 400, "Action không hợp lệ.");
    if (!transition.from.includes(row.stage)) return responseFor(row, await readAssessment(row.id), 409, "Bước này chưa sẵn sàng.");

    let assessmentRow = await readAssessment(row.id);
    let eventDetail = transition.detail;

    if (payload.action === "generate_ai_draft") {
      const assessment = await generateAssessment(
        env as unknown as { OPENAI_API_KEY?: string; OPENAI_ASSESSMENT_MODEL?: string },
        row.id,
      );
      if (!assessment.provenance.validationPassed) {
        return responseFor(row, assessmentRow, 422, "AI output không vượt qua assessment contract.");
      }
      await env.DB.prepare(`
        INSERT INTO demo_assessments (run_id, assessment_json, provider, model, status)
        VALUES (?, ?, ?, ?, 'draft')
        ON CONFLICT(run_id) DO UPDATE SET
          assessment_json = excluded.assessment_json,
          review_json = NULL,
          provider = excluded.provider,
          model = excluded.model,
          status = 'draft',
          updated_at = CURRENT_TIMESTAMP
      `).bind(
        row.id,
        JSON.stringify(assessment),
        assessment.provenance.provider,
        assessment.provenance.model,
      ).run();
      eventDetail = `${assessment.draft.totalScore}/100 · ${assessment.draft.rubric.length} grounded rubric items · ${assessment.provenance.mode}`;
      assessmentRow = await readAssessment(row.id);
    }

    if (payload.action === "approve_assessment") {
      const assessment = safeJson<AssessmentEnvelope | null>(assessmentRow?.assessment_json ?? null, null);
      if (!assessment || !assessment.provenance.validationPassed) {
        return responseFor(row, assessmentRow, 422, "Chưa có assessment hợp lệ để phê duyệt.");
      }
      const currentValidation = validateAssessment(assessment.draft, DEMO_EVIDENCE);
      if (!currentValidation.valid) {
        return responseFor(row, assessmentRow, 422, "Assessment không còn khớp với evidence hiện tại.");
      }
      const review: ReviewDecision = {
        decision: "approved",
        reviewer: "VLU Faculty Reviewer",
        approvedAt: new Date().toISOString(),
        resolvedFlags: assessment.draft.reviewerFlags,
      };
      await env.DB.prepare(`
        UPDATE demo_assessments
        SET review_json = ?, status = 'approved', updated_at = CURRENT_TIMESTAMP
        WHERE run_id = ?
      `).bind(JSON.stringify(review), row.id).run();
      eventDetail = `${review.reviewer} · ${review.resolvedFlags.length} reviewer flag resolved`;
      assessmentRow = await readAssessment(row.id);
    }

    if (payload.action === "issue_credential" && assessmentRow?.status !== "approved") {
      return responseFor(row, assessmentRow, 422, "Credential cần assessment đã được người thật phê duyệt.");
    }

    const events = [
      ...safeJson<DemoEvent[]>(row.events_json, []),
      { label: transition.label, detail: eventDetail, at: new Date().toISOString() },
    ];
    const eventsJson = JSON.stringify(events);
    await env.DB.prepare("UPDATE demo_runs SET stage = ?, events_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(transition.to, eventsJson, row.id).run();

    return responseFor({ ...row, stage: transition.to, events_json: eventsJson }, assessmentRow);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}

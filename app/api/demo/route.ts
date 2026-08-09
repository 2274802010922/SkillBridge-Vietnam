import { env } from "cloudflare:workers";

type Stage = "invited" | "submitted" | "ai_drafted" | "approved" | "issued" | "unlocked" | "revoked";
type DemoEvent = { label: string; detail: string; at: string };
type DemoRow = { id: string; stage: Stage; events_json: string };

const COOKIE = "skillbridge_demo";
const MAX_AGE = 60 * 60 * 24 * 7;

const transitions: Record<string, { from: Stage[]; to: Stage; label: string; detail: string }> = {
  submit_evidence: { from: ["invited"], to: "submitted", label: "Evidence submitted", detail: "Strategy deck + reflection" },
  generate_ai_draft: { from: ["submitted"], to: "ai_drafted", label: "AI draft generated", detail: "87/100 · 3 evidence citations" },
  approve_assessment: { from: ["ai_drafted"], to: "approved", label: "Human review approved", detail: "Reviewer confirmed rubric & evidence" },
  issue_credential: { from: ["approved"], to: "issued", label: "Credential preview issued", detail: "SAS schema · devnet promotion pending" },
  unlock_opportunity: { from: ["issued"], to: "unlocked", label: "Opportunity unlocked", detail: "Score ≥ 80 · credential active" },
  revoke_credential: { from: ["issued", "unlocked"], to: "revoked", label: "Credential revoked", detail: "Invitation access removed" },
};

const createTableSql = `
  CREATE TABLE IF NOT EXISTS demo_runs (
    id TEXT PRIMARY KEY,
    stage TEXT NOT NULL DEFAULT 'invited',
    events_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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

function safeEvents(value: string): DemoEvent[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as DemoEvent[]) : [];
  } catch {
    return [];
  }
}

async function ensureRun(request: Request) {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  await env.DB.prepare(createTableSql).run();

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

function responseFor(row: DemoRow, status = 200, error?: string) {
  return Response.json(
    { sessionId: row.id, stage: row.stage, events: safeEvents(row.events_json), ...(error ? { error } : {}) },
    { status, headers: { "set-cookie": `${COOKIE}=${row.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}` } },
  );
}

export async function GET(request: Request) {
  try {
    return responseFor(await ensureRun(request));
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
      await env.DB.prepare("UPDATE demo_runs SET stage = 'invited', events_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(events, row.id).run();
      return responseFor({ ...row, stage: "invited", events_json: events });
    }

    const transition = payload.action ? transitions[payload.action] : undefined;
    if (!transition) return responseFor(row, 400, "Action không hợp lệ.");
    if (!transition.from.includes(row.stage)) return responseFor(row, 409, "Bước này chưa sẵn sàng.");

    const events = [...safeEvents(row.events_json), { label: transition.label, detail: transition.detail, at: new Date().toISOString() }];
    const eventsJson = JSON.stringify(events);
    await env.DB.prepare("UPDATE demo_runs SET stage = ?, events_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(transition.to, eventsJson, row.id).run();

    return responseFor({ ...row, stage: transition.to, events_json: eventsJson });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}

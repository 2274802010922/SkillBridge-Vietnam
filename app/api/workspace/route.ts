import { env } from "cloudflare:workers";
import { DEMO_EVIDENCE, validateAssessment, type AssessmentEnvelope } from "../../../lib/assessment-contract";
import { generateAssessment } from "../../../lib/assessment-engine";
import {
  WORKSPACE_TRANSITIONS,
  actionsFor,
  canPerform,
  type WorkspaceAction,
  type WorkspaceRole,
  type WorkspaceStage,
} from "../../../lib/workspace-contract";

type WorkspaceEvent = {
  actor: WorkspaceRole | "system";
  label: string;
  detail: string;
  at: string;
};

type WorkspaceRow = {
  id: string;
  stage: WorkspaceStage;
  challenge_json: string;
  participant_json: string | null;
  submission_json: string | null;
  credential_json: string | null;
  opportunity_json: string;
  events_json: string;
};

type AssessmentRow = {
  assessment_json: string;
  review_json: string | null;
  status: "draft" | "approved";
};

type Credential = {
  id: string;
  schema: string;
  score: number;
  status: "active" | "revoked";
  evidenceHash: string;
  issuedAt: string;
  revokedAt: string | null;
  chain: {
    network: "devnet";
    mode: "preview";
    address: null;
  };
};

const COOKIE = "skillbridge_workspace";
const MAX_AGE = 60 * 60 * 24 * 14;
const roles: WorkspaceRole[] = ["business", "student", "university"];

const createWorkspaceTableSql = `
  CREATE TABLE IF NOT EXISTS role_workspaces (
    id TEXT PRIMARY KEY,
    stage TEXT NOT NULL DEFAULT 'draft',
    challenge_json TEXT NOT NULL,
    participant_json TEXT,
    submission_json TEXT,
    credential_json TEXT,
    opportunity_json TEXT NOT NULL,
    events_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

const createAssessmentTableSql = `
  CREATE TABLE IF NOT EXISTS workspace_assessments (
    workspace_id TEXT PRIMARY KEY,
    assessment_json TEXT NOT NULL,
    review_json TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workspace_id) REFERENCES role_workspaces(id) ON DELETE CASCADE
  )
`;

function initialChallenge() {
  return {
    id: "CH-GT-001",
    company: "GreenThread Vietnam",
    title: "Growth Strategy 90D",
    brief: "Thiết kế kế hoạch tăng trưởng 90 ngày cho thương hiệu thời trang bền vững, ưu tiên Gen Z tại TP.HCM.",
    skills: ["Problem framing", "Research", "Growth strategy", "Feasibility"],
    format: "8-hour sprint",
    reward: "Fast-track interview",
    status: "draft",
  };
}

function initialOpportunity() {
  return {
    id: "OP-GT-002",
    title: "Growth Sprint Interview",
    company: "GreenThread Vietnam",
    minimumScore: 80,
    status: "locked",
    reason: "Requires an active Growth Strategy credential with score ≥ 80.",
  };
}

function initialEvents(): WorkspaceEvent[] {
  return [{ actor: "system", label: "Workspace created", detail: "End-to-end role test scenario", at: new Date().toISOString() }];
}

function parseCookie(request: Request) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE) return rest.join("=");
  }
  return null;
}

function safeJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function digest(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function ensureWorkspace(request: Request) {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  await env.DB.batch([
    env.DB.prepare(createWorkspaceTableSql),
    env.DB.prepare(createAssessmentTableSql),
  ]);

  const existingId = parseCookie(request);
  const workspaceId = existingId && /^[a-f0-9-]{36}$/i.test(existingId) ? existingId : crypto.randomUUID();
  let row = await env.DB.prepare(`
    SELECT id, stage, challenge_json, participant_json, submission_json,
      credential_json, opportunity_json, events_json
    FROM role_workspaces WHERE id = ?
  `).bind(workspaceId).first<WorkspaceRow>();

  if (!row) {
    const challenge = JSON.stringify(initialChallenge());
    const opportunity = JSON.stringify(initialOpportunity());
    const events = JSON.stringify(initialEvents());
    await env.DB.prepare(`
      INSERT INTO role_workspaces
        (id, stage, challenge_json, opportunity_json, events_json)
      VALUES (?, 'draft', ?, ?, ?)
    `).bind(workspaceId, challenge, opportunity, events).run();
    row = {
      id: workspaceId,
      stage: "draft",
      challenge_json: challenge,
      participant_json: null,
      submission_json: null,
      credential_json: null,
      opportunity_json: opportunity,
      events_json: events,
    };
  }
  return row;
}

async function readAssessment(workspaceId: string) {
  return env.DB.prepare(`
    SELECT assessment_json, review_json, status
    FROM workspace_assessments WHERE workspace_id = ?
  `).bind(workspaceId).first<AssessmentRow>();
}

function viewerFrom(request: Request) {
  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const name = encodedName && request.headers.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8"
    ? decodeURIComponent(encodedName)
    : null;
  return {
    signedIn: Boolean(request.headers.get("oai-authenticated-user-id")),
    displayName: name ?? request.headers.get("oai-authenticated-user-email") ?? "MVP Tester",
  };
}

function responseFor(request: Request, row: WorkspaceRow, assessmentRow: AssessmentRow | null, status = 200, error?: string) {
  return Response.json(
    {
      workspaceId: row.id,
      stage: row.stage,
      challenge: safeJson(row.challenge_json, initialChallenge()),
      participant: safeJson<Record<string, unknown> | null>(row.participant_json, null),
      submission: safeJson<Record<string, unknown> | null>(row.submission_json, null),
      assessment: safeJson<AssessmentEnvelope | null>(assessmentRow?.assessment_json ?? null, null),
      review: safeJson<Record<string, unknown> | null>(assessmentRow?.review_json ?? null, null),
      credential: safeJson<Credential | null>(row.credential_json, null),
      opportunity: safeJson(row.opportunity_json, initialOpportunity()),
      events: safeJson<WorkspaceEvent[]>(row.events_json, []),
      capabilities: Object.fromEntries(roles.map((role) => [role, actionsFor(role, row.stage)])),
      viewer: viewerFrom(request),
      ...(error ? { error } : {}),
    },
    {
      status,
      headers: { "set-cookie": `${COOKIE}=${row.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}` },
    },
  );
}

export async function GET(request: Request) {
  try {
    const row = await ensureWorkspace(request);
    return responseFor(request, row, await readAssessment(row.id));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const row = await ensureWorkspace(request);
    const body = (await request.json()) as { role?: WorkspaceRole; action?: WorkspaceAction | "reset" };

    if (body.action === "reset") {
      const challenge = JSON.stringify(initialChallenge());
      const opportunity = JSON.stringify(initialOpportunity());
      const events = JSON.stringify(initialEvents());
      await env.DB.batch([
        env.DB.prepare("DELETE FROM workspace_assessments WHERE workspace_id = ?").bind(row.id),
        env.DB.prepare(`
          UPDATE role_workspaces SET
            stage = 'draft', challenge_json = ?, participant_json = NULL,
            submission_json = NULL, credential_json = NULL,
            opportunity_json = ?, events_json = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(challenge, opportunity, events, row.id),
      ]);
      return responseFor(request, {
        ...row,
        stage: "draft",
        challenge_json: challenge,
        participant_json: null,
        submission_json: null,
        credential_json: null,
        opportunity_json: opportunity,
        events_json: events,
      }, null);
    }

    if (!body.role || !roles.includes(body.role) || !body.action || !(body.action in WORKSPACE_TRANSITIONS)) {
      return responseFor(request, row, await readAssessment(row.id), 400, "Role hoặc action không hợp lệ.");
    }
    const role = body.role;
    const action = body.action as WorkspaceAction;
    if (!canPerform(role, action, row.stage)) {
      return responseFor(request, row, await readAssessment(row.id), 403, "Role này không được phép thực hiện bước hiện tại.");
    }

    const transition = WORKSPACE_TRANSITIONS[action];
    const challenge = safeJson<Record<string, unknown>>(row.challenge_json, initialChallenge());
    let participant = safeJson<Record<string, unknown> | null>(row.participant_json, null);
    let submission = safeJson<Record<string, unknown> | null>(row.submission_json, null);
    let credential = safeJson<Credential | null>(row.credential_json, null);
    let opportunity = safeJson<Record<string, unknown>>(row.opportunity_json, initialOpportunity());
    let assessmentRow = await readAssessment(row.id);
    const statements: D1PreparedStatement[] = [];
    let eventDetail = transition.detail;

    if (action === "publish_challenge") challenge.status = "published";
    if (action === "invite_student") {
      participant = { id: "ST-VLU-001", name: "Minh Anh", university: "Van Lang University", status: "invited" };
    }
    if (action === "accept_challenge" && participant) participant.status = "accepted";
    if (action === "submit_evidence") {
      submission = {
        id: "SUB-001",
        fileName: "growth-strategy-v3.pdf",
        submittedAt: new Date().toISOString(),
        evidenceCount: DEMO_EVIDENCE.length,
        evidenceHash: await digest(DEMO_EVIDENCE),
      };
    }
    if (action === "generate_ai_draft") {
      const assessment = await generateAssessment(
        env as unknown as { OPENAI_API_KEY?: string; OPENAI_ASSESSMENT_MODEL?: string },
        row.id,
      );
      if (!assessment.provenance.validationPassed) {
        return responseFor(request, row, assessmentRow, 422, "AI output không vượt qua assessment contract.");
      }
      statements.push(env.DB.prepare(`
        INSERT INTO workspace_assessments (workspace_id, assessment_json, status)
        VALUES (?, ?, 'draft')
        ON CONFLICT(workspace_id) DO UPDATE SET
          assessment_json = excluded.assessment_json,
          review_json = NULL,
          status = 'draft',
          updated_at = CURRENT_TIMESTAMP
      `).bind(row.id, JSON.stringify(assessment)));
      eventDetail = `${assessment.draft.totalScore}/100 · grounding ${Math.round(assessment.draft.grounding.citationCoverage * 100)}% · ${assessment.provenance.mode}`;
      assessmentRow = { assessment_json: JSON.stringify(assessment), review_json: null, status: "draft" };
    }
    if (action === "approve_assessment") {
      const assessment = safeJson<AssessmentEnvelope | null>(assessmentRow?.assessment_json ?? null, null);
      if (!assessment || !validateAssessment(assessment.draft, DEMO_EVIDENCE).valid) {
        return responseFor(request, row, assessmentRow, 422, "Assessment không hợp lệ để phê duyệt.");
      }
      const review = {
        decision: "approved",
        reviewer: "VLU Faculty Reviewer",
        approvedAt: new Date().toISOString(),
        resolvedFlags: assessment.draft.reviewerFlags,
      };
      statements.push(env.DB.prepare(`
        UPDATE workspace_assessments
        SET review_json = ?, status = 'approved', updated_at = CURRENT_TIMESTAMP
        WHERE workspace_id = ?
      `).bind(JSON.stringify(review), row.id));
      assessmentRow = { ...assessmentRow!, review_json: JSON.stringify(review), status: "approved" };
    }
    if (action === "issue_credential") {
      const assessment = safeJson<AssessmentEnvelope | null>(assessmentRow?.assessment_json ?? null, null);
      if (!assessment || assessmentRow?.status !== "approved") {
        return responseFor(request, row, assessmentRow, 422, "Credential yêu cầu assessment đã được phê duyệt.");
      }
      credential = {
        id: "PS-VLU-2026-001",
        schema: "growth-strategy.v1",
        score: assessment.draft.totalScore,
        status: "active",
        evidenceHash: (submission?.evidenceHash as string | undefined) ?? await digest(DEMO_EVIDENCE),
        issuedAt: new Date().toISOString(),
        revokedAt: null,
        chain: { network: "devnet", mode: "preview", address: null },
      };
    }
    if (action === "verify_unlock") {
      if (!credential || credential.status !== "active" || credential.score < Number(opportunity.minimumScore ?? 80)) {
        return responseFor(request, row, assessmentRow, 422, "Credential không đáp ứng opportunity gate.");
      }
      opportunity = { ...opportunity, status: "unlocked", reason: "Active credential verified; interview access granted.", unlockedAt: new Date().toISOString() };
    }
    if (action === "revoke_credential" && credential) {
      credential = { ...credential, status: "revoked", revokedAt: new Date().toISOString() };
      opportunity = { ...opportunity, status: "locked", reason: "Credential revoked; access removed.", unlockedAt: null };
    }

    const events = [
      ...safeJson<WorkspaceEvent[]>(row.events_json, []),
      { actor: role, label: transition.label, detail: eventDetail, at: new Date().toISOString() },
    ];
    const nextRow: WorkspaceRow = {
      ...row,
      stage: transition.to,
      challenge_json: JSON.stringify(challenge),
      participant_json: participant ? JSON.stringify(participant) : null,
      submission_json: submission ? JSON.stringify(submission) : null,
      credential_json: credential ? JSON.stringify(credential) : null,
      opportunity_json: JSON.stringify(opportunity),
      events_json: JSON.stringify(events),
    };
    statements.push(env.DB.prepare(`
      UPDATE role_workspaces SET
        stage = ?, challenge_json = ?, participant_json = ?, submission_json = ?,
        credential_json = ?, opportunity_json = ?, events_json = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      nextRow.stage,
      nextRow.challenge_json,
      nextRow.participant_json,
      nextRow.submission_json,
      nextRow.credential_json,
      nextRow.opportunity_json,
      nextRow.events_json,
      nextRow.id,
    ));
    await env.DB.batch(statements);

    return responseFor(request, nextRow, assessmentRow);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}

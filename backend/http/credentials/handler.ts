import { env } from "@/backend/config/runtime-env";
import type { AssessmentDraft } from "../../../shared/validation/assessment-contract";
import { auditStatement } from "../../services/audit/audit";
import { assertSameOrigin, jsonError, requireSessionUser, sha256 } from "../../auth/auth";
import { requireCredentialIssuer } from "../../auth/authorization";
import { consumeRateLimit } from "../../auth/rate-limit";
import { explorerAddress, explorerTransaction, issueAttestation } from "../../../solana/server/solana-credentials";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const rows = await env.DB.prepare(`
      SELECT DISTINCT sc.*, c.title AS challenge_title, o.name AS issuer_name
      FROM skill_credentials sc
      JOIN challenges c ON c.id = sc.challenge_id
      JOIN organizations o ON o.id = sc.issuer_organization_id
      LEFT JOIN memberships m ON m.organization_id = sc.issuer_organization_id
        AND m.user_id = ? AND m.status = 'active'
      WHERE sc.student_user_id = ? OR m.role IN ('business_admin', 'university_admin', 'credential_issuer')
      ORDER BY sc.created_at DESC
    `).bind(user.id, user.id).all();
    return Response.json({ credentials: rows.results }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    await consumeRateLimit(env.DB, "credential_issue", user.id, 20, 24 * 60 * 60);
    const body = await request.json() as { assessmentId?: string };
    if (!body.assessmentId) return Response.json({ error: "Thiếu assessmentId." }, { status: 400 });
    const row = await env.DB.prepare(`
      SELECT a.id AS assessment_id, a.status AS assessment_status, a.assessment_json,
        a.final_result_hash, s.evidence_json, p.student_user_id,
        w.address AS student_wallet, c.id AS challenge_id, c.minimum_score, c.reward_type, c.reward_metadata_json,
        c.reviewer_organization_id, reviewer.kind AS reviewer_organization_kind, ci.credential_address, ci.schema_address,
        (SELECT r.review_json FROM reviews r WHERE r.assessment_id = a.id AND r.decision = 'approved' ORDER BY r.created_at DESC LIMIT 1) AS review_json
      FROM assessments a
      JOIN submissions s ON s.id = a.submission_id
      JOIN participations p ON p.id = s.participation_id
      JOIN wallets w ON w.user_id = p.student_user_id
      JOIN challenges c ON c.id = p.challenge_id
      JOIN organizations reviewer ON reviewer.id = c.reviewer_organization_id
      LEFT JOIN credential_issuers ci ON ci.organization_id = c.reviewer_organization_id
      WHERE a.id = ?
    `).bind(body.assessmentId).first<{
      assessment_id: string; assessment_status: string; assessment_json: string;
      final_result_hash: string | null; evidence_json: string; student_user_id: string;
      student_wallet: string; challenge_id: string; reviewer_organization_id: string;
      minimum_score: string; reward_type: string; reward_metadata_json: string; reviewer_organization_kind: "business" | "university";
      credential_address: string | null; schema_address: string | null; review_json: string | null;
    }>();
    if (!row) return Response.json({ error: "Assessment không tồn tại." }, { status: 404 });
    await requireCredentialIssuer(user.id, row.reviewer_organization_id);
    if (row.assessment_status !== "approved" || !row.final_result_hash) {
      return Response.json({ error: "Chỉ assessment đã được human-approved mới có thể cấp credential." }, { status: 409 });
    }
    if (!row.credential_address || !row.schema_address) {
      return Response.json({ error: "Đơn vị đánh giá chưa bootstrap Solana issuer/schema." }, { status: 409 });
    }
    const existing = await env.DB.prepare("SELECT * FROM skill_credentials WHERE assessment_id = ?")
      .bind(row.assessment_id).first();
    if (existing) return Response.json({ credential: existing }, { status: 200 });

    const envelope = JSON.parse(row.assessment_json) as { draft: AssessmentDraft };
    const approvedReview = row.review_json ? JSON.parse(row.review_json) as { finalDraft?: AssessmentDraft } : null;
    const officialDraft = approvedReview?.finalDraft ?? envelope.draft;
    const score = Math.round(officialDraft.totalScore);
    if (score < Number(row.minimum_score || 0)) return Response.json({ error: "Điểm chính thức chưa đạt ngưỡng nhận credential/phần thưởng." }, { status: 409 });
    const slots = await env.DB.prepare("SELECT reward_slots FROM challenges WHERE id=?").bind(row.challenge_id).first<{ reward_slots: number | null }>();
    const issuedCount = await env.DB.prepare("SELECT COUNT(*) AS count FROM skill_credentials WHERE challenge_id=? AND status IN ('active','issued')").bind(row.challenge_id).first<{ count: number }>();
    if (Number(slots?.reward_slots ?? 1) <= Number(issuedCount?.count ?? 0)) return Response.json({ error: "Challenge đã đủ số lượng phần thưởng." }, { status: 409 });
    const evidenceHash = await sha256(row.evidence_json);
    const expiryUnix = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
    const issued = await issueAttestation(env, {
      credentialAddress: row.credential_address,
      schemaAddress: row.schema_address,
      studentWallet: row.student_wallet,
      challengeId: row.challenge_id,
      score,
      evidenceHash,
      reviewerRole: row.reviewer_organization_kind === "business" ? "BUSINESS_HUMAN_REVIEWER" : "UNIVERSITY_HUMAN_REVIEWER",
      nonceSeed: row.assessment_id,
      expiryUnix,
    });
    const id = crypto.randomUUID();
    const expiresAt = new Date(expiryUnix * 1000).toISOString();
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO skill_credentials
          (id, assessment_id, challenge_id, student_user_id, student_wallet,
           issuer_organization_id, nonce_address, attestation_address,
           schema_address, score, skills_json, evidence_hash, status, issue_tx, expires_at, issued_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, CURRENT_TIMESTAMP)
      `).bind(id,row.assessment_id,row.challenge_id,row.student_user_id,row.student_wallet,row.reviewer_organization_id,issued.nonceAddress,issued.attestationAddress,row.schema_address,String(score),JSON.stringify(officialDraft.skillSignals ?? []),evidenceHash,issued.signature,expiresAt),
      env.DB.prepare(`
        UPDATE participations SET state = 'credential_issued', updated_at = CURRENT_TIMESTAMP
        WHERE id = (SELECT participation_id FROM submissions
          WHERE id = (SELECT submission_id FROM assessments WHERE id = ?))
      `).bind(row.assessment_id),
      auditStatement(env.DB, {
        actorUserId:user.id,organizationId:row.reviewer_organization_id,
        action:"credential.issued",targetType:"credential",targetId:id,
        metadata:{studentWallet:row.student_wallet,attestationAddress:issued.attestationAddress,score,transaction:issued.signature},
      }),
    ]);
    return Response.json({
      credential: {
        id, status:"active", score, studentWallet:row.student_wallet,
        attestationAddress:issued.attestationAddress, schemaAddress:row.schema_address,
        expiresAt, transaction:issued.signature,
        explorer:explorerTransaction(issued.signature),
        attestationExplorer:explorerAddress(issued.attestationAddress),
      },
    }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

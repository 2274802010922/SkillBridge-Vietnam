import { env } from "@/backend/config/runtime-env";
import type { AssessmentDraft } from "../../../shared/validation/assessment-contract";
import { assertSameOrigin, jsonError, requireSessionUser, sha256 } from "../../auth/auth";
import { requireCredentialIssuer } from "../../auth/authorization";
import { consumeRateLimit } from "../../auth/rate-limit";
import { explorerAddress, explorerTransaction } from "../../../solana/server/solana-credentials";
import { reserveIssuance, recoverIssuance, issuanceOperation } from "../../services/credentials/issuance";
import { issuanceTransport } from "../../../solana/server/credential-issuance";

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
    const pending = await issuanceOperation(env.DB,row.assessment_id);
    if (!pending) {
      const commitment = await env.DB.prepare("SELECT evidence_hash FROM escrow_submission_locks WHERE submission_id=(SELECT submission_id FROM assessments WHERE id=?)").bind(row.assessment_id).first<{evidence_hash:string}>();
      await reserveIssuance(env.DB, {
        assessmentId: row.assessment_id, challengeId: row.challenge_id,
        organizationId: row.reviewer_organization_id, studentUserId: row.student_user_id,
        studentWallet: row.student_wallet, credentialAddress: row.credential_address,
        schemaAddress: row.schema_address, score, evidenceHash: commitment?.evidence_hash ?? await sha256(row.evidence_json),
        resultHash: row.final_result_hash, skills: officialDraft.skillSignals ?? [],
        reviewerRole: row.reviewer_organization_kind === "business" ? "BUSINESS_HUMAN_REVIEWER" : "UNIVERSITY_HUMAN_REVIEWER",
      });
    }
    const outcome = await recoverIssuance(env.DB,row.assessment_id,user.id,issuanceTransport(env));
    if (outcome.credential) {
      const c=outcome.credential as Record<string,unknown>;
      return Response.json({credential:{...c,studentWallet:c.student_wallet,attestationAddress:c.attestation_address,
        transaction:c.issue_tx,explorer:c.issue_tx?explorerTransaction(String(c.issue_tx)):null,
        attestationExplorer:explorerAddress(String(c.attestation_address))},operation:outcome.operation},{status:201});
    }
    const status=outcome.operation.status;
    return Response.json({operation:outcome.operation, message:"Yêu cầu đã được lưu. Kiểm tra lại để đồng bộ, không tạo yêu cầu mới. / Saved; check again to reconcile.",
      ...(status==="failed"||status==="needs_review"?{error:"Cần kiểm tra giao dịch trước khi cấp lại. / Operator reconciliation required."}:{})},
      {status:status==="failed"||status==="needs_review"?409:202,headers:{"cache-control":"no-store"}});

  } catch (error) {
    return jsonError(error);
  }
}

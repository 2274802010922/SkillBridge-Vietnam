import { env } from "@/backend/config/runtime-env";
import { requireSessionUser, jsonError } from "@/backend/auth/auth";
import { requireChallengeReviewer } from "@/backend/auth/authorization";
import {
  readAndSyncEscrow,
  escrowRow,
} from "@/backend/services/escrow/escrow-store";
import {
  hashBytes,
  type SubmissionState,
} from "@/solana/client/challenge-escrow";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireSessionUser(request),
      { id } = await params;
    const context = await env.DB.prepare(
      "SELECT s.*,p.student_user_id,p.joined_at,c.id AS challenge_id,c.title,c.reviewer_organization_id,o.name AS reviewer_name FROM submissions s JOIN participations p ON p.id=s.participation_id JOIN challenges c ON c.id=p.challenge_id LEFT JOIN organizations o ON o.id=c.reviewer_organization_id WHERE s.id=?",
    )
      .bind(id)
      .first<{
        id: string;
        state: string;
        student_user_id: string;
        challenge_id: string;
        title: string;
        reviewer_organization_id: string;
        reviewer_name: string;
        submitted_at: string | null;
        locked_at: string | null;
        reflection: string;
      }>();
    if (!context) return Response.json({ error: "Not found" }, { status: 404 });
    if (context.student_user_id !== user.id)
      await requireChallengeReviewer(user.id, context.reviewer_organization_id);
    const files = await env.DB.prepare(
      "SELECT id,original_name,sha256,size_bytes FROM submission_files WHERE submission_id=?",
    )
      .bind(id)
      .all();
    const assessment = await env.DB.prepare(
      "SELECT a.id,a.status,a.assessment_mode,a.updated_at,(SELECT review_json FROM reviews WHERE assessment_id=a.id ORDER BY created_at DESC LIMIT 1) AS review_json FROM assessments a WHERE a.submission_id=?",
    )
      .bind(id)
      .first();
    const credential = await env.DB.prepare(
      "SELECT id,status,attestation_address,issue_tx,issued_at,revoked_at FROM skill_credentials WHERE assessment_id=(SELECT id FROM assessments WHERE submission_id=?)",
    )
      .bind(id)
      .first();
    const row = await escrowRow(context.challenge_id);
    let chain: {
      verified: boolean;
      checkedAt: string | null;
      escrowAddress: string;
      state: unknown;
      submission: SubmissionState | null;
      config: unknown;
    } | null = null;
    if (row) {
      const prior = await env.DB.prepare(
        "SELECT chain_json,updated_at,evidence_hash,student_wallet FROM escrow_submission_locks WHERE submission_id=?",
      )
        .bind(id)
        .first<{
          chain_json: string | null;
          updated_at: string;
          evidence_hash: string;
          student_wallet: string;
        }>();
      chain = {
        verified: false,
        checkedAt: prior?.updated_at || null,
        escrowAddress: row.escrow_address,
        state: row.chain_state_json ? JSON.parse(row.chain_state_json) : null,
        submission: prior?.chain_json ? JSON.parse(prior.chain_json) : null,
        config: JSON.parse(row.config_json),
      };
      try {
        const current = await readAndSyncEscrow(row);
        const hash = (await hashBytes(id)).toString("hex");
        chain = {
          ...chain,
          verified: true,
          checkedAt: new Date().toISOString(),
          state: current.state,
          submission:
            current.submissions.find(
              (s) =>
                s.submissionId === hash &&
                s.student === prior?.student_wallet &&
                s.evidenceHash === prior?.evidence_hash,
            ) || null,
          config: current.config,
        };
        if (chain.submission && context.state === "signing")
          context.state = "submitted";
      } catch {
        /* Preserve the last observed snapshot and clearly label it stale. */
      }
    }
    const operations = await env.DB.prepare(
      "SELECT action,signature,created_at FROM escrow_operations WHERE challenge_id=? AND (submission_id=? OR submission_id IS NULL) ORDER BY created_at",
    )
      .bind(context.challenge_id, id)
      .all();
    const legacy = await env.DB.prepare(
      "SELECT status,payment_tx,amount_usdc,asset,paid_at FROM challenge_payouts WHERE submission_id=?",
    )
      .bind(id)
      .first();
    return Response.json(
      {
        submission: context,
        files: files.results,
        assessment,
        credential,
        chain,
        operations: operations.results,
        legacy,
        viewerWallet: user.walletAddress,
        isOwner: context.student_user_id === user.id,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return jsonError(e);
  }
}

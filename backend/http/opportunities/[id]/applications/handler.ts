import { env } from "@/backend/config/runtime-env";
import {
  assertSameOrigin,
  requireSessionUser,
  jsonError,
} from "@/backend/auth/auth";
import { requireOrganizationRole } from "@/backend/auth/authorization";
import { consumeRateLimit } from "@/backend/auth/rate-limit";
import {
  checkApplication,
  loadOpportunity,
  saveApplication,
} from "@/backend/services/opportunities/applications";
import { applicationReceipt } from "@/backend/services/opportunities/receipt";
import { applicationProfile } from "@/shared/validation/job-application";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request),
      { id } = await params;
    await consumeRateLimit(env.DB, "applications", user.id, 10, 3600);
    const op = await loadOpportunity(env.DB, id);
    if (!op) return Response.json({ error: "Not found" }, { status: 404 });
    const existing = await env.DB.prepare(
      "SELECT * FROM opportunity_applications WHERE opportunity_id=? AND user_id=?",
    )
      .bind(id, user.id)
      .first();
    if (existing) return Response.json({ application: existing, reused: true });
    const body = (await request.json()) as {
      credentialId?: string;
      profile?: unknown;
      consent?: boolean;
    };
    if (!body.consent)
      return Response.json(
        { error: "Hãy xác nhận thông tin sẽ gửi." },
        { status: 400 },
      );
    let profile;
    try {
      profile = applicationProfile(body.profile);
    } catch {
      return Response.json(
        { error: "Thông tin ứng tuyển không hợp lệ." },
        { status: 400 },
      );
    }
    const check = await checkApplication(
      env.DB,
      env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
      op,
      user,
      body.credentialId,
    );
    if (!check.eligibility.valid || !check.credential)
      return Response.json(
        {
          error: "Chưa đủ điều kiện ứng tuyển.",
          eligibility: check.eligibility,
        },
        { status: 403 },
      );
    const receipt = await applicationReceipt(
      op,
      check.credential,
      user,
      check.eligibility,
    );
    const application = await saveApplication(
      env.DB,
      op,
      user,
      check.credential,
      check.eligibility,
      profile,
      receipt,
    );
    return Response.json({ application }, { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireSessionUser(request),
      { id } = await params;
    const op = await loadOpportunity(env.DB, id);
    if (!op) return Response.json({ error: "Not found" }, { status: 404 });
    await requireOrganizationRole(
      user.id,
      op.organization_id,
      ["business_admin", "challenge_manager"],
      "business",
    );
    const rows = await env.DB.prepare(
      "SELECT * FROM opportunity_applications WHERE opportunity_id=? ORDER BY submitted_at DESC",
    )
      .bind(id)
      .all();
    const notes=await env.DB.prepare("SELECT n.application_id,n.id,n.body,n.created_at,u.display_name AS author FROM application_notes n JOIN opportunity_applications a ON a.id=n.application_id JOIN users u ON u.id=n.actor_id WHERE a.opportunity_id=? AND n.organization_id=? ORDER BY n.created_at DESC").bind(id,op.organization_id).all<{application_id:string;id:string;body:string;created_at:string;author:string}>();
    return Response.json(
      { applications: rows.results.map(row=>({...row as Record<string,unknown>,notes:notes.results.filter(n=>n.application_id===(row as {id:string}).id)})) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return jsonError(e);
  }
}
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request),
      { id } = await params;
    const op = await loadOpportunity(env.DB, id);
    if (!op) return Response.json({ error: "Not found" }, { status: 404 });
    await requireOrganizationRole(
      user.id,
      op.organization_id,
      ["business_admin", "challenge_manager"],
      "business",
    );
    const b = (await request.json()) as {
      applicationId: string;
      action: string;
    };
    const row = await env.DB.prepare(
      "SELECT * FROM opportunity_applications WHERE id=? AND opportunity_id=?",
    )
      .bind(b.applicationId, id)
      .first<{
        id: string;
        user_id: string;
        wallet_address: string;
        credential_id: string;
      }>();
    if (!row) return Response.json({ error: "Not found" }, { status: 404 });
    if (b.action === "verify") {
      const check = await checkApplication(
        env.DB,
        env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
        op,
        { id: row.user_id, walletAddress: row.wallet_address },
        row.credential_id,
        true,
      );
      return Response.json({ eligibility: check.eligibility });
    }
    if (!["reviewing", "shortlisted", "rejected"].includes(b.action))
      return Response.json({ error: "Invalid action" }, { status: 400 });
    if(b.action==="shortlisted"){
      const check=await checkApplication(env.DB,env.SOLANA_RPC_URL||"https://api.devnet.solana.com",op,{id:row.user_id,walletAddress:row.wallet_address},row.credential_id,true);
      if(!check.eligibility.valid)return Response.json({error:"Chứng nhận không còn đủ điều kiện. / Credential no longer eligible."},{status:409});
    }
    await env.DB.batch([
      env.DB.prepare("INSERT INTO application_events(id,application_id,organization_id,actor_id,status) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM opportunity_applications WHERE id=? AND status<>?)").bind(crypto.randomUUID(),row.id,op.organization_id,user.id,b.action,row.id,b.action),
      env.DB.prepare("UPDATE opportunity_applications SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status<>?").bind(b.action,row.id,b.action),
    ]);
    return Response.json({ status: b.action });
  } catch (e) {
    return jsonError(e);
  }
}

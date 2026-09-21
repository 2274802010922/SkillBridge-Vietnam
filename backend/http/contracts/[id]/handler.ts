import { env } from "@/backend/config/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../auth/auth";
import { requireOrganizationRole } from "../../../auth/authorization";
import { verifyMilestone, type MilestoneIntent } from "../../../services/payments/milestone-payment";
import { explorerTransaction } from "../../../../solana/server/payments";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request); const user = await requireSessionUser(request); const { id } = await params;
    const body = await request.json() as { action?: "accept" | "submit" | "approve" | "pay"; milestoneId?: string; note?: string; signature?: string };
    const contract = await env.DB.prepare("SELECT * FROM freelance_contracts WHERE id=?").bind(id).first<{ id:string; organization_id:string; created_by_user_id:string; freelancer_user_id:string; status:string }>();
    if (!contract) return Response.json({ error: "Hợp đồng không tồn tại." }, { status: 404 });
    if(body.action!=="accept" && contract.status!=="active")throw new Response("Hợp đồng chưa hoạt động.",{status:409});
    const milestone = body.milestoneId ? await env.DB.prepare("SELECT * FROM contract_milestones WHERE id=? AND contract_id=?").bind(body.milestoneId, id).first<{id:string;amount_usdc:string;amount_atomic:string;status:string;payment_tx:string|null}>() : null;
    if (body.action === "accept") {
      if (user.id !== contract.freelancer_user_id) return Response.json({ error: "Chỉ freelancer được nhận hợp đồng." }, { status: 403 });
      if(contract.status!=="proposed")throw new Response("Hợp đồng đã được nhận.",{status:409});
      await env.DB.prepare("UPDATE freelance_contracts SET status='active', updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='proposed'").bind(id).run();
    } else if (body.action === "submit") {
      if (user.id !== contract.freelancer_user_id || !milestone) return Response.json({ error: "Milestone không hợp lệ." }, { status: 400 });
      if(!["pending","changes_requested"].includes(milestone.status))throw new Response("Milestone không ở trạng thái có thể gửi.",{status:409});
      await env.DB.prepare("UPDATE contract_milestones SET status='submitted', submission_note=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('pending','changes_requested')").bind(body.note?.trim().slice(0, 2000) ?? "", milestone.id).run();
    } else {
      await requireOrganizationRole(user.id, contract.organization_id, ["business_admin", "challenge_manager"], "business");
      if (!milestone) return Response.json({ error: "Cần chọn milestone." }, { status: 400 });
      if(body.action==="approve" && milestone.status!=="submitted")throw new Response("Milestone chưa gửi nghiệm thu.",{status:409});
      if (body.action === "approve") await env.DB.prepare("UPDATE contract_milestones SET status='approved', updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='submitted'").bind(milestone.id).run();
      else if (body.action === "pay") {
        if (!body.signature?.trim()) return Response.json({ error: "Cần chữ ký giao dịch." }, { status: 400 });
        const stored=await env.DB.prepare("SELECT snapshot_json FROM milestone_payment_intents WHERE milestone_id=?").bind(milestone.id).first<{snapshot_json:string}>();
        const wallets=await env.DB.prepare("SELECT user_id,address FROM wallets WHERE user_id IN (?,?)").bind(contract.created_by_user_id,contract.freelancer_user_id).all<{user_id:string;address:string}>();
        const intent:MilestoneIntent=stored ? JSON.parse(stored.snapshot_json) : {
          sender:wallets.results.find(w=>w.user_id===contract.created_by_user_id)?.address||"",
          recipient:wallets.results.find(w=>w.user_id===contract.freelancer_user_id)?.address||"",
          mint:env.SOLANA_USDC_MINT,amountAtomic:milestone.amount_atomic,reference:null,network:"solana:devnet"
        };
        if(!intent.sender||!intent.recipient)throw new Response("Cần đối soát ví thanh toán cũ.",{status:409});
        await verifyMilestone(env.DB,milestone.id,body.signature.trim(),intent,env.SOLANA_RPC_URL);
        return Response.json({ok:true,explorerUrl:explorerTransaction(body.signature.trim())});

      } else return Response.json({ error: "Action không hợp lệ." }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (error) { return jsonError(error); }
}

import { env } from "@/lib/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser } from "../../../lib/auth";
import { requireOrganizationRole } from "../../../lib/authorization";
import { parseUsdcAmount } from "../../../lib/payments";

type MilestoneInput = { title?: string; description?: string; amountUsdc?: string };
export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const rows = await env.DB.prepare(`SELECT fc.*, o.name AS organization_name, u.display_name AS freelancer_name FROM freelance_contracts fc JOIN organizations o ON o.id=fc.organization_id JOIN users u ON u.id=fc.freelancer_user_id WHERE fc.created_by_user_id=? OR fc.freelancer_user_id=? ORDER BY fc.created_at DESC`).bind(user.id, user.id).all();
    const contracts = [];
    for (const row of rows.results as Array<Record<string, unknown>>) {
      const milestones = await env.DB.prepare("SELECT * FROM contract_milestones WHERE contract_id=? ORDER BY position").bind(row.id).all();
      contracts.push({ ...row, milestones: milestones.results });
    }
    return Response.json({ contracts }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const user = await requireSessionUser(request);
    const body = await request.json() as { organizationId?: string; freelancerUserId?: string; title?: string; description?: string; totalAmountUsdc?: string; milestones?: MilestoneInput[] };
    if (!body.organizationId || !body.freelancerUserId || !body.title?.trim() || !body.description?.trim()) return Response.json({ error: "Thiếu tổ chức, freelancer, tên hoặc mô tả hợp đồng." }, { status: 400 });
    await requireOrganizationRole(user.id, body.organizationId, ["business_admin", "challenge_manager"], "business");
    const total = parseUsdcAmount(body.totalAmountUsdc ?? ""); if (!total) return Response.json({ error: "Tổng giá trị USDC không hợp lệ." }, { status: 400 });
    const inputMilestones = (body.milestones ?? []).slice(0, 20).map((item) => ({ title: item.title?.trim() ?? "", description: item.description?.trim() ?? "", amount: parseUsdcAmount(item.amountUsdc ?? "") })).filter((item) => item.title && item.amount);
    if (!inputMilestones.length) return Response.json({ error: "Hợp đồng cần ít nhất một milestone hợp lệ." }, { status: 400 });
    const sum = inputMilestones.reduce((value, item) => value + BigInt(item.amount!.atomic), BigInt(0)); if (sum !== BigInt(total.atomic)) return Response.json({ error: "Tổng milestone phải bằng tổng giá trị hợp đồng." }, { status: 400 });
    const freelancer = await env.DB.prepare("SELECT id FROM users WHERE id=?").bind(body.freelancerUserId).first(); if (!freelancer) return Response.json({ error: "Freelancer không tồn tại." }, { status: 404 });
    const id = crypto.randomUUID();
    const statements = [env.DB.prepare("INSERT INTO freelance_contracts (id,organization_id,created_by_user_id,freelancer_user_id,title,description,total_amount_usdc,total_amount_atomic,status) VALUES (?,?,?,?,?,?,?,?, 'proposed')").bind(id, body.organizationId, user.id, body.freelancerUserId, body.title.trim().slice(0, 160), body.description.trim().slice(0, 4000), total.display, total.atomic)];
    inputMilestones.forEach((item, index) => statements.push(env.DB.prepare("INSERT INTO contract_milestones (id,contract_id,title,description,amount_usdc,amount_atomic,position) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), id, item.title, item.description, item.amount!.display, item.amount!.atomic, index + 1)));
    await env.DB.batch(statements); return Response.json({ contract: { id, status: "proposed", totalAmountUsdc: total.display, milestoneCount: inputMilestones.length } }, { status: 201 });
  } catch (error) { return jsonError(error); }
}

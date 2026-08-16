import { env } from "@/lib/runtime-env";
import { assertSameOrigin, jsonError, listMemberships, requireSessionUser } from "../../../lib/auth";
import { auditStatement } from "../../../lib/audit";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 44) || "organization";
}

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const memberships = await listMemberships(user.id);
    return Response.json({ organizations: memberships.results }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const body = (await request.json()) as { name?: string; kind?: "business" | "university"; description?: string; website?: string };
    const name = body.name?.trim() ?? "";
    if (name.length < 2 || name.length > 120 || !body.kind || !["business", "university"].includes(body.kind)) {
      return Response.json({ error: "Tên hoặc loại tổ chức không hợp lệ." }, { status: 400 });
    }
    const id = crypto.randomUUID();
    const slug = `${slugify(name)}-${id.slice(0, 6)}`;
    const membershipId = crypto.randomUUID();
    const role = body.kind === "business" ? "business_admin" : "university_admin";
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO organizations
          (id, slug, name, kind, description, website, created_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(id, slug, name, body.kind, body.description?.trim() || null, body.website?.trim() || null, user.id),
      env.DB.prepare(`
        INSERT INTO memberships (id, organization_id, user_id, role) VALUES (?, ?, ?, ?)
      `).bind(membershipId, id, user.id, role),
      auditStatement(env.DB, { actorUserId:user.id,organizationId:id,action:"organization.created",targetType:"organization",targetId:id,metadata:{kind:body.kind,name} }),
    ]);
    return Response.json({ organization: { id, slug, name, kind: body.kind, role, verificationStatus: "unverified" } }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

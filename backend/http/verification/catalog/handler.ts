import { env } from "@/backend/config/runtime-env";
export async function GET(request: Request) {
  const headers = {
    "Cache-Control": "public, max-age=60",
    "Access-Control-Allow-Origin": "*",
  };
  try {
    const url = new URL(request.url);
    const ids = (url.searchParams.get("ids") || "").split(",").filter(Boolean);
    const escrows = (url.searchParams.get("escrows") || "")
      .split(",")
      .filter(Boolean);
    if (
      ids.length + escrows.length > 100 ||
      [...ids, ...escrows].some((s) => s.length > 100)
    )
      return Response.json(
        { error: "Too many identifiers" },
        { status: 400, headers },
      );
    if (!ids.length && !escrows.length)
      return Response.json({ challenges: [] }, { headers });
    const filters = [];
    const values: string[] = [];
    if (ids.length) {
      filters.push(`c.id IN (${ids.map(() => "?").join(",")})`);
      values.push(...ids);
    }
    if (escrows.length) {
      filters.push(`e.escrow_address IN (${escrows.map(() => "?").join(",")})`);
      values.push(...escrows);
    }
    const rows = await env.DB.prepare(
      `SELECT c.id,c.title,o.name AS issuer_name,e.escrow_address FROM challenges c LEFT JOIN organizations o ON o.id=c.reviewer_organization_id LEFT JOIN challenge_escrows e ON e.challenge_id=c.id WHERE c.access_type='public' AND c.status IN ('published','closed') AND c.deleted_at IS NULL AND (${filters.join(" OR ")}) LIMIT 100`,
    )
      .bind(...values)
      .all();
    return Response.json({ challenges: rows.results }, { headers });
  } catch {
    return Response.json(
      { error: "Catalog unavailable" },
      { status: 503, headers: { ...headers, "Cache-Control": "no-store" } },
    );
  }
}

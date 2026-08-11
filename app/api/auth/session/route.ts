import { getSessionUser, jsonError, listMemberships } from "../../../../lib/auth";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(request);
    if (!user) return Response.json({ authenticated: false }, { status: 401, headers: { "cache-control": "no-store" } });
    const memberships = await listMemberships(user.id);
    return Response.json(
      { authenticated: true, user, memberships: memberships.results },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}


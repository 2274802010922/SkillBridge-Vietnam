import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser, listMemberships } from "./auth";

export async function requirePageSession(returnTo: string) {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const request = new Request(`${protocol}://${host}${returnTo}`, { headers: incoming });
  const user = await getSessionUser(request);
  if (!user) redirect(`/auth?returnTo=${encodeURIComponent(returnTo)}`);
  const memberships = await listMemberships(user.id);
  return { user, memberships: memberships.results };
}

import { headers } from "next/headers";
import { getSessionUser } from "../../../lib/auth";
import { OrganizationInviteCopy } from "../../components/invite-copy";

export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const request = new Request(`${protocol}://${host}/join/${encodeURIComponent(token)}`, { headers: incoming });
  const user = await getSessionUser(request);
  return <OrganizationInviteCopy token={token} signedIn={Boolean(user)} />;
}

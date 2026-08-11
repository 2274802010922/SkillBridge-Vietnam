import { headers } from "next/headers";
import Link from "next/link";
import { getSessionUser } from "../../../lib/auth";
import { AcceptInvitation } from "../../components/accept-invitation";

export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const request = new Request(`${protocol}://${host}/join/${encodeURIComponent(token)}`, { headers: incoming });
  const user = await getSessionUser(request);
  const returnTo = `/join/${encodeURIComponent(token)}`;
  return <main className="auth-page"><header className="auth-header page-shell"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>SkillBridge</span></Link></header><section className="join-card"><span>ORGANIZATION INVITATION</span><h1>Bạn được mời vào một workspace</h1><p>SkillBridge sẽ kiểm tra role, thời hạn và ví đích ở server trước khi thêm quyền.</p>{user ? <AcceptInvitation token={token} /> : <Link className="button button-primary" href={`/auth?returnTo=${encodeURIComponent(returnTo)}`}>Đăng nhập ví để tiếp tục</Link>}</section></main>;
}

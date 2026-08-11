import { AppHeader, AppSidebar } from "../../components/app-header";
import { AuditWorkspace } from "../../components/audit-workspace";
import { requirePageSession } from "../../../lib/page-session";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const { user } = await requirePageSession("/app/audit");
  return <main className="product-app"><AppHeader walletAddress={user.walletAddress} /><div className="app-layout page-shell"><AppSidebar active="audit" /><AuditWorkspace /></div></main>;
}

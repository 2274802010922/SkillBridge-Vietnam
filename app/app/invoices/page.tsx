import { AppHeader, AppSidebar } from "../../components/app-header";
import { InvoicesWorkspace } from "../../components/invoices-workspace";
import { requirePageSession } from "../../../lib/page-session";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const { user } = await requirePageSession("/app/invoices");
  return <main className="product-app"><AppHeader walletAddress={user.walletAddress} /><div className="app-layout page-shell"><AppSidebar active="invoices" /><InvoicesWorkspace /></div></main>;
}

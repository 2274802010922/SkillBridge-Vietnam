import { AppHeader, AppSidebar } from "../../components/app-header";
import { PaymentsWorkspace } from "../../components/payments-workspace";
import { requirePageSession } from "../../../lib/page-session";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const { user } = await requirePageSession("/app/payments");
  return <main className="product-app"><AppHeader walletAddress={user.walletAddress} /><div className="app-layout page-shell"><AppSidebar active="payments" /><PaymentsWorkspace /></div></main>;
}

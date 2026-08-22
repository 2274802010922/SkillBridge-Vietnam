import { AppHeader, AppSidebar } from "../../components/app-header";
import { CashoutWorkspace } from "../../components/cashout-workspace";
import { requirePageSession } from "../../../lib/page-session";

export const dynamic = "force-dynamic";

export default async function CashoutPage() {
  const { user } = await requirePageSession("/app/cashout");
  return <main className="product-app"><AppHeader walletAddress={user.walletAddress} /><div className="app-layout page-shell"><AppSidebar active="cashout" /><CashoutWorkspace /></div></main>;
}

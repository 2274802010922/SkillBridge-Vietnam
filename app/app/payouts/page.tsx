import { AppHeader, AppSidebar } from "../../components/app-header";
import { PayoutsWorkspace } from "../../components/payouts-workspace";
import { requirePageSession } from "../../../lib/page-session";

export const dynamic = "force-dynamic";

export default async function PayoutsPage() {
  const { user } = await requirePageSession("/app/payouts");
  return <main className="product-app"><AppHeader walletAddress={user.walletAddress} /><div className="app-layout page-shell"><AppSidebar active="payouts" /><PayoutsWorkspace /></div></main>;
}

import { AppHeader, AppSidebar } from "../../components/app-header";
import { TalentWorkspace } from "../../components/talent-workspace";
import { requirePageSession } from "../../../lib/page-session";
export const dynamic = "force-dynamic";
export default async function TalentPage() { const { user } = await requirePageSession("/app/talent"); return <main className="product-app"><AppHeader walletAddress={user.walletAddress} /><div className="app-layout page-shell"><AppSidebar active="talent" /><TalentWorkspace /></div></main>; }

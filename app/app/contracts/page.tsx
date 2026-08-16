import { AppHeader, AppSidebar } from "../../components/app-header";
import { ContractsWorkspace } from "../../components/contracts-workspace";
import { requirePageSession } from "../../../lib/page-session";
export const dynamic="force-dynamic";
export default async function ContractsPage(){const {user,memberships}=await requirePageSession("/app/contracts");return <main className="product-app"><AppHeader walletAddress={user.walletAddress}/><div className="app-layout page-shell"><AppSidebar active="contracts"/><ContractsWorkspace memberships={memberships as never[]}/></div></main>}

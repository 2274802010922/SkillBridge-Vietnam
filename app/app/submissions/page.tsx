import { AppHeader, AppSidebar } from "../../components/app-header";
import { SubmissionsWorkspace } from "../../components/submissions-workspace";
import { requirePageSession } from "../../../lib/page-session";
export const dynamic="force-dynamic";
export default async function SubmissionsPage(){const {user}=await requirePageSession("/app/submissions");return <main className="product-app"><AppHeader walletAddress={user.walletAddress}/><div className="app-layout page-shell"><AppSidebar active="submissions"/><SubmissionsWorkspace/></div></main>;}

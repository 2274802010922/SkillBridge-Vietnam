import { env } from "@/lib/runtime-env";
import { AppHeader, AppSidebar } from "../../components/app-header";
import { ChallengesWorkspace } from "../../components/challenges-workspace";
import { requirePageSession } from "../../../lib/page-session";

export const dynamic = "force-dynamic";
export default async function ChallengesPage() { const { user, memberships } = await requirePageSession("/app/challenges"); const universities = await env.DB.prepare("SELECT id, name, verification_status FROM organizations WHERE kind = 'university' ORDER BY verification_status = 'verified' DESC, name").all(); return <main className="product-app"><AppHeader walletAddress={user.walletAddress} /><div className="app-layout page-shell"><AppSidebar active="challenges" /><ChallengesWorkspace memberships={memberships as never[]} universities={universities.results as never[]} /></div></main>; }


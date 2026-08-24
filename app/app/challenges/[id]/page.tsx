import { AppHeader, AppSidebar } from "../../../components/app-header";
import { ChallengeDetailWorkspace } from "../../../components/challenge-detail-workspace";
import { requirePageSession } from "../../../../lib/page-session";

export const dynamic = "force-dynamic";

export default async function ChallengeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requirePageSession("/app/challenges");
  const { id } = await params;
  return <main className="product-app"><AppHeader walletAddress={user.walletAddress} /><div className="app-layout page-shell"><AppSidebar active="challenges" /><ChallengeDetailWorkspace challengeId={id} /></div></main>;
}

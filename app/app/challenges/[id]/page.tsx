import { ChallengeDetailWorkspace } from "../../../../frontend/features/challenge-detail/challenge-detail-workspace";

export const dynamic = "force-dynamic";

export default async function ChallengeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ChallengeDetailWorkspace challengeId={id} />;
}

import { requirePageSession } from "@/backend/auth/page-session";
import { OpportunityDetail } from "@/frontend/features/opportunities/opportunity-detail";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePageSession("/app/opportunities/" + id);
  return <OpportunityDetail id={id} />;
}

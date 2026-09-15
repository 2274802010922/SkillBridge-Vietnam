import { requirePageSession } from "@/backend/auth/page-session";
import { SubmissionProgress } from "@/frontend/features/submissions/submission-progress";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePageSession("/app/submissions/" + id + "/progress");
  return <SubmissionProgress id={id} />;
}

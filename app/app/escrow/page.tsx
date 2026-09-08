import { EscrowWorkspace } from "../../../frontend/features/escrow/escrow-workspace";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string }>;
}) {
  const { challenge } = await searchParams;
  return <EscrowWorkspace initialId={challenge || ""} />;
}

import { AppHeader, AppSidebar } from "../../components/app-header";
import { EscrowWorkspace } from "../../components/escrow-workspace";
import { requirePageSession } from "@/lib/page-session";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ challenge?: string }>;
}) {
  const { user } = await requirePageSession("/app/escrow");
  const { challenge } = await searchParams;
  return (
    <main className="product-app">
      <AppHeader walletAddress={user.walletAddress} />
      <div className="app-layout page-shell">
        <AppSidebar active="escrow" />
        <EscrowWorkspace initialId={challenge || ""} />
      </div>
    </main>
  );
}

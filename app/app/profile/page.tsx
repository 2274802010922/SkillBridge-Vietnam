import { AppHeader, AppSidebar } from "../../components/app-header";
import { ProfileWorkspace } from "../../components/profile-workspace";
import { requirePageSession } from "@/lib/page-session";
export const dynamic = "force-dynamic";
export default async function ProfilePage() {
  const { user } = await requirePageSession("/app/profile");
  return (
    <main className="product-app">
      <AppHeader walletAddress={user.walletAddress} />
      <div className="app-layout page-shell">
        <AppSidebar active="profile" />
        <ProfileWorkspace />
      </div>
    </main>
  );
}

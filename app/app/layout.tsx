import type { ReactNode } from "react";
import { requirePageSession } from "../../backend/auth/page-session";
import { AppHeader, AppSidebar } from "../../frontend/components/layout/app-header";

export const dynamic = "force-dynamic";

export default async function ProductWorkspaceLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const { user } = await requirePageSession("/app");

  return (
    <main className="product-app">
      <AppHeader walletAddress={user.walletAddress} />
      <div className="app-layout page-shell">
        <AppSidebar />
        {children}
      </div>
    </main>
  );
}

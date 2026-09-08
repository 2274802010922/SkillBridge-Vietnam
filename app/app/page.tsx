import { requirePageSession } from "../../backend/auth/page-session";
import { AppDashboard } from "../../frontend/features/dashboard/app-dashboard";

export const dynamic = "force-dynamic";

export default async function ProductAppPage() {
  const { user, memberships } = await requirePageSession("/app");
  return <AppDashboard initialUser={user} initialMemberships={memberships as never[]} />;
}

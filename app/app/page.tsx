import { requirePageSession } from "../../lib/page-session";
import { AppDashboard } from "../components/app-dashboard";

export const dynamic = "force-dynamic";

export default async function ProductAppPage() {
  const { user, memberships } = await requirePageSession("/app");
  return <AppDashboard initialUser={user} initialMemberships={memberships as never[]} />;
}

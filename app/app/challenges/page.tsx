import { env } from "@/backend/config/runtime-env";
import { ChallengesWorkspace } from "../../../frontend/features/challenges/challenges-workspace";
import { requirePageSession } from "../../../backend/auth/page-session";

export const dynamic = "force-dynamic";
export default async function ChallengesPage() { const { memberships } = await requirePageSession("/app/challenges"); const reviewerOrganizations = await env.DB.prepare("SELECT id, name, kind, verification_status FROM organizations WHERE kind IN ('business', 'university') ORDER BY verification_status = 'verified' DESC, name").all(); return <ChallengesWorkspace memberships={memberships as never[]} reviewerOrganizations={reviewerOrganizations.results as never[]} />; }

import {env} from "@/backend/config/runtime-env";
import {OpportunitiesWorkspace} from "@/frontend/features/opportunities/opportunities-workspace";
import {requirePageSession} from "@/backend/auth/page-session";
export const dynamic="force-dynamic";
export default async function OpportunitiesPage(){
 const {memberships}=await requirePageSession("/app/opportunities");
 const universities=await env.DB.prepare("SELECT o.id,o.name FROM organizations o JOIN credential_issuers ci ON ci.organization_id=o.id AND ci.status='active' WHERE o.kind IN ('university','business') ORDER BY o.name").all();
 return <OpportunitiesWorkspace memberships={memberships as never[]} universities={universities.results as never[]}/>;
}

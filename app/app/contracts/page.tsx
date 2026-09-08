import { ContractsWorkspace } from "../../../frontend/features/contracts/contracts-workspace";
import { requirePageSession } from "../../../backend/auth/page-session";
export const dynamic="force-dynamic";
export default async function ContractsPage(){const {memberships}=await requirePageSession("/app/contracts");return <ContractsWorkspace memberships={memberships as never[]}/>}

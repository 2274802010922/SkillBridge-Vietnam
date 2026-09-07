import { ContractsWorkspace } from "../../components/contracts-workspace";
import { requirePageSession } from "../../../lib/page-session";
export const dynamic="force-dynamic";
export default async function ContractsPage(){const {memberships}=await requirePageSession("/app/contracts");return <ContractsWorkspace memberships={memberships as never[]}/>}

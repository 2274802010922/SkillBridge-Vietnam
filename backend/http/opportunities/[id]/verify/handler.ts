import {env} from "@/backend/config/runtime-env";
import {assertSameOrigin,requireSessionUser,jsonError} from "@/backend/auth/auth";
import {consumeRateLimit} from "@/backend/auth/rate-limit";
import {checkApplication,loadOpportunity} from "@/backend/services/opportunities/applications";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{assertSameOrigin(request);const user=await requireSessionUser(request),{id}=await params;await consumeRateLimit(env.DB,"opportunity_verify",user.id,30,3600);
 const op=await loadOpportunity(env.DB,id);if(!op)return Response.json({error:"Not found"},{status:404});const b=await request.json() as {credentialId?:string};
 const check=await checkApplication(env.DB,env.SOLANA_RPC_URL||"https://api.devnet.solana.com",op,user,b.credentialId);
 return Response.json({eligibility:check.eligibility,credentialId:check.credential?.id,access:{decision:check.eligibility.valid?"granted":"denied",reason:check.eligibility.reason,receiptAddress:null,recordTx:null}},{status:check.eligibility.valid?200:403});
 }catch(e){return jsonError(e);}
}

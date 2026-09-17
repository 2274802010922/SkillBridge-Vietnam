import { env } from "@/backend/config/runtime-env";
import { assertSameOrigin, requireSessionUser, jsonError } from "@/backend/auth/auth";
import { requireCredentialIssuer } from "@/backend/auth/authorization";
import { consumeRateLimit } from "@/backend/auth/rate-limit";
import { issuanceOperation, publicIssuance, recoverIssuance } from "@/backend/services/credentials/issuance";
import { issuanceTransport } from "@/solana/server/credential-issuance";
type Context={params:Promise<{id:string}>};
async function authorize(request:Request,id:string,write=false){
  const user=await requireSessionUser(request);
  const row=await env.DB.prepare("SELECT organization_id,student_user_id FROM credential_issuance_operations WHERE assessment_id=?").bind(id).first<{organization_id:string;student_user_id:string}>();
  if(!row)throw new Response("Not found",{status:404});
  if(write||row.student_user_id!==user.id)await requireCredentialIssuer(user.id,row.organization_id);
  return user;
}
export async function GET(request:Request,context:Context){
  try{const {id}=await context.params;await authorize(request,id);return Response.json({operation:publicIssuance((await issuanceOperation(env.DB,id))!)},{headers:{"cache-control":"private, no-store"}});}catch(e){return jsonError(e);}
}
export async function POST(request:Request,context:Context){
  try{
    assertSameOrigin(request);const {id}=await context.params,user=await authorize(request,id,true);
    await consumeRateLimit(env.DB,"credential_recheck",user.id,20,60);
    const result=await recoverIssuance(env.DB,id,user.id,issuanceTransport(env));
    return Response.json(result,{status:result.credential?200:202,headers:{"cache-control":"private, no-store"}});
  }catch(e){return jsonError(e);}
}

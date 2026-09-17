import { env } from "@/backend/config/runtime-env";
import { assertSameOrigin, requireSessionUser, jsonError } from "@/backend/auth/auth";
import { requireOrganizationRole } from "@/backend/auth/authorization";
import { loadOpportunity, checkApplication } from "@/backend/services/opportunities/applications";
import { readPack } from "@/backend/services/portfolios/packs";
import { checkPortfolioSources } from "@/backend/services/portfolios/verification";
import { featureAccess } from "@/backend/services/portfolios/features";
import { consumeRateLimit } from "@/backend/auth/rate-limit";
import { sameRubric, type PortfolioSource } from "@/shared/validation/portfolio";
type Context={params:Promise<{id:string}>};
async function authorize(request:Request,id:string){
  const user=await requireSessionUser(request),op=await loadOpportunity(env.DB,id);if(!op)throw new Response("Not found",{status:404});
  await requireOrganizationRole(user.id,op.organization_id,["business_admin","challenge_manager"],"business");return {user,op};
}
export async function GET(request:Request,context:Context){
  try{
    const {id}=await context.params,{user,op}=await authorize(request,id);
    const ids=[...new Set(new URL(request.url).searchParams.getAll("applicationId"))];
    if(ids.length<1||ids.length>3)throw new Response("Select 1–3 applications",{status:400});
    const trial=await featureAccess(env.DB,"org:"+op.organization_id,"business");
    if(!trial.active)throw new Response("Thử nghiệm đã hết hạn; hồ sơ ứng tuyển cơ bản vẫn dùng được. / Trial ended; basic applications remain available.",{status:403});
    await consumeRateLimit(env.DB,"comparison",user.id,30,60);
    const candidates=await Promise.all(ids.map(async applicationId=>{
      const row=await env.DB.prepare("SELECT id,user_id,wallet_address,credential_id,profile_json,status FROM opportunity_applications WHERE id=? AND opportunity_id=?").bind(applicationId,id).first<{id:string;user_id:string;wallet_address:string;credential_id:string;profile_json:string;status:string}>();
      if(!row)throw new Response("Application outside this opportunity",{status:404});
      let eligibility=null;try{eligibility=(await checkApplication(env.DB,env.SOLANA_RPC_URL||"https://api.devnet.solana.com",op,{id:row.user_id,walletAddress:row.wallet_address},row.credential_id,true)).eligibility;}catch{/* unavailable is not a rejection */}
      const grants=await env.DB.prepare("SELECT pack_id FROM portfolio_grants WHERE application_id=? AND organization_id=? AND revoked_at IS NULL AND expires_at>? ORDER BY created_at DESC LIMIT 3").bind(applicationId,op.organization_id,new Date().toISOString()).all<{pack_id:string}>();
      const packs=await Promise.all(grants.results.map(async g=>{
        try{const p=await readPack(env.DB,g.pack_id,user.id,{applicationId,organizationId:op.organization_id});return {...p,sources:await checkPortfolioSources(env.DB,env.SOLANA_RPC_URL||"https://api.devnet.solana.com",p.sources)};}catch{return {id:g.pack_id,unavailable:true};}
      }));
      const notes=await env.DB.prepare("SELECT n.id,n.body,n.created_at,u.display_name AS author FROM application_notes n JOIN users u ON u.id=n.actor_id WHERE n.application_id=? AND n.organization_id=? ORDER BY n.created_at DESC LIMIT 30").bind(applicationId,op.organization_id).all();
      return {id:row.id,profile:JSON.parse(row.profile_json),status:row.status,eligibility,packs,notes:notes.results};
    }));
    const rubricSources=candidates.map(c=>c.packs.flatMap(p=>"sources" in p?p.sources:[]).filter(s=>s.kind==="assessment"));
    const comparable=rubricSources.every(s=>s.length===1)&&sameRubric(rubricSources.flat() as PortfolioSource[]);
    return Response.json({candidates,comparable,trial},{headers:{"cache-control":"private, no-store"}});
  }catch(e){return jsonError(e);}
}
export async function POST(request:Request,context:Context){
  try{
    assertSameOrigin(request);const {id}=await context.params,{user,op}=await authorize(request,id);
    const text=await request.text();if(text.length>3000)throw new Response("Too large",{status:413});const b=JSON.parse(text);
    if(typeof b.applicationId!=="string"||typeof b.note!=="string"||b.note.trim().length<3||b.note.length>1000)throw new Response("Invalid note",{status:400});
    if(!(await featureAccess(env.DB,"org:"+op.organization_id,"business")).active)throw new Response("Trial expired",{status:403});
    const row=await env.DB.prepare("SELECT id FROM opportunity_applications WHERE id=? AND opportunity_id=?").bind(b.applicationId,id).first();if(!row)throw new Response("Not found",{status:404});
    await consumeRateLimit(env.DB,"comparison_note",user.id,30,3600);
    await env.DB.prepare("INSERT INTO application_notes(id,application_id,organization_id,actor_id,body) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),b.applicationId,op.organization_id,user.id,b.note.trim()).run();
    return Response.json({ok:true});
  }catch(e){return jsonError(e);}
}

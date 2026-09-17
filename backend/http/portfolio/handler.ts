import { env } from "@/backend/config/runtime-env";
import { assertSameOrigin, getSessionUser, requireSessionUser, jsonError } from "@/backend/auth/auth";
import { consumeRateLimit, requestClientIdentity } from "@/backend/auth/rate-limit";
import { requireChallengeReviewer } from "@/backend/auth/authorization";
import { ownedPack, portfolioSources, readPack, savePack, grantPack, resolvePortfolioSources } from "@/backend/services/portfolios/packs";
import { checkPortfolioSources } from "@/backend/services/portfolios/verification";
const headers={"cache-control":"private, no-store"};
const rpc=()=>env.SOLANA_RPC_URL||"https://api.devnet.solana.com";
async function body(request:Request){const text=await request.text();if(text.length>20000)throw new Response("Payload too large",{status:413});return JSON.parse(text);}
export async function GET(request:Request){
  try{
    const user=await requireSessionUser(request);
    const packs=await env.DB.prepare("SELECT id,title,current_version,published_version,updated_at FROM portfolio_packs WHERE owner_id=? ORDER BY updated_at DESC").bind(user.id).all();
    const applications=await env.DB.prepare("SELECT a.id,o.title FROM opportunity_applications a JOIN opportunities o ON o.id=a.opportunity_id WHERE a.user_id=? ORDER BY a.submitted_at DESC LIMIT 50").bind(user.id).all();
    const opportunities=await env.DB.prepare("SELECT o.id,o.title,o.description,d.requirements FROM opportunities o LEFT JOIN opportunity_details d ON d.opportunity_id=o.id WHERE o.status='active' ORDER BY o.created_at DESC LIMIT 50").all();
    return Response.json({packs:packs.results,sources:await portfolioSources(env.DB,user.id),applications:applications.results,opportunities:opportunities.results},{headers});
  }catch(e){return jsonError(e);}
}
export async function POST(request:Request){
  try{assertSameOrigin(request);const user=await requireSessionUser(request);await consumeRateLimit(env.DB,"pack_create",user.id,15,3600);return Response.json(await savePack(env.DB,user.id,await body(request)),{status:201,headers});}catch(e){return jsonError(e);}
}
type Context={params:Promise<{id:string}>};
export async function getOne(request:Request,context:Context){
  try{
    const {id}=await context.params,user=await getSessionUser(request);
    await consumeRateLimit(env.DB,"portfolio_view",user?.id??requestClientIdentity(request),60,60);
    const pack=await readPack(env.DB,id,new URL(request.url).searchParams.get("public")==="1"?null:user?.id??null);
    return Response.json({...pack,sources:await checkPortfolioSources(env.DB,rpc(),pack.sources)},{headers});
  }catch(e){return jsonError(e);}
}
export async function updateOne(request:Request,context:Context){
  try{assertSameOrigin(request);const user=await requireSessionUser(request),{id}=await context.params;await consumeRateLimit(env.DB,"pack_edit",user.id,40,3600);const b=await body(request);return Response.json(await savePack(env.DB,user.id,b,id,b.version),{headers});}catch(e){return jsonError(e);}
}
export async function share(request:Request,context:Context){
  try{
    assertSameOrigin(request);const user=await requireSessionUser(request),{id}=await context.params;
    const b=await body(request),p=await ownedPack(env.DB,id,user.id);
    if(b.action==="revoke"){
      if(b.grantId)await env.DB.prepare("UPDATE portfolio_grants SET revoked_at=CURRENT_TIMESTAMP WHERE id=? AND pack_id=? AND owner_id=?").bind(b.grantId,id,user.id).run();
      else await env.DB.batch([env.DB.prepare("UPDATE portfolio_packs SET published_version=NULL WHERE id=?").bind(id),env.DB.prepare("UPDATE portfolio_grants SET revoked_at=CURRENT_TIMESTAMP WHERE pack_id=? AND owner_id=? AND revoked_at IS NULL").bind(id,user.id)]);
      return Response.json({ok:true},{headers});
    }
    if(b.consent!==true)throw new Response("Consent required",{status:400});
    if(b.version!==p.current_version)throw new Response("Version changed",{status:409});
    const pack=await readPack(env.DB,id,user.id,{version:p.current_version});if(pack.staleSources)throw new Response("Nguồn đã thay đổi. / Save updated sources first.",{status:409});
    await resolvePortfolioSources(env.DB,user.id,pack.sources,true);
    const checked=await checkPortfolioSources(env.DB,rpc(),pack.sources);
    if(checked.some(s=>s.verification&&s.verification.state!=="active"))throw new Response("Chưa xác minh được nguồn. / Evidence not currently verified.",{status:409});
    if(b.action==="publish"){
      const changed=await env.DB.prepare("UPDATE portfolio_packs SET published_version=? WHERE id=? AND owner_id=? AND current_version=?").bind(p.current_version,id,user.id,p.current_version).run();
      if(!changed.meta.changes)throw new Response("Version changed",{status:409});
    }
    else if(b.action==="application"&&typeof b.applicationId==="string")return Response.json(await grantPack(env.DB,user.id,id,b.applicationId,p.current_version),{headers});
    else throw new Response("Invalid action",{status:400});
    return Response.json({ok:true,version:p.current_version},{headers});
  }catch(e){return jsonError(e);}
}
export async function sourcePermission(request:Request,context:Context){
  try{
    assertSameOrigin(request);const user=await requireSessionUser(request),{id}=await context.params;
    const row=await env.DB.prepare("SELECT c.reviewer_organization_id FROM assessments a JOIN submissions s ON s.id=a.submission_id JOIN participations p ON p.id=s.participation_id JOIN challenges c ON c.id=p.challenge_id WHERE a.id=? AND a.status='approved'").bind(id).first<{reviewer_organization_id:string}>();
    if(!row)throw new Response("Not found",{status:404});await requireChallengeReviewer(user.id,row.reviewer_organization_id);
    if(request.method==="GET")return Response.json({allowed:(await env.DB.prepare("SELECT allowed FROM evidence_publication_permissions WHERE assessment_id=?").bind(id).first<{allowed:number}>())?.allowed===1},{headers});
    const b=await body(request);if(typeof b.allowed!=="boolean")throw new Response("Invalid permission",{status:400});
    await env.DB.prepare("INSERT INTO evidence_publication_permissions(assessment_id,allowed,actor_id) VALUES(?,?,?) ON CONFLICT(assessment_id) DO UPDATE SET allowed=excluded.allowed,actor_id=excluded.actor_id,updated_at=CURRENT_TIMESTAMP").bind(id,b.allowed?1:0,user.id).run();
    return Response.json({allowed:b.allowed},{headers});
  }catch(e){return jsonError(e);}
}

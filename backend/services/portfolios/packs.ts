import { packInput, type SourceRef, type PortfolioSource, type PackContent } from "../../../shared/validation/portfolio.ts";
import { personalUsage } from "./features.ts";
export async function fingerprint(value:unknown){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(value)))),b=>b.toString(16).padStart(2,"0")).join("");}
const deny=(status=403)=>new Response("Không có quyền hoặc nguồn không còn hợp lệ. / Access or evidence unavailable.",{status});
export async function portfolioSources(db:D1Database,owner:string,selected?:Array<{kind:SourceRef['kind'];id:string}>):Promise<PortfolioSource[]>{
  const credentialIds=selected?.filter(s=>s.kind==="credential").map(s=>s.id)??[];
  const assessmentIds=selected?.filter(s=>s.kind==="assessment").map(s=>s.id)??[];
  const filter=(column:string,ids:string[])=>selected?` AND ${column} IN (${ids.map(()=>"?").join(",")||"NULL"})`:"";
  const credentials=await db.prepare(`SELECT sc.id,sc.challenge_id,sc.attestation_address,sc.schema_address,sc.score,sc.evidence_hash,sc.status,sc.expires_at,c.title,o.name AS issuer
    FROM skill_credentials sc JOIN challenges c ON c.id=sc.challenge_id JOIN organizations o ON o.id=sc.issuer_organization_id WHERE sc.student_user_id=? ${filter("sc.id",credentialIds)} ORDER BY sc.issued_at DESC LIMIT 50`).bind(owner,...credentialIds).all<Record<string,string>>();
  const reviews=await db.prepare(`SELECT a.id,a.status,a.final_result_hash,a.assessment_json,c.id AS challenge_id,c.title,c.rubric_json,
    COALESCE(ep.allowed,0) AS allowed,(SELECT review_json FROM reviews WHERE assessment_id=a.id AND decision='approved' ORDER BY created_at DESC LIMIT 1) AS review_json
    FROM assessments a JOIN submissions s ON s.id=a.submission_id JOIN participations p ON p.id=s.participation_id JOIN challenges c ON c.id=p.challenge_id
    LEFT JOIN evidence_publication_permissions ep ON ep.assessment_id=a.id WHERE p.student_user_id=? AND a.status='approved' ${filter("a.id",assessmentIds)} ORDER BY a.created_at DESC LIMIT 50`).bind(owner,...assessmentIds).all<Record<string,unknown>>();
  const result:PortfolioSource[]=[];
  for(const c of credentials.results){
    const status=Date.parse(c.expires_at)<=Date.now()?"expired":c.status;
    const content=JSON.stringify({title:c.title,issuer:c.issuer,score:c.score,evidenceHash:c.evidence_hash,attestation:c.attestation_address,schema:c.schema_address});
    result.push({kind:"credential",id:c.id,title:c.title,content,hash:await fingerprint({content,status}),shareable:status==="active",status,challengeId:c.challenge_id,rubricHash:null,rubric:[],attestation:c.attestation_address});
  }
  for(const a of reviews.results){
    const envelope=JSON.parse(String(a.assessment_json));
    const review=a.review_json?JSON.parse(String(a.review_json)):null;
    const draft=review?.finalDraft??envelope.draft;
    if(!draft||!a.final_result_hash)continue;
    const rubric=(draft.rubric??[]).map((r:{id:string;label:string;score:number;maxScore:number})=>({id:r.id,label:r.label,score:r.score,maxScore:r.maxScore}));
    // Deliberately excludes raw files, private quotes and reviewer internal notes.
    const content=JSON.stringify({title:a.title,summary:draft.summary,totalScore:draft.totalScore,rubric});
    result.push({kind:"assessment",id:String(a.id),title:String(a.title),content,hash:await fingerprint({content,result:a.final_result_hash,allowed:a.allowed}),shareable:a.allowed===1,status:"human_approved",challengeId:String(a.challenge_id),rubricHash:await fingerprint({schema:draft.schemaVersion,rubric:rubric.map((r:{id:string;label:string;maxScore:number})=>({id:r.id,label:r.label,maxScore:r.maxScore}))}),rubric});
  }
  return result;
}
export async function resolvePortfolioSources(db:D1Database,owner:string,refs:SourceRef[],sharing=false){
  const all=await portfolioSources(db,owner,refs);
  return refs.map(ref=>{
    const source=all.find(s=>s.kind===ref.kind&&s.id===ref.id);
    if(!source||source.hash!==ref.hash||(sharing&&!source.shareable))throw deny(409);
    return source;
  });
}
type PackRow={id:string;owner_id:string;title:string;current_version:number;published_version:number|null};
export async function ownedPack(db:D1Database,id:string,owner:string){const p=await db.prepare("SELECT * FROM portfolio_packs WHERE id=? AND owner_id=?").bind(id,owner).first<PackRow>();if(!p)throw deny(404);return p;}
export async function savePack(db:D1Database,owner:string,raw:unknown,id?:string,expectedVersion?:number){
  if(id)await ownedPack(db,id,owner);
  const {content,sourceIds}=packInput(raw),available=await portfolioSources(db,owner,sourceIds);
  const refs:SourceRef[]=sourceIds.map(ref=>{const s=available.find(x=>x.kind===ref.kind&&x.id===ref.id);if(!s)throw deny();return {kind:s.kind,id:s.id,hash:s.hash};});
  const hash=await fingerprint({content,refs});
  const key=id??crypto.randomUUID(),version=id?Number(expectedVersion)+1:1;
  const limit=id?0:(await personalUsage(db,owner)).packLimit;
  if(id){const p=await ownedPack(db,id,owner);if(!Number.isInteger(expectedVersion)||p.current_version!==expectedVersion)throw deny(409);}
  const contentJson=JSON.stringify(content),sourcesJson=JSON.stringify(refs);
  try{
    const writes=await db.batch([
      ...(id?[]:[db.prepare("INSERT INTO portfolio_packs(id,owner_id,title) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM portfolio_packs WHERE owner_id=?)<?").bind(key,owner,content.title,owner,limit)]),
      db.prepare(`INSERT INTO portfolio_pack_versions(pack_id,version,content_json,sources_json,content_hash) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM portfolio_packs WHERE id=? AND owner_id=? AND current_version=?)`).bind(key,version,contentJson,sourcesJson,hash,key,owner,id?expectedVersion:1),
      db.prepare("UPDATE portfolio_packs SET title=?,current_version=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=? AND current_version=?").bind(content.title,version,key,owner,id?expectedVersion:1),
    ]);
    if(!writes[id?0:1].meta.changes)throw new Response("Hết hạn mức hoặc phiên bản đã đổi. / Limit reached or version changed.",{status:409});
  }catch(e){if(String(e).includes("UNIQUE"))throw deny(409);throw e;}
  return {id:key,version};
}
export async function readPack(db:D1Database,id:string,viewer:string|null,options?:{version?:number;applicationId?:string;organizationId?:string}){
  const p=await db.prepare("SELECT * FROM portfolio_packs WHERE id=?").bind(id).first<PackRow>();if(!p)throw deny(404);
  const owner=p.owner_id===viewer;let version=owner?(options?.version??p.current_version):p.published_version;
  if(!owner&&options?.applicationId&&options.organizationId){
    const membership=await db.prepare("SELECT 1 AS ok FROM memberships WHERE user_id=? AND organization_id=? AND status='active' AND role IN ('business_admin','challenge_manager')").bind(viewer,options.organizationId).first();
    if(!membership)throw deny();
    const grant=await db.prepare("SELECT version FROM portfolio_grants WHERE pack_id=? AND application_id=? AND organization_id=? AND revoked_at IS NULL AND expires_at>? ORDER BY created_at DESC LIMIT 1").bind(id,options.applicationId,options.organizationId,new Date().toISOString()).first<{version:number}>();
    if(!grant)throw deny(404);version=grant.version;
  }
  if(!version)throw deny(404);
  const v=await db.prepare("SELECT content_json,sources_json,content_hash,created_at FROM portfolio_pack_versions WHERE pack_id=? AND version=?").bind(id,version).first<{content_json:string;sources_json:string;content_hash:string;created_at:string}>();if(!v)throw deny(404);
  const refs=JSON.parse(v.sources_json) as SourceRef[];
  const available=owner?await portfolioSources(db,p.owner_id,refs):[];
  const sources=owner?refs.flatMap(ref=>available.filter(s=>s.kind===ref.kind&&s.id===ref.id&&s.hash===ref.hash)):await resolvePortfolioSources(db,p.owner_id,refs,true);
  const content=JSON.parse(v.content_json) as PackContent;
  return {id,owner,version,publishedVersion:p.published_version,content:owner?content:{...content,target:""},sources,staleSources:sources.length!==refs.length,hash:v.content_hash,createdAt:v.created_at};
}
export async function grantPack(db:D1Database,owner:string,id:string,applicationId:string,expectedVersion?:number){
  const p=await ownedPack(db,id,owner);
  if(expectedVersion!==undefined&&expectedVersion!==p.current_version)throw deny(409);
  const pack=await readPack(db,id,owner,{version:p.current_version});
  if(pack.staleSources)throw deny(409);
  await resolvePortfolioSources(db,owner,pack.sources,true);
  const application=await db.prepare("SELECT a.user_id,o.organization_id FROM opportunity_applications a JOIN opportunities o ON o.id=a.opportunity_id WHERE a.id=? AND a.user_id=?").bind(applicationId,owner).first<{organization_id:string}>();
  if(!application)throw deny();
  const grantId=crypto.randomUUID(),expires=new Date(Date.now()+30*86400000).toISOString();
  await db.batch([
    db.prepare("UPDATE portfolio_grants SET revoked_at=CURRENT_TIMESTAMP WHERE pack_id=? AND application_id=? AND owner_id=? AND revoked_at IS NULL").bind(id,applicationId,owner),
    db.prepare("INSERT INTO portfolio_grants(id,pack_id,version,application_id,organization_id,owner_id,expires_at) VALUES(?,?,?,?,?,?,?)").bind(grantId,id,p.current_version,applicationId,application.organization_id,owner,expires),
  ]);
  return {id:grantId,version:p.current_version,expiresAt:expires};
}

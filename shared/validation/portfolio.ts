export type SourceRef = {kind:"credential"|"assessment";id:string;hash:string};
export type PackContent = {title:string;purpose:"employment"|"freelance";target:string;introduction:string};
export type PortfolioSource = {kind:SourceRef["kind"];id:string;hash:string;title:string;content:string;shareable:boolean;status:string;challengeId:string;rubricHash:string|null;rubric:Array<{id:string;label:string;score:number;maxScore:number}>;attestation?:string};
export function packInput(value:unknown): {content:PackContent;sourceIds:Array<{kind:SourceRef["kind"];id:string}>} {
  if(!value||typeof value!=="object")throw new Error("PACK_INVALID");
  const v=value as Record<string,unknown>;
  const text=(key:string,max:number,min=0)=>{const s=v[key];if(typeof s!=="string"||s.trim().length<min||s.length>max)throw new Error("PACK_INVALID:"+key);return s.trim();};
  if(v.purpose!=="employment"&&v.purpose!=="freelance")throw new Error("PACK_INVALID:purpose");
  if(!Array.isArray(v.sources)||v.sources.length>5)throw new Error("PACK_INVALID:sources");
  const seen=new Set<string>();
  const sourceIds=v.sources.map((s:unknown)=>{
    const r=s as Record<string,unknown>;
    if(!r||!(r.kind==="credential"||r.kind==="assessment")||typeof r.id!=="string"||r.id.length>100)throw new Error("PACK_INVALID:source");
    const k=r.kind+":"+r.id;if(seen.has(k))throw new Error("PACK_INVALID:duplicate");seen.add(k);
    return {kind:r.kind as SourceRef["kind"],id:r.id};
  });
  return {content:{title:text("title",120,2),purpose:v.purpose,target:text("target",4000),introduction:text("introduction",4000)},sourceIds};
}
export function sameRubric(sources:PortfolioSource[]){
  return sources.length>1&&sources.every(s=>s.rubricHash&&s.rubricHash===sources[0].rubricHash&&s.challengeId===sources[0].challengeId);
}

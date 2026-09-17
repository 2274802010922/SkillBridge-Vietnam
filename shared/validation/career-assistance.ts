export type CareerDraft={claims:Array<{text:string;sourceId:string;quote:string}>;gaps:string[];questions:string[]};
export const CAREER_SCHEMA={type:"object",additionalProperties:false,required:["claims","gaps","questions"],properties:{
  claims:{type:"array",maxItems:5,items:{type:"object",additionalProperties:false,required:["text","sourceId","quote"],properties:{text:{type:"string"},sourceId:{type:"string"},quote:{type:"string"}}}},
  gaps:{type:"array",maxItems:5,items:{type:"string"}},questions:{type:"array",maxItems:5,items:{type:"string"}},
}};
export function validateCareerDraft(raw:unknown,sources:Array<{id:string;content:string}>):CareerDraft{
  if(!raw||typeof raw!=="object")throw new Error("CAREER_INVALID");
  const v=raw as Record<string,unknown>;
  const strings=(key:string)=>{const a=v[key];if(!Array.isArray(a)||a.length>5||a.some(s=>typeof s!=="string"||s.length>600))throw new Error("CAREER_INVALID:"+key);return a as string[];};
  if(!Array.isArray(v.claims)||v.claims.length>5)throw new Error("CAREER_INVALID:claims");
  const claims=v.claims.map((value:unknown)=>{
    const c=value as Record<string,unknown>;
    if(!c||typeof c.text!=="string"||c.text.length>900||typeof c.sourceId!=="string"||typeof c.quote!=="string"||c.quote.length<5||c.quote.length>900)throw new Error("CAREER_INVALID:claim");
    const source=sources.find(s=>s.id===c.sourceId);
    if(!source||!source.content.includes(c.quote))throw new Error("CAREER_INVALID:citation");
    return {text:c.text,sourceId:c.sourceId,quote:c.quote};
  });
  return {claims,gaps:strings("gaps"),questions:strings("questions")};
}

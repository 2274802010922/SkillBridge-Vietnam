import { verifyPortfolioCredential, type ProofCheck } from "../../../solana/server/portfolio-verification.ts";
import type { PortfolioSource } from "../../../shared/validation/portfolio.ts";
export async function checkPortfolioSources(db:D1Database,rpc:string,sources:PortfolioSource[]){
  return Promise.all(sources.map(async source=>{
    if(source.kind!=="credential")return {...source,verification:null as ProofCheck|null};
    const row=await db.prepare("SELECT sc.*,ci.credential_address FROM skill_credentials sc JOIN credential_issuers ci ON ci.organization_id=sc.issuer_organization_id WHERE sc.id=?").bind(source.id).first<Parameters<typeof verifyPortfolioCredential>[1]>();
    const verification:ProofCheck=row?await verifyPortfolioCredential(rpc,row):{state:"invalid",checkedAt:new Date().toISOString(),reason:"ISSUER_UNAVAILABLE"};
    return {...source,verification};
  }));
}

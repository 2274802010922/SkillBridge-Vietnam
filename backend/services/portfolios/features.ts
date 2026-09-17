export async function featureAccess(db:D1Database,scope:string,feature:"personal_plus"|"business"){
  // Server-issued launch trial, once per scope. No endpoint accepts plan/expiry from users.
  await db.prepare("INSERT OR IGNORE INTO feature_trials(scope_id,feature,provenance,expires_at) VALUES(?,?,'launch_trial',?)")
    .bind(scope,feature,new Date(Date.now()+14*86400000).toISOString()).run();
  const trial=await db.prepare("SELECT provenance,expires_at FROM feature_trials WHERE scope_id=? AND feature=?").bind(scope,feature).first<{provenance:string;expires_at:string}>();
  return {active:Boolean(trial&&Date.parse(trial.expires_at)>Date.now()),expiresAt:trial?.expires_at??null,provenance:trial?.provenance??null,mode:"trial" as const};
}
export async function personalUsage(db:D1Database,owner:string){
  const trial=await featureAccess(db,"user:"+owner,"personal_plus"),day=new Date().toISOString().slice(0,10);
  const packs=await db.prepare("SELECT COUNT(*) AS n FROM portfolio_packs WHERE owner_id=?").bind(owner).first<{n:number}>();
  const ai=await db.prepare("SELECT COUNT(*) AS n FROM career_operations WHERE owner_id=? AND budget_day=? AND status IN ('pending','complete')").bind(owner,day).first<{n:number}>();
  return {trial,packLimit:trial.active?10:2,packCount:packs?.n??0,aiDailyLimit:trial.active?5:1,aiUsed:ai?.n??0,day};
}

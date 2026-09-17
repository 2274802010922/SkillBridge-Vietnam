export type CareerOperation={id:string;owner_id:string;pack_id:string;version:number;status:string;result_json:string|null;usage_json:string|null;lease:string;expires_at:number};
export async function reserveCareer(db:D1Database,input:{owner:string;packId:string;version:number;locale:string;fingerprint:string;limit:number}){
  const now=Date.now(),day=new Date(now).toISOString().slice(0,10),lease=crypto.randomUUID(),id=crypto.randomUUID();
  const old=await db.prepare("SELECT * FROM career_operations WHERE owner_id=? AND fingerprint=?").bind(input.owner,input.fingerprint).first<CareerOperation>();
  if(old?.status==="complete")return {operation:old,acquired:false};
  if(old?.status==="pending"&&old.expires_at>now)return {operation:old,acquired:false};
  const capacity="(SELECT COUNT(*) FROM career_operations WHERE owner_id=? AND budget_day=? AND status IN ('pending','complete') AND id<>?)<?";
  const change=old?await db.prepare(`UPDATE career_operations SET status='pending',lease=?,expires_at=?,budget_day=?,result_json=NULL WHERE id=? AND (status='failed' OR expires_at<?) AND ${capacity}`)
    .bind(lease,now+120000,day,old.id,now,input.owner,day,old.id,input.limit).run():
    await db.prepare(`INSERT OR IGNORE INTO career_operations(id,owner_id,fingerprint,pack_id,version,locale,status,lease,expires_at,budget_day) SELECT ?,?,?,?,?,?,'pending',?,?,? WHERE ${capacity}`)
      .bind(id,input.owner,input.fingerprint,input.packId,input.version,input.locale,lease,now+120000,day,input.owner,day,id,input.limit).run();
  const op=await db.prepare("SELECT * FROM career_operations WHERE owner_id=? AND fingerprint=?").bind(input.owner,input.fingerprint).first<CareerOperation>();
  if(!change.meta.changes&&(!op||op.status!=="pending"))throw new Response("Hết lượt AI hôm nay. / Daily AI limit reached.",{status:429});
  return {operation:op!,acquired:Boolean(change.meta.changes)};
}

export type BootstrapPrepared={wire:string;signature:string;lastValidBlockHeight:number};
export type BootstrapTransport={
  exists():Promise<boolean>;
  prepare():Promise<BootstrapPrepared>;
  inspect(tx:BootstrapPrepared):Promise<"absent"|"pending"|"failed"|"expired">;
  broadcast(tx:BootstrapPrepared):Promise<void>;
};
export async function recoverBootstrapStep(db:D1Database,key:string,fingerprint:string,chain:BootstrapTransport):Promise<string|null>{
  await db.prepare("INSERT OR IGNORE INTO issuer_bootstrap_steps(operation_key,fingerprint) VALUES(?,?)").bind(key,fingerprint).run();
  const lease=crypto.randomUUID(),now=Date.now();
  const acquired=await db.prepare("UPDATE issuer_bootstrap_steps SET lease=?,lease_until=? WHERE operation_key=? AND fingerprint=? AND lease_until<?")
    .bind(lease,now+120000,key,fingerprint,now).run();
  if(!acquired.meta.changes)throw new Response("Yêu cầu đang xử lý hoặc cấu hình issuer đã thay đổi. Kiểm tra lại sau.",{status:409});
  try{
    const row=await db.prepare("SELECT prepared_json,status FROM issuer_bootstrap_steps WHERE operation_key=?").bind(key).first<{prepared_json:string|null;status:string}>();
    let tx:BootstrapPrepared|null=row?.prepared_json?JSON.parse(row.prepared_json):null;
    if(await chain.exists()){
      await db.prepare("UPDATE issuer_bootstrap_steps SET status='completed',updated_at=CURRENT_TIMESTAMP WHERE operation_key=? AND lease=?").bind(key,lease).run();
      return tx?.signature??null;
    }
    if(row?.status==="completed")throw new Response("Issuer đã ghi nhận nhưng account không còn hợp lệ. Cần đối soát.",{status:409});
    if(tx){
      const status=await chain.inspect(tx);
      if(status==="pending")throw new Response("Đang xác nhận issuer. Kiểm tra lại cùng yêu cầu.",{status:202});
      if(status==="failed")throw new Response("Giao dịch issuer thất bại. Cần đối soát trước khi tạo lại.",{status:409});
      if(status==="expired")tx=null;
    }
    if(!tx){
      tx=await chain.prepare();
      const saved=await db.prepare("UPDATE issuer_bootstrap_steps SET prepared_json=?,status='prepared' WHERE operation_key=? AND lease=?")
        .bind(JSON.stringify(tx),key,lease).run();
      if(!saved.meta.changes)throw new Error("BOOTSTRAP_LEASE_LOST");
    }
    await chain.broadcast(tx);
    if(!(await chain.exists()))throw new Response("Đang xác nhận issuer. Kiểm tra lại cùng yêu cầu.",{status:202});
    await db.prepare("UPDATE issuer_bootstrap_steps SET status='completed' WHERE operation_key=? AND lease=?").bind(key,lease).run();
    return tx.signature;
  }finally{await db.prepare("UPDATE issuer_bootstrap_steps SET lease=NULL,lease_until=0 WHERE operation_key=? AND lease=?").bind(key,lease).run();}
}

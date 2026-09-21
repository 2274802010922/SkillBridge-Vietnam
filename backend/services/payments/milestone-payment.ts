import { verifyUsdcPayment, PaymentVerificationError } from "../../../solana/server/payments.ts";
export type MilestoneIntent = { sender:string;recipient:string;mint:string;amountAtomic:string;reference:string|null;network:"solana:devnet" };
export async function verifyMilestone(db:D1Database, milestoneId:string, signature:string, intent:MilestoneIntent,
  rpc:string|undefined, verify=verifyUsdcPayment) {
  const prior=await db.prepare("SELECT status,payment_tx FROM contract_milestones WHERE id=?").bind(milestoneId).first<{status:string;payment_tx:string|null}>();
  if(!prior)throw new Response("Milestone không tồn tại.",{status:404});
  const duplicates=await db.prepare("SELECT id FROM contract_milestones WHERE payment_tx=? AND id<>?").bind(signature,milestoneId).all();
  if(duplicates.results.length)throw new Response("Giao dịch đã được dùng cho milestone khác. Cần đối soát.",{status:409});
  if(prior.status==="paid"){
    if(prior.payment_tx===signature)return {reused:true};
    throw new Response("Milestone đã thanh toán bằng giao dịch khác.",{status:409});
  }
  if(prior.status!=="approved")throw new Response("Milestone chưa được duyệt.",{status:409});
  await db.prepare("INSERT OR IGNORE INTO milestone_signature_claims(signature,milestone_id) VALUES(?,?)").bind(signature,milestoneId).run();
  const claim=await db.prepare("SELECT milestone_id FROM milestone_signature_claims WHERE signature=?").bind(signature).first<{milestone_id:string}>();
  if(claim?.milestone_id!==milestoneId)throw new Response("Giao dịch hoặc milestone đang được đối soát với lệnh khác.",{status:409});
  try{
    const payment=await verify({signature,recipientWallet:intent.recipient,expectedAtomic:intent.amountAtomic,mint:intent.mint,
      expectedSenderWallet:intent.sender,expectedReference:intent.reference??undefined,requireFinalized:true,rpcUrl:rpc});
    if(payment.amountAtomic!==intent.amountAtomic)throw new Response("Số tiền không khớp milestone; cần đối soát.",{status:409});
    const writes=await db.batch([
      db.prepare("UPDATE contract_milestones SET status='paid',payment_tx=?,paid_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='approved' AND NOT EXISTS(SELECT 1 FROM contract_milestones WHERE payment_tx=? AND id<>?)")
        .bind(signature,payment.observedAt,milestoneId,signature,milestoneId),
      db.prepare("UPDATE milestone_signature_claims SET verified=1 WHERE signature=? AND milestone_id=? AND EXISTS(SELECT 1 FROM contract_milestones WHERE id=? AND payment_tx=? AND status='paid')")
        .bind(signature,milestoneId,milestoneId,signature),
    ]);
    if(!writes[0].meta.changes) {
      const current=await db.prepare("SELECT payment_tx FROM contract_milestones WHERE id=? AND status='paid'").bind(milestoneId).first<{payment_tx:string}>();
      if(current?.payment_tx!==signature)throw new Response("Trạng thái đã thay đổi; tải lại để đối soát.",{status:409});
    }
    return {reused:!writes[0].meta.changes};
  }catch(error){
    if(error instanceof PaymentVerificationError && !error.retryable)
      await db.prepare("DELETE FROM milestone_signature_claims WHERE signature=? AND milestone_id=? AND verified=0").bind(signature,milestoneId).run();
    throw error;
  }
}

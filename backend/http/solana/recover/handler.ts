import { env } from "@/backend/config/runtime-env";
import { assertSameOrigin, requireSessionUser, jsonError } from "../../../auth/auth";
import { consumeRateLimit } from "../../../auth/rate-limit";
import { assertEscrowDevnet, escrowRpc } from "../../../../solana/client/challenge-escrow";
import { getTransactionDecoder, getCompiledTransactionMessageDecoder } from "gill";
import bs58 from "bs58";
import nacl from "tweetnacl";
export async function POST(request:Request){
 try{
  assertSameOrigin(request);const user=await requireSessionUser(request);
  await consumeRateLimit(env.DB,"transaction_recovery",user.id,30,60);
  const body=await request.json() as {transaction?:string;cashoutId?:string};
  if(!body.transaction||body.transaction.length>65536)throw new Response("Thiếu giao dịch đã ký.",{status:400});
  const tx=getTransactionDecoder().decode(Buffer.from(body.transaction,"base64"));
  const message=getCompiledTransactionMessageDecoder().decode(tx.messageBytes);
  if(String(message.staticAccounts[0])!==user.walletAddress)throw new Response("Dùng đúng ví đã ký.",{status:403});
  const first=Object.values(tx.signatures)[0];
  if(!first || !nacl.sign.detached.verify(new Uint8Array(tx.messageBytes),new Uint8Array(first),bs58.decode(user.walletAddress)))throw new Response("Giao dịch chưa ký.",{status:400});
  const signature=bs58.encode(first),rpc=env.SOLANA_RPC_URL||"https://api.devnet.solana.com";
  await assertEscrowDevnet(rpc);
  const {value}=await escrowRpc<{value:Array<{err:unknown;confirmationStatus:string}|null>}>(rpc,"getSignatureStatuses",[[signature],{searchTransactionHistory:true}]);
  const status=value[0];
  let state:string;
  if(status)state=status.confirmationStatus==="finalized"?(status.err?"failed":"finalized"):"pending";
  else {
    const valid=await escrowRpc<{value:boolean}>(rpc,"isBlockhashValid",[message.lifetimeToken,{commitment:"finalized"}]);
    state=valid.value?"retry_same":"expired";
  }
  if(body.cashoutId && ["failed","expired"].includes(state)){
    const order=await env.DB.prepare("SELECT submitted_tx,payment_tx FROM cashout_sessions WHERE id=? AND user_id=?").bind(body.cashoutId,user.id).first<{submitted_tx:string|null;payment_tx:string|null}>();
    if(order?.submitted_tx===signature && !order.payment_tx)await env.DB.batch([
      env.DB.prepare("UPDATE cashout_sessions SET submitted_tx=NULL,status='awaiting_wallet_signature',verification_state='awaiting_signature',last_error_code=? WHERE id=? AND user_id=? AND submitted_tx=? AND payment_tx IS NULL").bind(state.toUpperCase(),body.cashoutId,user.id,signature),
      env.DB.prepare("DELETE FROM offramp_signature_claims WHERE order_id=? AND signature=? AND EXISTS(SELECT 1 FROM cashout_sessions WHERE id=? AND user_id=? AND payment_tx IS NULL AND submitted_tx IS NULL)").bind(body.cashoutId,signature,body.cashoutId,user.id)
    ]);
  }
  return Response.json({state,signature},{headers:{"cache-control":"no-store"}});
 }catch(e){return jsonError(e);}
}

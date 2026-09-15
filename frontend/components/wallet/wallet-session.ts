import { StandardDisconnect, type StandardDisconnectFeature } from "@wallet-standard/features";
type Connection = { accounts:readonly {address:string}[]; features:Readonly<Record<string,unknown>> };
export async function endWalletSession(walletAddress:string,revoke:()=>Promise<{ok:boolean}>,connections:()=>readonly Connection[]){
  const response=await revoke();
  if(!response.ok)throw new Error("SESSION_REVOKE_FAILED");
  await Promise.allSettled(connections().filter(wallet=>wallet.accounts.some(account=>account.address===walletAddress)).map(async wallet=>{
    const feature=wallet.features[StandardDisconnect] as StandardDisconnectFeature[typeof StandardDisconnect]|undefined;
    if(!feature)return;
    let timer:ReturnType<typeof setTimeout>|undefined;
    try{await Promise.race([feature.disconnect(),new Promise<void>(resolve=>{timer=setTimeout(resolve,1500);})]);}finally{if(timer)clearTimeout(timer);}
  }));
}

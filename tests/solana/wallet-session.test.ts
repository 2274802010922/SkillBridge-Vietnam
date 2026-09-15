import assert from "node:assert/strict";
import test from "node:test";
import {StandardDisconnect} from "@wallet-standard/features";
import {endWalletSession} from "../../frontend/components/wallet/wallet-session.ts";

test("disconnect revokes the session before disconnecting only the matching wallet",async()=>{
  const events:string[]=[];
  await endWalletSession("mine",async()=>{events.push("revoke");return {ok:true};},()=>[
    {accounts:[{address:"mine"}],features:{[StandardDisconnect]:{disconnect:async()=>{events.push("mine");}}}},
    {accounts:[{address:"other"}],features:{[StandardDisconnect]:{disconnect:async()=>{events.push("other");}}}},
  ]);
  assert.deepEqual(events,["revoke","mine"]);
});
test("failed session revocation does not present a successful wallet disconnect",async()=>{
  let disconnected=false;
  await assert.rejects(()=>endWalletSession("mine",async()=>({ok:false}),()=>[{accounts:[{address:"mine"}],features:{[StandardDisconnect]:{disconnect:async()=>{disconnected=true;}}}}]),/SESSION_REVOKE_FAILED/);
  assert.equal(disconnected,false);
});

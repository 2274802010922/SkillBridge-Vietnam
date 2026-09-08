import assert from "node:assert/strict";
import nacl from "tweetnacl";
import {
  createKeyPairSignerFromBytes,
  createSolanaClient,
  createTransaction,
  type Instruction,
  type TransactionSigner,
} from "gill";
import {
  escrowAddress,
  escrowInstructions,
  readEscrowAccount,
  submissionAddress,
  SYSTEM,
  DEVNET_USDC,
  hashBytes,
  escrowRpc,
  type EscrowAction,
  type EscrowConfig,
} from "../../solana/client/challenge-escrow.ts";
const rpcUrl = process.env.ESCROW_TEST_RPC || "http://127.0.0.1:8899";
assert.ok(
  ["127.0.0.1", "localhost"].includes(new URL(rpcUrl).hostname),
  "Use local validator only; test keys are public fixtures.",
);
const client = createSolanaClient({ urlOrMoniker: rpcUrl as "devnet" });
const signers = await Promise.all(
  [77, 78, 79, 80, 81].map((n) =>
    createKeyPairSignerFromBytes(
      nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(n)).secretKey,
    ),
  ),
);
const [funder, reviewer, backup, registrar, student] = signers;
async function pause(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}
for (const signer of signers)
  await escrowRpc(rpcUrl, "requestAirdrop", [signer.address, 2000000000]);
await pause(2500);
let txCounter = 0;
async function send(ixs: Instruction[], actor: TransactionSigner) {
  const { value: latestBlockhash } = await client.rpc
    .getLatestBlockhash({ commitment: "confirmed" })
    .send();
  const instructions = ixs.map((ix) => ({
    ...ix,
    accounts: ix.accounts?.map((a) => {
      const s = signers.find((s) => s.address === a.address);
      return s ? { ...a, signer: s } : a;
    }),
  }));
  return client.sendAndConfirmTransaction(
    createTransaction({
      version: "legacy",
      feePayer: actor,
      instructions,
      latestBlockhash,
      computeUnitLimit: 300000,
      computeUnitPrice: ++txCounter,
    }),
    { commitment: "confirmed" },
  );
}
async function run(
  c: EscrowConfig,
  actor: TransactionSigner,
  action: EscrowAction,
  extra: Parameters<typeof escrowInstructions>[3] = {},
) {
  return send(
    await escrowInstructions(c, String(actor.address), action, extra),
    actor,
  );
}
async function read(c: EscrowConfig) {
  for (let i = 0; i < 200; i++) {
    const s = await readEscrowAccount(rpcUrl, await escrowAddress(c), "Escrow");
    if (s?.state===2 && s.paid===c.amount && s.refunded===c.amount) return s;
    await pause(200);
  }
  throw new Error("Account not finalized");
}
async function bankTime() {
  const r = await escrowRpc<{ value: { data: [string, string] } }>(
    rpcUrl,
    "getAccountInfo",
    [
      "SysvarC1ock11111111111111111111111111111111",
      { encoding: "base64", commitment: "confirmed" },
    ],
  );
  return Number(Buffer.from(r.value.data[0], "base64").readBigInt64LE(32));
}
for (const mint of [SYSTEM, DEVNET_USDC]) {
  const now = await bankTime();
  const c: EscrowConfig = {
    challengeId: crypto.randomUUID(),
    funder: String(funder.address),
    reviewer: String(reviewer.address),
    backup: String(backup.address),
    registrar: String(registrar.address),
    mint,
    amount: "1000000",
    slots: 2,
    submitDeadline: now + 15,
    reviewDeadline: now + 120,
    termsHash: (await hashBytes("test terms")).toString("hex"),
    termsText: "test terms",
  };
  const evidence = (await hashBytes("submission")).toString("hex");
  const extra = {
    student: String(student.address),
    submissionId: "test-submission",
    evidenceHash: evidence,
    resultHash: evidence,
    eligible: true,
  };
  await run(c, funder, "initialize");
  await assert.rejects(run(c, funder, "publish")); // both consents required
  await run(c, reviewer, "accept_role");
  await run(c, backup, "accept_role");
  await run(c, funder, "publish");
  await assert.rejects(run(c, funder, "refund_unused")); // cannot refund after publication
  await assert.rejects(run({...c,registrar:String(backup.address)},student,"register_submission",extra));
  await run(c, student, "register_submission", extra);
  await assert.rejects(run(c, student, "register_submission", extra)); // one receipt per wallet/challenge
  await assert.rejects(run(c, reviewer, "finalize_results")); // unresolved submission
  for (let retry = 0; (await bankTime()) <= c.submitDeadline; retry++) {
    assert.ok(retry < 600, "Clock did not advance");
    await pause(150);
  }
  await assert.rejects(run(c, funder, "record_result", extra));
  await run(c, reviewer, "record_result", extra);
  await run(c, reviewer, "allocate_award", extra);
  await assert.rejects(run(c, reviewer, "allocate_award", extra));
  // Attempt redirecting the recipient while preserving the winner receipt.
  const redirect = await escrowInstructions(
    c,
    String(student.address),
    "claim_award",
    extra,
  );
  const ix = redirect[redirect.length - 1];
  redirect[redirect.length - 1] = {
    ...ix,
    accounts: ix.accounts?.map((a, i) =>
      i === 3 ? { ...a, address: backup.address } : a,
    ),
  };
  await assert.rejects(send(redirect, student));
  await run(c, reviewer, "finalize_results");
  await run(c, funder, "refund_unused"); // allocated reward remains claimable after refund
  const claims = await Promise.allSettled([
    run(c, student, "claim_award", extra),
    run(c, student, "claim_award", extra),
  ]);
  const claimSignatures=[...new Set(claims.flatMap(x=>x.status==='fulfilled'?[String(x.value)]:[]))];
  const claimStatuses=await escrowRpc<{value:Array<{err:unknown}|null>}>(rpcUrl,'getSignatureStatuses',[claimSignatures,{searchTransactionHistory:true}]);
  assert.equal(claimStatuses.value.filter(s=>s&&s.err===null).length,1,'Only one distinct transaction may settle the reward');
  await assert.rejects(run(c, funder, "refund_unused"));
  await pause(2500);
  const state = await read(c);
  assert.equal(state.paid, c.amount);
  assert.equal(state.refunded, c.amount);
  assert.equal(state.state, 2);
  const receipt = await readEscrowAccount(
    rpcUrl,
    await submissionAddress(await escrowAddress(c), String(student.address)),
    "Submission",
  );
  assert.equal(receipt?.paid, true);
  console.log(
    JSON.stringify({
      asset: mint === SYSTEM ? "SOL" : "USDC",
      escrow: await escrowAddress(c),
      paid: state.paid,
      refunded: state.refunded,
      negativeCases:
        "consent, lock, duplicate submission, unresolved, wrong reviewer, duplicate allocation, redirect, parallel claim, duplicate refund",
    }),
  );
}
const now=await bankTime();
const idle:EscrowConfig={challengeId:crypto.randomUUID(),funder:String(funder.address),reviewer:String(reviewer.address),backup:String(backup.address),registrar:String(registrar.address),mint:SYSTEM,amount:'1000000',slots:1,submitDeadline:now+10,reviewDeadline:now+15,termsText:'timeout test',termsHash:(await hashBytes('timeout')).toString('hex')};
await run(idle,funder,'initialize');await run(idle,reviewer,'accept_role');await run(idle,backup,'accept_role');await run(idle,funder,'publish');
while(await bankTime()<=idle.reviewDeadline)await pause(150);
await assert.rejects(run(idle,reviewer,'finalize_results'));
await run(idle,backup,'finalize_results');await run(idle,funder,'refund_unused');
console.log("Escrow SBF transaction smoke passed, including backup timeout and reserved claim after refund.");

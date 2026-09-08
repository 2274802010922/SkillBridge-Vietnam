import {
  independentClaimInstructions,
  inspectReward,
} from "../../solana/client/independent-claim.ts";
// Real Devnet proof only. Uses an explicitly supplied deployment wallet file; never logs secrets.
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import {
  createKeyPairSignerFromBytes,
  generateKeyPairSigner,
  createSolanaClient,
  createTransaction,
  type Instruction,
  type TransactionSigner,
} from "gill";
import { getTransferSolInstruction } from "gill/programs";
import {
  assertEscrowDevnet,
  escrowAddress,
  escrowInstructions,
  readEscrowAccount,
  hashBytes,
  SYSTEM,
  ESCROW_PROGRAM,
  type EscrowConfig,
  type EscrowAction,
} from "../../solana/client/challenge-escrow.ts";
const rpc = "https://api.devnet.solana.com";
let backendRequests = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (url, init) => {
  if (new URL(String(url)).hostname !== "api.devnet.solana.com") {
    backendRequests++;
    throw new Error("Non-RPC request forbidden in independent proof");
  }
  return originalFetch(url, init);
}) as typeof fetch;
await assertEscrowDevnet(rpc);
assert.ok(
  process.env.ESCROW_PROOF_PAYER_PATH,
  "Explicit Devnet payer path required",
);
const payer = await createKeyPairSignerFromBytes(
  Uint8Array.from(
    JSON.parse(await readFile(process.env.ESCROW_PROOF_PAYER_PATH!, "utf8")),
  ),
);
const [backup, registrar, student] = await Promise.all([
  generateKeyPairSigner(),
  generateKeyPairSigner(),
  generateKeyPairSigner(),
]);
const signers = [payer, backup, registrar, student];
const client = createSolanaClient({ urlOrMoniker: "devnet" });
async function send(ixs: Instruction[], feePayer: TransactionSigner = payer) {
  const { value: latestBlockhash } = await client.rpc
    .getLatestBlockhash({ commitment: "confirmed" })
    .send();
  return String(
    await client.sendAndConfirmTransaction(
      createTransaction({
        version: "legacy",
        feePayer,
        instructions: ixs.map((ix) => ({
          ...ix,
          accounts: ix.accounts?.map((a) => {
            const signer =
              a.role >= 2
                ? signers.find((s) => s.address === a.address)
                : undefined;
            return signer ? { ...a, signer } : a;
          }),
        })),
        latestBlockhash,
        computeUnitLimit: 300000,
      }),
      { commitment: "confirmed" },
    ),
  );
}
await send([
  getTransferSolInstruction({
    source: payer,
    destination: student.address,
    amount: BigInt(5000000),
  }),
]);
const now = Math.floor(Date.now() / 1000);
const config: EscrowConfig = {
  challengeId: "proof-" + crypto.randomUUID(),
  funder: String(payer.address),
  reviewer: String(payer.address),
  backup: String(backup.address),
  registrar: String(registrar.address),
  mint: SYSTEM,
  amount: "1000000",
  slots: 2,
  submitDeadline: now + 50,
  reviewDeadline: now + 600,
  termsText:
    "Devnet verification only: two 0.001 SOL slots, one selected recipient.",
  termsHash: (
    await hashBytes(
      "Devnet verification only: two 0.001 SOL slots, one selected recipient.",
    )
  ).toString("hex"),
};
const extra = {
  student: String(student.address),
  submissionId: "devnet-proof-submission",
  evidenceHash: (await hashBytes("test evidence")).toString("hex"),
  resultHash: (await hashBytes("test human approval")).toString("hex"),
  eligible: true,
};
const tx: Record<string, string> = {};
const proofEscrow = await escrowAddress(config);
async function checkpoint(phase: string) {
  await writeFile(
    "docs/solana/evidence/independent-claim-progress.json",
    JSON.stringify(
      {
        phase,
        program: ESCROW_PROGRAM,
        escrow: proofEscrow,
        recipient: String(student.address),
        network: "Solana Devnet",
        backendRequests,
        transactions: tx,
        checkedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}
async function run(action: EscrowAction, actor: TransactionSigner = payer) {
  tx[action] = await send(
    await escrowInstructions(config, String(actor.address), action, extra),
  );
  console.log(action + ": " + tx[action]);
  await checkpoint(action);
}
await run("initialize");
await run("accept_role");
await run("accept_role", backup);
await run("publish");
await run("register_submission", student);
while (Date.now() < config.submitDeadline * 1000 + 5000)
  await new Promise((r) => setTimeout(r, 1000));
await run("record_result");
await run("allocate_award");
const claimEscrow = await escrowAddress(config);
let ready = false;
for (let i = 0; i < 45; i++) {
  if (
    (await inspectReward(rpc, claimEscrow, String(student.address))).claimable
  ) {
    ready = true;
    break;
  }
  await new Promise((r) => setTimeout(r, 1000));
}
assert.ok(ready, "Finalized allocation must be claimable");
console.log(
  "Claim now uses independent module; no SkillBridge backend is called.",
);
tx.claim_award = await send(
  await independentClaimInstructions(rpc, claimEscrow, String(student.address)),
  student,
);
console.log("claim_award: " + tx.claim_award);
await checkpoint("claim_sent");
await run("finalize_results");
try {
  await run("refund_unused");
} catch {
  console.warn(
    "Refund confirmation interrupted. Checking finalized state; never resending automatically. Public escrow is in independent-claim-progress.json.",
  );
}
const key = await escrowAddress(config);
let state = null;
for (let i = 0; i < 40; i++) {
  state = await readEscrowAccount(rpc, key, "Escrow");
  if (state?.refunded === "1000000") break;
  await new Promise((r) => setTimeout(r, 1000));
}
assert.equal(state?.paid, "1000000");
assert.equal(state?.refunded, "1000000");
assert.equal(state?.state, 2);
const balance = (await client.rpc.getBalance(student.address).send()).value;
if (balance > BigInt(0))
  await send(
    [
      getTransferSolInstruction({
        source: student,
        destination: payer.address,
        amount: balance,
      }),
    ],
    payer,
  );
await writeFile(
  "docs/solana/evidence/independent-claim-proof.json",
  JSON.stringify(
    {
      program: ESCROW_PROGRAM,
      escrow: key,
      recipient: String(student.address),
      network: "Solana Devnet",
      backendRequests,
      claimTx: tx.claim_award,
      paid: state.paid,
      verifiedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
assert.equal(backendRequests, 0);
console.log(
  JSON.stringify(
    {
      program: ESCROW_PROGRAM,
      escrow: key,
      asset: "SOL Devnet",
      funded: state.funded,
      paid: state.paid,
      refunded: state.refunded,
      transactions: tx,
      verifiedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);

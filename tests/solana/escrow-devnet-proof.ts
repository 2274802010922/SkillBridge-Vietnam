// Real Devnet proof only. Uses an explicitly supplied deployment wallet file; never logs secrets.
import { readFile } from "node:fs/promises";
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
  termsHash: (await hashBytes("Devnet test terms v1")).toString("hex"),
};
const extra = {
  student: String(student.address),
  submissionId: "devnet-proof-submission",
  evidenceHash: (await hashBytes("test evidence")).toString("hex"),
  resultHash: (await hashBytes("test human approval")).toString("hex"),
  eligible: true,
};
const tx: Record<string, string> = {};
async function run(action: EscrowAction, actor: TransactionSigner = payer) {
  tx[action] = await send(
    await escrowInstructions(config, String(actor.address), action, extra),
  );
  console.log(action + ": " + tx[action]);
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
await run("claim_award", student);
await run("finalize_results");
await run("refund_unused");
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

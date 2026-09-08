import { env } from "../../config/runtime-env";
import {
  assertEscrowDevnet,
  ESCROW_PROGRAM,
  escrowAddress,
  readEscrowAccount,
  listEscrowSubmissions,
  hashBytes,
  type EscrowConfig,
  type EscrowState,
} from "../../../solana/client/challenge-escrow";
export type EscrowRow = {
  challenge_id: string;
  program_id: string;
  escrow_address: string;
  config_json: string;
  chain_state_json: string | null;
};
export const escrowRow = (id: string) =>
  env.DB.prepare("SELECT * FROM challenge_escrows WHERE challenge_id=?")
    .bind(id)
    .first<EscrowRow>();
export async function readAndSyncEscrow(row: EscrowRow) {
  const rpc = env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  await assertEscrowDevnet(rpc);
  const config = JSON.parse(row.config_json) as EscrowConfig;
  const key = await escrowAddress(config);
  if (row.program_id !== ESCROW_PROGRAM || row.escrow_address !== key)
    throw new Error("Cấu hình quỹ không khớp program.");
  const state = await readEscrowAccount(rpc, key, "Escrow");
  if (!state) return { config, state: null, submissions: [] };
  if (
    state.funder !== config.funder ||
    state.terms !== config.termsHash ||
    state.reviewer !== config.reviewer ||
    state.backup !== config.backup ||
    state.registrar !== config.registrar ||
    state.mint !== config.mint ||
    state.amount !== config.amount ||
    state.slots !== config.slots ||
    state.submitDeadline !== config.submitDeadline ||
    state.reviewDeadline !== config.reviewDeadline ||
    state.id !== (await hashBytes(config.challengeId)).toString("hex")
  )
    throw new Error("Điều khoản quỹ không khớp blockchain.");
  const submissions = await listEscrowSubmissions(rpc, key);
  // A finalized snapshot cannot move the off-chain mirror backwards in the lifecycle.
  const old = row.chain_state_json
    ? (JSON.parse(row.chain_state_json) as EscrowState)
    : null;
  if (old && (state.state < old.state || BigInt(state.paid) < BigInt(old.paid)))
    throw new Error("RPC đang trả trạng thái cũ. Hãy kiểm tra lại.");
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE challenge_escrows SET chain_state_json=?,chain_slot=?,updated_at=CURRENT_TIMESTAMP WHERE challenge_id=? AND chain_slot<=?",
    ).bind(
      JSON.stringify(state),
      state.observedSlot,
      row.challenge_id,
      state.observedSlot,
    ),
    env.DB.prepare(
      `UPDATE challenges SET funding_status=?,funding_vault_wallet=?,funding_asset=?,funding_amount_atomic=?,funding_amount_display=?,closes_at=?,status=CASE WHEN ?=1 THEN 'published' WHEN ?=2 THEN 'closed' ELSE status END,published_at=CASE WHEN ?=1 THEN COALESCE(published_at,CURRENT_TIMESTAMP) ELSE published_at END WHERE id=? AND EXISTS(SELECT 1 FROM challenge_escrows e WHERE e.challenge_id=challenges.id AND e.chain_slot=?)`,
    ).bind(
      state.state === 3
        ? "refunded"
        : BigInt(state.funded) > 0
          ? "funded"
          : "pending",
      key,
      state.mint === "11111111111111111111111111111111" ? "sol" : "usdc",
      state.funded,
      formatAtomic(state.funded, state.mint),
      new Date(config.submitDeadline * 1000).toISOString(),
      state.state,
      state.state,
      state.state,
      row.challenge_id,
      state.observedSlot,
    ),
  ]);
  for (const s of submissions) {
    const lock = await env.DB.prepare(
      "SELECT submission_id,evidence_hash FROM escrow_submission_locks WHERE challenge_id=? AND student_wallet=?",
    )
      .bind(row.challenge_id, s.student)
      .first<{ submission_id: string; evidence_hash: string }>();
    if (
      !lock ||
      s.submissionId !==
        (await hashBytes(lock.submission_id)).toString("hex") ||
      s.evidenceHash !== lock.evidence_hash
    )
      continue;
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE escrow_submission_locks SET chain_json=?,updated_at=CURRENT_TIMESTAMP WHERE submission_id=? AND COALESCE(json_extract(chain_json,'$.decision'),0)<=? AND COALESCE(json_extract(chain_json,'$.paid'),0)<=?",
      ).bind(JSON.stringify(s), lock.submission_id, s.decision, s.paid ? 1 : 0),
      env.DB.prepare(
        `UPDATE submissions SET state='submitted',submitted_at=COALESCE(submitted_at,CURRENT_TIMESTAMP),locked_at=COALESCE(locked_at,CURRENT_TIMESTAMP) WHERE id=? AND state='signing'`,
      ).bind(lock.submission_id),
      env.DB.prepare(
        `UPDATE participations SET state='submitted' WHERE id=(SELECT participation_id FROM submissions WHERE id=?) AND state='accepted'`,
      ).bind(lock.submission_id),
    ]);
  }
  return { config, state, submissions };
}
export function formatAtomic(value: string, mint: string) {
  const decimals = mint === "11111111111111111111111111111111" ? 9 : 6;
  const b = BigInt(value);
  const scale = BigInt("10") ** BigInt(decimals);
  return (
    (b / scale).toString() +
    (b % scale
      ? "." + (b % scale).toString().padStart(decimals, "0").replace(/0+$/, "")
      : "")
  );
}

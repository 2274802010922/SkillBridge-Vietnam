import bs58 from "bs58";
import {
  address,
  createSolanaClient,
  createTransaction,
  transactionToBase64WithSigners,
} from "gill";
import { getTransferSolInstruction } from "gill/programs";
import {
  getAssociatedTokenAccountAddress,
  getTransferTokensInstructions,
} from "gill/programs/token";
import {
  rewardVaultSigner,
  type RewardVaultEnvironment,
  type RewardAsset,
} from "./reward-vault";
import {
  assertEscrowDevnet,
  escrowRpc,
  hashBytes,
  DEVNET_USDC,
} from "./challenge-escrow";
type Op = {
  operation_key: string;
  payload_hash: string;
  transaction_b64: string | null;
  signature: string | null;
};
// Persist signed bytes before broadcasting. Retries only rebroadcast the identical transaction.
export async function journaledVaultTransfer(
  env: RewardVaultEnvironment & { DB: D1Database; SOLANA_USDC_MINT?: string },
  fundId: string,
  operationKey: string,
  input: { recipientWallet: string; asset: RewardAsset; amountAtomic: string },
) {
  const rpc = env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  await assertEscrowDevnet(rpc);
  await env.DB.prepare(
    "INSERT OR IGNORE INTO legacy_fund_locks(fund_id,operation_key) VALUES(?,?)",
  )
    .bind(fundId, operationKey)
    .run();
  const lock = await env.DB.prepare(
    "SELECT operation_key FROM legacy_fund_locks WHERE fund_id=?",
  )
    .bind(fundId)
    .first<{ operation_key: string }>();
  if (lock?.operation_key !== operationKey)
    throw new Response(
      "Quỹ đang xử lý giao dịch khác. Kiểm tra lại giao dịch đang chờ trước.",
      { status: 409 },
    );
  const vault = await rewardVaultSigner(env);
  const payloadHash = (
    await hashBytes(JSON.stringify({ fundId, input, vault: vault.address }))
  ).toString("hex");
  const inserted = await env.DB.prepare(
    "INSERT OR IGNORE INTO legacy_vault_operations(operation_key,payload_hash) VALUES(?,?)",
  )
    .bind(operationKey, payloadHash)
    .run();
  if (inserted.meta.changes) {
    const fund = await env.DB.prepare(
      "SELECT funded_atomic,disbursed_atomic,refunded_atomic FROM challenge_funds WHERE id=?",
    )
      .bind(fundId)
      .first<{
        funded_atomic: string;
        disbursed_atomic: string;
        refunded_atomic: string;
      }>();
    if (
      !fund ||
      BigInt(fund.funded_atomic) -
        BigInt(fund.disbursed_atomic) -
        BigInt(fund.refunded_atomic) <
        BigInt(input.amountAtomic)
    )
      throw new Response(
        "Ngân sách còn lại không đủ. Giao dịch chưa được gửi.",
        { status: 409 },
      );
    const client = createSolanaClient({ urlOrMoniker: rpc as "devnet" });
    const { value: latestBlockhash } = await client.rpc
      .getLatestBlockhash({ commitment: "confirmed" })
      .send();
    const recipient = address(input.recipientWallet);
    const mint = address(env.SOLANA_USDC_MINT || DEVNET_USDC);
    const instructions =
      input.asset === "sol"
        ? [
            getTransferSolInstruction({
              source: vault,
              destination: recipient,
              amount: BigInt(input.amountAtomic),
            }),
          ]
        : getTransferTokensInstructions({
            feePayer: vault,
            authority: vault,
            mint,
            sourceAta: await getAssociatedTokenAccountAddress(
              mint,
              vault.address,
            ),
            destination: recipient,
            destinationAta: await getAssociatedTokenAccountAddress(
              mint,
              recipient,
            ),
            amount: BigInt(input.amountAtomic),
          });
    const bytes = await transactionToBase64WithSigners(
      createTransaction({
        version: "legacy",
        feePayer: vault,
        instructions,
        latestBlockhash,
        computeUnitLimit: 300000,
      }),
    );
    const signature = bs58.encode(Buffer.from(bytes, "base64").subarray(1, 65));
    await env.DB.prepare(
      "UPDATE legacy_vault_operations SET transaction_b64=?,signature=? WHERE operation_key=?",
    )
      .bind(bytes, signature, operationKey)
      .run();
  }
  const op = await env.DB.prepare(
    "SELECT * FROM legacy_vault_operations WHERE operation_key=?",
  )
    .bind(operationKey)
    .first<Op>();
  if (op?.payload_hash !== payloadHash)
    throw new Response(
      "Thông tin giao dịch đã thay đổi; cần đối soát giao dịch cũ.",
      { status: 409 },
    );
  if (!op.signature || !op.transaction_b64)
    throw new Response(
      "Giao dịch đang chuẩn bị hoặc bị gián đoạn trước khi gửi. Cần kiểm tra nhật ký trước khi thử lại.",
      { status: 409 },
    );
  const status = await escrowRpc<{
    value: Array<{ err: unknown; confirmationStatus: string } | null>;
  }>(rpc, "getSignatureStatuses", [
    [op.signature],
    { searchTransactionHistory: true },
  ]);
  if (status.value[0]?.err)
    throw new Response(
      "Giao dịch cũ bị từ chối. Cần đối soát mã " +
        op.signature +
        "; không tạo khoản chuyển mới tự động.",
      { status: 409 },
    );
  if (status.value[0]?.confirmationStatus === "finalized") return op.signature;
  if (!status.value[0]) {
    try {
      await escrowRpc(rpc, "sendTransaction", [
        op.transaction_b64,
        { encoding: "base64", preflightCommitment: "confirmed", maxRetries: 3 },
      ]);
    } catch {
      /* Unknown response: keep original bytes and signature, never build a replacement. */
    }
  }
  throw new Response(
    "Đang xác nhận giao dịch " +
      op.signature +
      ". Bấm kiểm tra lại để đồng bộ; không cần gửi thêm tiền.",
    { status: 409 },
  );
}

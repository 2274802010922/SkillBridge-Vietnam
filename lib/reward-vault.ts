import bs58 from "bs58";
import { address, createKeyPairSignerFromBytes, createSolanaClient, createTransaction, insertReferenceKeyToTransactionMessage, transactionToBase64, type Instruction, type TransactionSigner } from "gill";
import { getTransferSolInstruction } from "gill/programs";
import { getAssociatedTokenAccountAddress, getTransferTokensInstructions } from "gill/programs/token";
import { DEFAULT_USDC_DEVNET_MINT, type UsdcAmount } from "./payments.ts";

export type RewardAsset = "usdc" | "sol";

export type RewardVaultEnvironment = {
  SOLANA_RPC_URL?: string;
  SOLANA_USDC_MINT?: string;
  SOLANA_REWARD_VAULT_SECRET?: string;
  SOLANA_AUTHORIZED_SIGNER_SECRET?: string;
};

function secretBytes(value: string | undefined) {
  if (!value) throw new Error("Reward Vault chưa được cấu hình. Hãy thêm SOLANA_REWARD_VAULT_SECRET trên Vercel.");
  try {
    const bytes = value.trim().startsWith("[") ? Uint8Array.from(JSON.parse(value) as number[]) : bs58.decode(value.trim());
    if (bytes.length !== 64) throw new Error("invalid length");
    return bytes;
  } catch {
    throw new Error("SOLANA_REWARD_VAULT_SECRET phải là keypair 64 byte hợp lệ.");
  }
}

export async function rewardVaultSigner(environment: RewardVaultEnvironment) {
  const secret = environment.SOLANA_REWARD_VAULT_SECRET || environment.SOLANA_AUTHORIZED_SIGNER_SECRET;
  return createKeyPairSignerFromBytes(secretBytes(secret));
}

export async function rewardVaultAddress(environment: RewardVaultEnvironment) {
  return (await rewardVaultSigner(environment)).address;
}

export function solanaPayRewardUrl(input: { recipientWallet: string; amount: string; asset: RewardAsset; reference: string; mint?: string; label?: string; message?: string }) {
  const params = new URLSearchParams({ amount: input.amount, reference: input.reference, label: input.label || "SkillBridge Reward Vault", message: input.message || "Nạp quỹ challenge SkillBridge" });
  if (input.asset === "usdc") params.set("spl-token", input.mint || DEFAULT_USDC_DEVNET_MINT);
  return `solana:${input.recipientWallet}?${params.toString()}`;
}

function solana(environment: RewardVaultEnvironment) {
  return createSolanaClient({ urlOrMoniker: (environment.SOLANA_RPC_URL || "devnet") as "devnet" });
}

async function recentBlockhash(environment: RewardVaultEnvironment) {
  const { value } = await solana(environment).rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  return value;
}

/** Build an unsigned Solana Pay-compatible Devnet funding transfer for a connected wallet. */
export async function buildRewardFundingTransaction(environment: RewardVaultEnvironment, input: { senderWallet: string; asset: RewardAsset; amount: UsdcAmount; reference: string }) {
  const sender = address(input.senderWallet);
  const vault = await rewardVaultSigner(environment);
  const latestBlockhash = await recentBlockhash(environment);
  let instructions: Instruction[];
  if (input.asset === "sol") {
    instructions = [getTransferSolInstruction({ source: sender as unknown as TransactionSigner, destination: vault.address, amount: BigInt(input.amount.atomic) })];
  } else {
    const mint = address(environment.SOLANA_USDC_MINT || DEFAULT_USDC_DEVNET_MINT);
    const sourceAta = await getAssociatedTokenAccountAddress(mint, sender);
    const destinationAta = await getAssociatedTokenAccountAddress(mint, vault.address);
    instructions = getTransferTokensInstructions({ feePayer: sender as unknown as TransactionSigner, mint, authority: sender as unknown as TransactionSigner, sourceAta, destination: vault.address, destinationAta, amount: BigInt(input.amount.atomic) });
  }
  const transaction = createTransaction({ version: "legacy", feePayer: sender as unknown as TransactionSigner, instructions, latestBlockhash });
  return { transaction: transactionToBase64(insertReferenceKeyToTransactionMessage(address(input.reference), transaction)), vaultWallet: vault.address };
}

/** Send a real Devnet payout or refund from the dedicated Reward Vault after human confirmation. */
export async function sendRewardVaultTransfer(environment: RewardVaultEnvironment, input: { recipientWallet: string; asset: RewardAsset; amountAtomic: string }) {
  const vault = await rewardVaultSigner(environment);
  const recipient = address(input.recipientWallet);
  const latestBlockhash = await recentBlockhash(environment);
  let instructions: Instruction[];
  if (input.asset === "sol") {
    instructions = [getTransferSolInstruction({ source: vault, destination: recipient, amount: BigInt(input.amountAtomic) })];
  } else {
    const mint = address(environment.SOLANA_USDC_MINT || DEFAULT_USDC_DEVNET_MINT);
    const sourceAta = await getAssociatedTokenAccountAddress(mint, vault.address);
    const destinationAta = await getAssociatedTokenAccountAddress(mint, recipient);
    instructions = getTransferTokensInstructions({ feePayer: vault, mint, authority: vault, sourceAta, destination: recipient, destinationAta, amount: BigInt(input.amountAtomic) });
  }
  const transaction = createTransaction({ version: "legacy", feePayer: vault, instructions, latestBlockhash, computeUnitLimit: 400_000, computeUnitPrice: 1 });
  return solana(environment).sendAndConfirmTransaction(transaction, { commitment: "confirmed" });
}

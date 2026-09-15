import { Buffer } from "buffer";
import { address, AccountRole, type Instruction } from "gill";
import { getAssociatedTokenAccountAddress } from "gill/programs/token";
import {
  assertEscrowDevnet,
  buildEscrowTransaction,
  disc,
  ESCROW_PROGRAM,
  escrowRpc,
  hashBytes,
  readEscrowAccount,
  submissionAddress,
  SYSTEM,
  TOKEN,
  DEVNET_USDC,
} from "./challenge-escrow.ts";

const ATA = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const meta = (key: string, role: AccountRole = AccountRole.READONLY) => ({
  address: address(key),
  role,
});

export async function inspectReward(
  rpc: string,
  escrow: string,
  recipient: string,
) {
  address(escrow);
  address(recipient);
  await assertEscrowDevnet(rpc);
  const state = await readEscrowAccount(rpc, escrow, "Escrow");
  if (!state) throw new Error("Không tìm thấy quỹ trên Solana Devnet.");
  const receipt = await submissionAddress(escrow, recipient);
  const submission = await readEscrowAccount(rpc, receipt, "Submission");
  if (
    submission &&
    (submission.escrow !== escrow || submission.student !== recipient)
  )
    throw new Error("Bản ghi nhận thưởng không khớp quỹ hoặc ví.");
  return {
    program: ESCROW_PROGRAM,
    escrow,
    recipient,
    receipt,
    state,
    submission,
    claimable:
      !!submission &&
      submission.decision === 3 &&
      !submission.paid &&
      [1, 2].includes(state.state),
  };
}

export async function independentClaimInstructions(
  rpc: string,
  escrow: string,
  recipient: string,
  ataPayer: string = recipient,
): Promise<Instruction[]> {
  const inspected = await inspectReward(rpc, escrow, recipient);
  if (!inspected.claimable)
    throw new Error(
      inspected.submission?.paid
        ? "Phần thưởng đã được nhận."
        : "Ví chưa có phần thưởng có thể nhận.",
    );
  const accounts = [
    meta(recipient, AccountRole.WRITABLE_SIGNER),
    meta(escrow, AccountRole.WRITABLE),
    meta(inspected.receipt, AccountRole.WRITABLE),
    meta(recipient, AccountRole.WRITABLE),
  ];
  const instructions: Instruction[] = [];
  if (inspected.state.mint !== SYSTEM) {
    if (inspected.state.mint !== DEVNET_USDC)
      throw new Error("Mint không được công cụ này hỗ trợ.");
    const source = String(
      await getAssociatedTokenAccountAddress(
        address(DEVNET_USDC),
        address(escrow),
      ),
    );
    const destination = String(
      await getAssociatedTokenAccountAddress(
        address(DEVNET_USDC),
        address(recipient),
      ),
    );
    instructions.push({
      programAddress: address(ATA),
      accounts: [
        meta(ataPayer, AccountRole.WRITABLE_SIGNER),
        meta(destination, AccountRole.WRITABLE),
        meta(recipient),
        meta(DEVNET_USDC),
        meta(SYSTEM),
        meta(TOKEN),
      ],
      data: new Uint8Array([1]),
    });
    accounts.push(
      meta(source, AccountRole.WRITABLE),
      meta(destination, AccountRole.WRITABLE),
      meta(TOKEN),
    );
  }
  instructions.push({
    programAddress: address(ESCROW_PROGRAM),
    accounts,
    data: await disc("global:claim_award"),
  });
  return instructions;
}

export async function buildIndependentClaim(
  rpc: string,
  escrow: string,
  recipient: string,
) {
  const instructions = await independentClaimInstructions(
    rpc,
    escrow,
    recipient,
  );
  return buildEscrowTransaction(rpc, recipient, instructions);
}

export async function verifyCommittedText(text: string, hash: string) {
  return (await hashBytes(text)).toString("hex") === hash.toLowerCase();
}

export async function upgradeAuthority(rpc: string) {
  const loader = "BPFLoaderUpgradeab1e11111111111111111111111";
  const program = await escrowRpc<{
    value: {
      owner: string;
      executable: boolean;
      data: [string, string];
    } | null;
  }>(rpc, "getAccountInfo", [
    ESCROW_PROGRAM,
    { encoding: "base64", commitment: "finalized" },
  ]);
  if (
    !program.value ||
    !program.value.executable ||
    program.value.owner !== loader
  )
    throw new Error("Chưa xác minh được cơ chế nâng cấp.");
  const bytes = Buffer.from(program.value.data[0], "base64");
  if (bytes.length < 36 || bytes.readUInt32LE(0) !== 2)
    throw new Error("Program account không hợp lệ.");
  const bs58 = (await import("bs58")).default;
  const dataAddress = bs58.encode(bytes.subarray(4, 36));
  const result = await escrowRpc<{
    value: { owner: string; data: [string, string] } | null;
  }>(rpc, "getAccountInfo", [
    dataAddress,
    { encoding: "base64", commitment: "finalized" },
  ]);
  if (!result.value || result.value.owner !== loader)
    throw new Error("ProgramData không hợp lệ.");
  const data = Buffer.from(result.value.data[0], "base64");
  if (data.length < 13 || data.readUInt32LE(0) !== 3)
    throw new Error("ProgramData không hợp lệ.");
  if (data[12] === 0) return { upgradeable: false, authority: null };
  if (data[12] !== 1 || data.length < 45)
    throw new Error("ProgramData thiếu quyền nâng cấp.");
  return { upgradeable: true, authority: bs58.encode(data.subarray(13, 45)) };
}

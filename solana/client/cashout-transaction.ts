import { address, blockhash, createTransaction, getTransactionDecoder, getCompiledTransactionMessageDecoder,
  insertReferenceKeyToTransactionMessage, transactionToBase64, type TransactionSigner } from "gill";
import { getAssociatedTokenAccountAddress, getTransferTokensInstructions } from "gill/programs/token";

export type CashoutSigningExpectation = {
  network: string; mint: string; recipientWallet: string; amountAtomic: string; reference: string;
};

/** Reconstruct the only permitted transfer; reject extra instructions/accounts before wallet signing. */
export async function assertCashoutTransaction(bytes: Uint8Array, senderWallet: string, expected: CashoutSigningExpectation) {
  if (expected.network !== "solana:devnet") throw new Error("Cashout requires Solana Devnet");
  const actual = getTransactionDecoder().decode(bytes);
  const message = getCompiledTransactionMessageDecoder().decode(actual.messageBytes);
  if (message.version !== "legacy" || message.header.numSignerAccounts !== 1 || String(message.staticAccounts[0]) !== senderWallet)
    throw new Error("Unexpected cashout signer or transaction version");
  const sender = address(senderWallet), mint = address(expected.mint), recipient = address(expected.recipientWallet);
  const sourceAta = await getAssociatedTokenAccountAddress(mint, sender);
  const destinationAta = await getAssociatedTokenAccountAddress(mint, recipient);
  const unsigned = createTransaction({ version: "legacy", feePayer: sender as unknown as TransactionSigner,
    latestBlockhash: { blockhash: blockhash(message.lifetimeToken), lastValidBlockHeight: BigInt(0) },
    instructions: getTransferTokensInstructions({ feePayer: sender as unknown as TransactionSigner, mint,
      authority: sender as unknown as TransactionSigner, sourceAta, destination: recipient, destinationAta, amount: BigInt(expected.amountAtomic) }) });
  const wire = transactionToBase64(insertReferenceKeyToTransactionMessage(address(expected.reference), unsigned));
  // Expected is unsigned; compare the decoded message, independent of zeroed signature encoding.
  const expectedBytes = Uint8Array.from(atob(wire), c => c.charCodeAt(0));
  const expectedMessage = getTransactionDecoder().decode(expectedBytes).messageBytes;
  if (actual.messageBytes.length !== expectedMessage.length || actual.messageBytes.some((value, index) => value !== expectedMessage[index]))
    throw new Error("Transaction does not match the accepted cashout quote. Do not sign.");
}

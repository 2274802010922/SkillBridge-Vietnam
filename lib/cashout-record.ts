import { solanaPayCashoutUrl } from "./cashout.ts";

export type CashoutRow = {
  id: string; beneficiary_id: string | null; wallet_address: string; amount_usdc: string; amount_atomic: string;
  estimated_vnd: string; fee_vnd: string; net_vnd: string; provider: string; payout_method: string; payout_provider: string;
  execution_mode: string; payout_status: string; status: string;
  provider_reference: string; rate_vnd: string | null; provider_fee_vnd: string | null; network_fee_vnd: string | null;
  quote_expires_at: string | null; rate_source: string; settlement_wallet: string | null; reference_key: string | null;
  submitted_tx: string | null; payment_tx: string | null; payment_observed_at: string | null; verification_state: string; last_error_code: string | null;
  bank_reference: string | null; terms_accepted_at: string | null; created_at: string; updated_at: string;
  bank_code: string | null; account_last4: string | null; account_holder_masked: string | null;
  beneficiary_payout_method: string | null; beneficiary_payout_provider: string | null; beneficiary_verification_state: string | null;
};

export const SELECT_CASHOUT = `
  SELECT s.*, b.bank_code, b.account_last4, b.account_holder_masked,
    b.payout_method AS beneficiary_payout_method,
    b.payout_provider AS beneficiary_payout_provider,
    b.verification_state AS beneficiary_verification_state
  FROM cashout_sessions s
  LEFT JOIN cashout_beneficiaries b ON b.id = s.beneficiary_id
`;

export function serializeCashout(row: CashoutRow, mint: string) {
  return {
    id: row.id, beneficiaryId: row.beneficiary_id, walletAddress: row.wallet_address,
    amountUsdc: row.amount_usdc, amountAtomic: row.amount_atomic, grossVnd: row.estimated_vnd,
    feeVnd: row.fee_vnd, netVnd: row.net_vnd, provider: row.provider, payoutMethod: row.payout_method,
    payoutProvider: row.payout_provider, executionMode: row.execution_mode, payoutStatus: row.payout_status,
    providerReference: row.provider_reference,
    status: row.status, rateVnd: row.rate_vnd, providerFeeVnd: row.provider_fee_vnd,
    networkFeeVnd: row.network_fee_vnd, quoteExpiresAt: row.quote_expires_at, rateSource: row.rate_source,
    settlementWallet: row.settlement_wallet, reference: row.reference_key, submittedTx: row.submitted_tx, paymentTx: row.payment_tx,
    paymentObservedAt: row.payment_observed_at, verificationState: row.verification_state,
    lastErrorCode: row.last_error_code, bankReference: row.bank_reference, termsAcceptedAt: row.terms_accepted_at,
    beneficiary: row.beneficiary_id ? {
      id: row.beneficiary_id, bankCode: row.bank_code, accountLast4: row.account_last4,
      accountHolderMasked: row.account_holder_masked, payoutMethod: row.beneficiary_payout_method,
      payoutProvider: row.beneficiary_payout_provider, verificationState: row.beneficiary_verification_state,
    } : null,
    solanaPayUrl: row.settlement_wallet && row.reference_key ? solanaPayCashoutUrl({ settlementWallet: row.settlement_wallet, amountUsdc: row.amount_usdc, reference: row.reference_key, mint }) : null,
    explorerUrl: row.payment_tx ? `https://explorer.solana.com/tx/${encodeURIComponent(row.payment_tx)}?cluster=devnet` : null,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

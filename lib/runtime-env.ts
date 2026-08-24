import { getDatabase } from "./d1-adapter";

export type RuntimeEnvironment = Cloudflare.Env & {
  AI_PROVIDER?: string;
  TOKENROUTER_API_KEY?: string;
  TOKENROUTER_BASE_URL?: string;
  TOKENROUTER_MODEL?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  AI_MAX_INPUT_TOKENS?: string;
  AI_MAX_OUTPUT_TOKENS?: string;
  AI_TOP_K_PER_RUBRIC?: string;
  AI_CHUNK_TOKENS?: string;
  AI_CHUNK_OVERLAP_TOKENS?: string;
  AI_DAILY_LIMIT_PER_REVIEWER?: string;
  SOLANA_USDC_MINT: string;
  SOLANA_REWARD_VAULT_SECRET?: string;
  CHALLENGE_BADGE_BOND_SOL?: string;
  CASHOUT_SANDBOX_VND_RATE?: string;
  CASHOUT_PROVIDER_FEE_BPS?: string;
  CASHOUT_NETWORK_FEE_VND?: string;
  CASHOUT_QUOTE_TTL_SECONDS?: string;
  CASHOUT_DEVNET_SETTLEMENT_WALLET?: string;
  CASHOUT_WEBHOOK_SECRET?: string;
};

export const env = {
  get DB() { return getDatabase(); },
  get AI_PROVIDER() { return process.env.AI_PROVIDER; },
  get OPENAI_API_KEY() { return process.env.OPENAI_API_KEY; },
  get OPENAI_ASSESSMENT_MODEL() { return process.env.OPENAI_ASSESSMENT_MODEL; },
  get TOKENROUTER_API_KEY() { return process.env.TOKENROUTER_API_KEY; },
  get TOKENROUTER_BASE_URL() { return process.env.TOKENROUTER_BASE_URL; },
  get TOKENROUTER_MODEL() { return process.env.TOKENROUTER_MODEL; },
  get GEMINI_API_KEY() { return process.env.GEMINI_API_KEY; },
  get GEMINI_MODEL() { return process.env.GEMINI_MODEL; },
  get AI_MAX_INPUT_TOKENS() { return process.env.AI_MAX_INPUT_TOKENS; },
  get AI_MAX_OUTPUT_TOKENS() { return process.env.AI_MAX_OUTPUT_TOKENS; },
  get AI_TOP_K_PER_RUBRIC() { return process.env.AI_TOP_K_PER_RUBRIC; },
  get AI_CHUNK_TOKENS() { return process.env.AI_CHUNK_TOKENS; },
  get AI_CHUNK_OVERLAP_TOKENS() { return process.env.AI_CHUNK_OVERLAP_TOKENS; },
  get AI_DAILY_LIMIT_PER_REVIEWER() { return process.env.AI_DAILY_LIMIT_PER_REVIEWER; },
  get SOLANA_RPC_URL() { return process.env.SOLANA_RPC_URL; },
  get SOLANA_FEE_PAYER_SECRET() { return process.env.SOLANA_FEE_PAYER_SECRET; },
  get SOLANA_ISSUER_SECRET() { return process.env.SOLANA_ISSUER_SECRET; },
  get SOLANA_AUTHORIZED_SIGNER_SECRET() { return process.env.SOLANA_AUTHORIZED_SIGNER_SECRET; },
  get SOLANA_REWARD_VAULT_SECRET() { return process.env.SOLANA_REWARD_VAULT_SECRET; },
  get CHALLENGE_BADGE_BOND_SOL() { return process.env.CHALLENGE_BADGE_BOND_SOL; },
  get CASHOUT_SANDBOX_VND_RATE() { return process.env.CASHOUT_SANDBOX_VND_RATE; },
  get CASHOUT_PROVIDER_FEE_BPS() { return process.env.CASHOUT_PROVIDER_FEE_BPS; },
  get CASHOUT_NETWORK_FEE_VND() { return process.env.CASHOUT_NETWORK_FEE_VND; },
  get CASHOUT_QUOTE_TTL_SECONDS() { return process.env.CASHOUT_QUOTE_TTL_SECONDS; },
  get CASHOUT_DEVNET_SETTLEMENT_WALLET() { return process.env.CASHOUT_DEVNET_SETTLEMENT_WALLET; },
  get CASHOUT_WEBHOOK_SECRET() { return process.env.CASHOUT_WEBHOOK_SECRET; },
  get SOLANA_USDC_MINT() { return process.env.SOLANA_USDC_MINT || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"; },
} as RuntimeEnvironment;

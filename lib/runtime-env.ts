import { getDatabase } from "./d1-adapter";

export type RuntimeEnvironment = Cloudflare.Env & {
  AI_PROVIDER?: string;
  TOKENROUTER_API_KEY?: string;
  TOKENROUTER_BASE_URL?: string;
  TOKENROUTER_MODEL?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  SOLANA_USDC_MINT: string;
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
  get SOLANA_RPC_URL() { return process.env.SOLANA_RPC_URL; },
  get SOLANA_FEE_PAYER_SECRET() { return process.env.SOLANA_FEE_PAYER_SECRET; },
  get SOLANA_ISSUER_SECRET() { return process.env.SOLANA_ISSUER_SECRET; },
  get SOLANA_AUTHORIZED_SIGNER_SECRET() { return process.env.SOLANA_AUTHORIZED_SIGNER_SECRET; },
  get SOLANA_USDC_MINT() { return process.env.SOLANA_USDC_MINT || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"; },
} as RuntimeEnvironment;

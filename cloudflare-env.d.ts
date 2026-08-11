declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    EVIDENCE: R2Bucket;
    OPENAI_API_KEY?: string;
    OPENAI_ASSESSMENT_MODEL?: string;
    SOLANA_RPC_URL?: string;
    SOLANA_FEE_PAYER_SECRET?: string;
    SOLANA_ISSUER_SECRET?: string;
    SOLANA_AUTHORIZED_SIGNER_SECRET?: string;
  }
}

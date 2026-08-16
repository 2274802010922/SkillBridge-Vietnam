declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    EVIDENCE: R2Bucket;
    OPENAI_API_KEY?: string;
    OPENAI_ASSESSMENT_MODEL?: string;
    TOKENROUTER_API_KEY?: string;
    TOKENROUTER_BASE_URL?: string;
    TOKENROUTER_MODEL?: string;
    TURSO_DATABASE_URL?: string;
    TURSO_AUTH_TOKEN?: string;
    BLOB_READ_WRITE_TOKEN?: string;
    SOLANA_RPC_URL?: string;
    SOLANA_FEE_PAYER_SECRET?: string;
    SOLANA_ISSUER_SECRET?: string;
    SOLANA_AUTHORIZED_SIGNER_SECRET?: string;
  }
}

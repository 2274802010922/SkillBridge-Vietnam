import type { SolanaSignInInput } from "@solana/wallet-standard-features";

export const PRODUCT_CHAIN = "solana:devnet";

type AuthenticationSignInInput = {
  address: string;
  domain: string;
  statement: string;
  uri: string;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
  requestId: string;
  resources: readonly string[];
};

export function createAuthenticationSignInInput({
  address,
  domain,
  statement,
  uri,
  nonce,
  issuedAt,
  expirationTime,
  requestId,
  resources,
}: AuthenticationSignInInput): SolanaSignInInput {
  return {
    address,
    domain,
    statement,
    uri,
    version: "1",
    // Authentication proves wallet ownership. Chain-specific actions remain on
    // PRODUCT_CHAIN, but binding the signature to a cluster makes Phantom
    // reject users who are currently viewing a different cluster.
    nonce,
    issuedAt,
    expirationTime,
    requestId,
    resources,
  };
}

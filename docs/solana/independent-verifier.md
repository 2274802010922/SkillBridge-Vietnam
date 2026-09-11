# Independent verification and claims

The static tool is built from [source](../../tools/claim-verifier/main.ts).
It does not call Next.js routes, Turso, Blob or the SkillBridge login service.
It does require an available, trustworthy Solana Devnet RPC and a compatible wallet.

## Wallet-first lookup

Enter a wallet, or connect a browser wallet to fill it automatically. Viewing does
not request a signature. The page discovers submission receipts and SkillBridge
SAS credentials on Devnet, then shows active badges, allocated rewards and claims.
Unknown/RPC-error states show a dash and an error, never a misleading zero.

Wallet links use `?wallet=ADDRESS&lang=vi` (or `en`). Share/QR produces the same
lookup link. A localhost URL is only useful on your own machine; use the public
HTTPS deployment when sharing. Challenge fund links use `?escrow=ADDRESS` so users
only need to enter their wallet.

The default lookup and claim need no SkillBridge API. **Load challenge names** is
an optional metadata request: it loads public challenge titles from the configured
SkillBridge site and does not change any verified score, amount or claim right.
Private/unavailable titles retain their IDs. The API only returns public challenge
descriptions; it does not return private submissions or wallet profiles.

## Issuers and badge counts

At build time, `SKILLBRIDGE_TRUSTED_ISSUERS` may contain public authority addresses
separated by commas. If empty, the build derives the public authority from the
existing `SOLANA_ISSUER_SECRET`. Only public addresses are embedded in the bundle;
the secret is never exported. After issuer rotation, explicitly list historical
authorities if their credentials should remain included. Redeploy after changing it.

Missing issuer configuration produces an unavailable count. It does not classify
arbitrary NFTs or self-issued lookalikes as SkillBridge badges. Expired/paused
credentials stay visible with their status but do not count as active.

Discovery supports the current SkillBridge SAS layout (wallet is the first Borsh
string), not all possible SAS schemas. Deleted attestations cannot be discovered
by a fresh wallet scan. Their historical existence would require a separate indexer;
this UI does not invent a revoked-history count or an issuance date. Expiry is read
from the attestation. Scans above 500 results report a limit rather than a partial
total. A provider must support filtered getProgramAccounts; other RPCs can be chosen
under Advanced checks.

## Challenge fund transparency

The challenge detail sidebar now displays the fund address, copy button, Explorer
link and **Check my rewards** link. Program escrow totals are read at finalized
commitment with a timestamp. RPC failure is shown as unverified. Legacy shared
vaults are explicitly labeled; their whole-wallet balance is not represented as
the budget of one challenge. Public read access follows challenge visibility.

## Run separately from the product

```sh
npm ci
npm run preview:verifier
```

Open **http://127.0.0.1:3219**. Do not start Next.js. The preview server serves
only three static files and exposes no API. Stop it with Ctrl+C.

For another static host, run `npm run build:verifier` and deploy the complete
`public/claim-verifier` directory over HTTPS. On Vercel, `npm run build`
already includes it at **/claim-verifier/index.html**. This path is convenient,
but independently hosting the same bundle is what removes the website dependency.
Never put a private RPC API key in the public bundle.

## Manual test

1. Create and fund a new Devnet monetary challenge in SkillBridge.
2. Let the student submit and the human reviewer record/allocate an award.
3. Save the escrow address, recipient address and downloadable terms/submission/
   result manifests. Keep copies of the actual files; the manifests contain hashes,
   not the original uploads.
4. Close the SkillBridge website. Open the separately hosted tool.
5. Enter the escrow and recipient. The tool checks Devnet genesis, program ownership,
   account discriminators, fixed recipient and finalized allocation.
6. Compare a downloaded manifest. Change a character in its committed text:
   verification must fail. For approved results, the nested score hash is checked too.
7. Connect the recipient wallet and sign once. SOL uses the direct claim; USDC also
   creates the recipient's associated token account if necessary.
8. Wait, then choose **Kiểm tra lại**. After payment, claiming is disabled.
   Reload and check again: the paid state comes from the chain, not browser storage.

An in-flight signature is kept locally. If RPC fails after signing, inspect that
signature instead of signing another transaction. Unknown signatures are held for
manual diagnosis; this version does not automatically clear an expired unknown
signature. A failed transaction can be retried; a successful claim cannot be replayed.

## A second organization verifies a credential

Use the SAS section with attestation address, candidate wallet, challenge ID,
minimum score and **issuer authority addresses you independently trust**.
It checks finalized SAS-owned accounts, matching schema/credential, schema pause,
expiry, authorized signer and the selected policy. Removal of an attestation fails
verification. No automatic trust list is supplied.

This is not proof of employment or a guarantee of issuer honesty. Issuer authority
and signer rotation may change the current verification outcome.

## Evidence and limits

The [live proof](evidence/independent-claim-proof.json) records a recipient-only
0.001 SOL Devnet claim at slot 495181217 with no SkillBridge API requests.
Claim and unused-fund refund were rechecked as finalized after an RPC 429;
neither transaction was resent. The test recipient's remaining Devnet balance was
not recovered after the process stopped. No mainnet assets were involved.

SOL was exercised live. USDC account construction and wrong-owner, wrong-network,
already-paid and mismatched-recipient failures have local tests. This release
does not claim a live test for every wallet extension or a smart-contract audit.

To create another test lifecycle intentionally:
```sh
# Set ESCROW_PROOF_PAYER_PATH to your dedicated Devnet keypair file first.
npm run test:independent:devnet
```
This command spends Devnet SOL and creates fresh test accounts. It is not run in CI.
If interrupted, inspect the public progress file and chain before running it again.

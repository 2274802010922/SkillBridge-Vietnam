# Solana evidence

[Program code](../../solana/README.md) · [Escrow runbook](escrow-runbook.md) ·
[Stored evidence JSON](evidence/escrow-devnet-proof.json)

New: [independent claim and issuer verification](independent-verifier.md),
with [recipient-only live claim evidence](evidence/independent-claim-proof.json).

The evidence file records a Devnet escrow lifecycle: funding, reviewer acceptance,
publication, submission, assessment, allocation, claim and refund. It is historical
evidence from that run, not a claim that CI replays these transactions.

- [Escrow program on Explorer](https://explorer.solana.com/address/HBasPxF9R83pCFdeuvvXW5Hpt7hSMTXghLRSzeAEGpDB?cluster=devnet)
- [Opportunity Gate on Explorer](https://explorer.solana.com/address/AuXFxfT41YMsG53euEB1tFjyUiMLKxfucQnYX4jhekCE?cluster=devnet)

Use the signatures in the JSON with Solana Explorer's Devnet network selected.
Check status, signer, accounts and amounts rather than relying on a screenshot.

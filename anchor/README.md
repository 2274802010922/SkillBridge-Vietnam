# SkillBridge Opportunity Gate

This Anchor program keeps employer policies and immutable access receipts on Solana.
The SkillBridge verifier first validates the Solana Attestation Service credential
on devnet, then signs `record_access`. The program independently enforces the
configured verifier, active policy, score threshold, unique credential/subject
receipt, and policy authority.

The temporary system program ID is replaced by `anchor keys sync` before the first
deployment. Build and test from WSL because the Solana and Anchor toolchains are
installed there.


# Start here: SkillBridge

**One sentence:** SkillBridge turns student work into human-reviewed, verifiable
skills and funded rewards.

[Open the app](https://404-eight-rho.vercel.app/) ·
[Architecture](../architecture/README.md) · [Solana evidence](../solana/README.md)

## Suggested review sequence

1. Explore the landing page to understand the three participant groups.
2. Use [the role checklist](../testing/manual-test-guide.md) to exercise the
   authenticated product. Each wallet has server-enforced permissions.
3. Inspect a challenge brief and its funding evidence.
4. Review a submission manually; AI is optional and cannot make the official decision.
5. Inspect credentials and the separate allocation/claim flow.
6. Cross-check public transaction signatures in the [evidence record](../solana/evidence/escrow-devnet-proof.json).
7. Follow the student's progress page, then use a credential to apply to a second organization.
8. Inspect [sponsored-claim evidence](../solana/evidence/sponsored-claim-proof.json) and
   [revocation-aware eligibility evidence](../solana/evidence/opportunity-application-proof.json).

See the [competition upgrade runbook](../testing/competition-upgrades.md) for the exact
role flow, fee-sponsor configuration and manual OpenRouter check. Screenshots with QA
labels demonstrate interface behavior; the separate evidence JSON files record live Devnet runs.

The `/sandbox` route is a separate role simulator. It is not evidence that a
live provider or financial transfer succeeded.

## Where to read code

| Question | Location |
| --- | --- |
| How is the interface organized? | [frontend/](../../frontend/README.md) |
| Where are API permissions enforced? | [backend/](../../backend/README.md) |
| What does the smart contract enforce? | [solana/](../../solana/README.md) |
| What has been tested? | [tests/](../../tests/README.md) |
| How is it deployed? | [Vercel guide](../deployment/vercel.md) |

## Boundaries worth checking

AI suggestions are evidence-linked and subject to human review. New monetary
escrows and legacy reward funds are distinct paths. On-chain activity targets
Devnet; bank/VND reconciliation is sandbox. The escrow program remains upgradeable.

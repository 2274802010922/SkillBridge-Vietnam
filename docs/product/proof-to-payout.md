# Proof-to-payout: the product contract

SkillBridge turns a published commitment and human-reviewed work into a reward
that its recipient can claim without the SkillBridge backend.

## Golden flow

1. **Business:** write the brief, rubric, amount, slots and deadlines; choose the
   primary and backup reviewer. Optional AI checks clarity, not funding or eligibility.
2. **Reviewers:** accept their on-chain roles. The business funds and publishes the
   escrow. Its terms hash commits the exact stored terms snapshot.
3. **Student:** upload files and notes, save them, then sign the fixed submission
   version. The commitment includes the note, evidence JSON and file SHA-256 values.
4. **Human reviewer:** score manually, or request one cached AI draft and review it.
   AI cannot approve a submission, allocate money or sign a transaction.
5. **Reviewer wallet:** records the official result on-chain and allocates the award.
   A positive assessment alone is not an allocation.
6. **Student:** claim to the fixed recipient wallet. After allocation, the independent
   tool constructs and sends the claim using only public RPC, even without our API.
7. **Business B:** read the SAS credential directly and apply its own trusted issuer,
   wallet, challenge and minimum-score policy.

## Who still has authority?

| Actor | Can do | Cannot do through the current program |
| --- | --- | --- |
| Business | Configure before publishing; fund; recover permitted unused funds | Redirect an allocated student's reward to another wallet |
| Primary / backup reviewer | Act according to accepted roles and contract deadlines | Let AI sign or allocate on their behalf |
| Student | Commit their submission; sign a claim to their wallet | Claim another student's allocation or claim twice |
| SkillBridge backend | Store private files; prepare transactions; register submissions with its registrar | Required to execute an already allocated independent claim |
| Program upgrade authority | Upgrade the deployed program | Be represented as absent or as a trustless guarantee |

The last row is an important trust assumption, not a solved audit claim. The tool
reads and displays the current upgrade authority. We do not revoke or transfer it
as part of this release.

**Explicit stalled-review policy:** if neither primary nor backup acts, unresolved
funds remain pending. No automatic refund, replacement reviewer or AI arbitration
is introduced. This can lock funds indefinitely and must be understood before funding.

## What blockchain does and does not prove

- It enforces custody, accepted roles, allocation, recipient and replay protection
  under the deployed program.
- It lets a holder compare a terms/submission/result snapshot against a public hash.
- It does not prove that human scoring is fair, a submission is truthful, or an
  issuer is trustworthy. A credential is only accepted under the verifier's policy.
- Private files remain off-chain. Hashes are commitments, not file backups.
- The backend/registrar is still involved before on-chain submission registration.
  Independence is demonstrated for **verification and allocated claims**, not every
  operation of the product.
- Rejected results commit the decision; the existing null final-result hash does
  not prove the text of rejection feedback. Approved result exports additionally
  verify the exact approved score document.

## Scope boundaries

New monetary challenges use program escrow. Existing legacy vault records keep
their rules; this release does not migrate their funds or reset the database.
VND cashout remains an explicitly separate sandbox, not the core proof.

See [independent verification](../solana/independent-verifier.md) and
[OpenRouter configuration](../deployment/openrouter.md).

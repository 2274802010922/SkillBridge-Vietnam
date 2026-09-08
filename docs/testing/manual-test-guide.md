# Test by role / Kiểm thử theo vai trò

Use separate wallets for business owner, primary reviewer, backup reviewer and
student. Keep the network on Devnet. Use the
[escrow runbook](../solana/escrow-runbook.md) for deadline-sensitive operations.

| Role | Task | Expected result |
| --- | --- | --- |
| Visitor | Open landing and change VI/EN | Interface changes language |
| Student | Sign in and update profile | Profile belongs to the signed-in wallet |
| Business | Create a challenge draft | Brief, criteria, access and reward are preserved |
| Business | Configure and fund program escrow | Deposit evidence and immutable configuration are visible |
| Reviewers | Accept assigned roles | Correct wallets are acknowledged |
| Business | Publish | Publication follows funding and required signatures |
| Student | Join and submit files/notes | Evidence is private and linked to the challenge |
| Student | Sign program admission where required | Submission snapshot is fixed |
| Reviewer | Start manual scoring without AI | Official assessment can proceed |
| Reviewer | Approve and record results | Decision is recorded; reward allocation remains explicit |
| Reviewer | Allocate award after the deadline | Fixed recipient and amount are recorded |
| Student | Claim reward | Transaction proof matches the designated wallet |
| Visitor | Open credential verification | Status and evidence are shown within access rules |

## Recovery and layout

- Reload after sending a transaction; verify its existing signature before paying again.
- Switch routes quickly; loading placeholders must resolve to the correct page.
- Check long titles, wallet addresses, file names and VI/EN at 375–1440px.
- Refresh wallet balances; retain the previous successful balance while loading.
- Test invalid sessions, missing permissions and empty lists.
- Treat the VND bank leg as sandbox even when the Devnet transfer succeeds.

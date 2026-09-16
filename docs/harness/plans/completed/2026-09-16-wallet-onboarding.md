# Beginner wallet onboarding

Status: completed
Updated: 2026-09-16
Baseline: `3a90c6b`, clean working tree

## Goal

Help a first-time user install a wallet, return and verify ownership without
slowing down existing wallet users. Commit/push requested in the side conversation.

## Context

The existing WalletSignIn empty state only suggests installing a wallet and reloading.
Wallet Standard discovery and SIWS/server session verification already exist.

## Constraints

Keep light-terminal styling, VI/EN, auth protocol, permissions and funds unchanged.
No new dependencies, embedded wallets, database changes or secret collection.
Preserve unrelated/main-thread changes. Mobile apps and real wallets need manual QA.

## Decisions

Inline optional three-step guide; Phantom and Solflare official downloads.
Phantom browse universal link uses only the current origin, safe internal return
path and language. Other wallets get copy/open-browser guidance, not invented links.

## Completed

- Surveyed existing auth UI, repository instructions and official wallet sources.
- VI/EN optional guide, official downloads, device override and discovery recovery.
- Phantom HTTPS browse handoff, manual copy fallback, safe return path and language restoration.
- Preserved signature/session behavior; added cancellation messaging and compact mobile layout.
- Eight helper tests and one rendered-auth regression; local Chrome interaction checks.

## In progress

None in implementation scope.

## Remaining

- Owner acceptance on real desktop extensions and physical iPhone/Android after deploy,
  plus the proposed five-person usability study. These were not simulated as live success.

## Relevant files

- [Wallet UI](../../../../frontend/components/wallet/wallet-sign-in.tsx)
- [Auth page](../../../../app/auth/page.tsx)
- [Frontend guide](../../../../frontend/README.md)
- [Manual acceptance and browser findings](../../../testing/wallet-onboarding.md)

## Known issues

App installation cannot be reliably detected from mobile browsers. Browser switches
do not share sessions. Never infer installation or authentication from a download click.

## Validation

2026-09-16: check:repo, lint, production build and 131 tests passed during implementation.
Eight onboarding helper tests plus one auth-render test supplement 122 existing tests.
Browser QA: empty registry, guide navigation, VI/EN, safe copy URL, late wallet
registration/removal and cancellation using explicitly fake Wallet Standard providers.
No onboarding auth requests observed. Responsive checks covered 375px, 812px landscape,
1440px and enlarged text; see the linked QA guide for limitations.

## Handoff notes

No chain transfers, wallet creation or credential access is authorized by onboarding QA.
Commit/push requested; final Git state records publication. No environment variables needed.

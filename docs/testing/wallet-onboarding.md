# Beginner wallet onboarding QA

Scope: optional install/create/connect guidance at `/auth`; unchanged SIWS/server
authentication. No embedded wallet, deposit, new environment variable or migration.

## Automated checks

- `node --experimental-strip-types --test tests/solana/wallet-onboarding.test.ts`
  covers official download URLs, safe return paths, secret-free handoff query,
  Phantom browse encoding, discovery selection, device hints, cancellation and VI/EN parity.
- `npm test` also covers auth page rendering and the existing SIWS/session regressions.
- `npm run check:repo`, `npm run lint`, `git diff --check`.

## Browser checks performed locally (2026-09-16)

- Chrome with no wallet: optional guide and official Phantom/Solflare links.
- Guide steps, skip/back, computer/phone selection and language switching.
- Phone-style copy-address flow retains `/challenge/qa-invite` and selected language.
- Fresh `/auth?...&lang=en` loads English after hydration and stores the preference.
- Injected **QA-only Wallet Standard fixtures**: late registration, removed selection,
  fallback to the remaining wallet, consent checkbox and cancelled connection feedback.
  These are not real Phantom/Solflare authentication results.
- No auth API requests while reading the guide or cancelling the fixture connection.
- Emulated 375px portrait, 812px landscape and 1440px desktop: no horizontal overflow.
  Enlarged text checked; step controls adjusted to avoid label/number overlap.

## Manual acceptance after deployment — not yet verified

1. Desktop Chrome, no extension: open the official download, install/create/unlock
   a wallet, return and check again. Reload when the browser requires it.
2. Use a zero-balance test wallet: connect and sign ownership, without buying SOL.
   Confirm the backend session and intended challenge/invitation destination.
3. iPhone + Android: test the HTTPS Phantom browse link, installation return path,
   signature flow and cancelled app opening. An emulated viewport cannot test OS links.
4. Solflare: follow the manual in-wallet-browser/copy-address instructions. Other
   discovered compatible Wallet Standard wallets must still use the existing flow.
5. Test clipboard denied, browser storage unavailable, slow network and rejected signatures.
6. Check VI/EN, keyboard focus and mobile text enlargement. Do not accept a download
   click as proof of installation, connection or authentication.
7. Observe five new users without coaching; record completion and where help was needed.

App/extension installation, real-wallet signatures on physical phones and the
five-person usability study have **not** been performed by this implementation task.
Local HTTP deliberately does not show a Phantom app-opening link; use deployed HTTPS.

## Official references

- [Phantom download](https://phantom.com/download)
- [Phantom wallet creation](https://help.phantom.com/articles/8071074929043)
- [Phantom browse universal link](https://docs.phantom.com/phantom-deeplinks/other-methods/browse)
- [Solflare download](https://www.solflare.com/download/)

Never forward session cookies, auth nonces or signatures in the mobile URL. Wallet
browser sessions authenticate independently. The guided UI cannot detect every
installed mobile app and never automatically launches a signing/payment request.

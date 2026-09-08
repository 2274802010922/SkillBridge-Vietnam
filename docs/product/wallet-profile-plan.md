# Wallet profiles — implementation contract

## Scope

- One existing authenticated user identity per wallet; wallet address is the stable share URL. Changing UI role or wallet application does not change the profile. Linking wallets and account recovery are out of scope.
- `/app/profile`: edit, avatar upload, preview as visitor, copy saved share URL. `/u/[wallet]`: public/unlisted profile or a generic unavailable page. No profile PII in metadata.
- Reuse users.display_name/profile_kind and talent_profiles.headline/bio/visibility/availability. wallet_profiles stores optional education, work, links, self-reported skills, portfolio and sharing preferences. No financial data in profile responses.
- New users default private. Existing Talent Pool visibility remains as previously chosen. Unlisted is accessible by address but excluded from Talent Pool; it is not a secret link. Visibility is enforced server-side on every read. Responses are no-store; share pages noindex.
- Credentials are read from the same table as Skill Passport. Public achievements require explicit opt-in, an active/unexpired credential, an approved assessment, a public non-deleted challenge. Private challenge content and raw files never become public through the profile. Credentials display score, issuer and proof link; no AI draft is published.
- Organization affiliations require active membership and a separate opt-in. They attest membership within SkillBridge, not legal identity. Portfolios are explicitly supplied HTTPS links; underlying private contracts and submissions remain protected.
- Avatar is resized locally to 160px JPEG, bounded at 80KB and stored with the profile. No new storage key; no remote tracking image URLs. Updates validate all fields, reject unsafe URLs, and bind the target to the session user.

## Delivery order

1. Add additive schema and validation/data-access service, preserving the onboarding API.
2. Implement owner and public reads, private/unlisted/public updates; route Talent Pool edits to the same service.
3. Build light-terminal editor and public view, bilingual controls, private preview, upload/remove avatar, unsaved-change warning.
4. Add profile links to wallet menu, Talent Pool, reviewer view and Skill Passport.
5. Validate two-user isolation, privacy changes, partial onboarding updates, credential expiry/revocation, input validation, DB persistence and responsive layout; build/lint, commit/push.

## Manual acceptance

Use two distinct wallets A and B. A edits and reloads; B cannot edit A. Public: visitor sees chosen sections; unlisted: link works, directory excludes A; private: same link reveals no profile. Role changes do not alter profile. Disable achievement/affiliation sharing and verify visitor payload contains neither. Revoke/expire a credential and verify it stops contributing to public evidence skills. Upload/remove an avatar; test 375px and English. No Mainnet or payment transaction is required.

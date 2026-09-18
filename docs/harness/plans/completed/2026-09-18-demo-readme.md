# Demo Day: self-contained README

Status: completed

## Goal

Judges can scroll either README to understand users, UI, workflow, architecture,
blockchain necessity, business hypotheses, evidence, setup and limitations.

## Constraints

Documentation/assets only. Capture actual local UI using isolated QA fixtures.
No invented traction, live AI, bank payouts or chain evidence. Preserve source attribution.
English and Vietnamese have equivalent structure. Commit/push authorized.

## Execution

1. Audit current README and verified implementation boundaries.
2. Capture current landing/auth plus challenge, submission, review, credential,
   portfolio, comparison and cashout where fixture data permits; inspect every image.
3. Rewrite both READMEs with visible screenshots, three primary Mermaid diagrams,
   inline expandable technical flows, business hypotheses and an evidence matrix.
4. Validate image formats/links, Mermaid syntax/rendering and documentation checks.
5. Update architecture index, asset provenance, changelog/state; review and commit/push.

## Completed

- Current repo clean at 50aeb32; README test count stale at 151 (latest validated suite 168).
- Captured the current build as WebP gallery assets with QA labels.
- Rebuilt both READMEs as self-contained judge-facing product pages.
- Added system, proof, AI, independent claim, portfolio and recovery diagrams.
- Updated architecture index, assets provenance, changelog and current state.
- Parsed all local documentation links through `npm run check:repo`; rendered UI captures were inspected at 1440px and generated as WebP.

## Remaining

No implementation remains. Owner-run live AI/Devnet checks remain separate acceptance work.

## Relevant files

README.md, README.vi.md, docs/assets/showcase/, docs/architecture/README.md,
tests/helpers/preview-evidence.ts, tests/helpers/preview-offramp.ts.

## Validation

`npm run check:repo` passed with 53 documentation files; rendered HTML and harness tests
passed 20/20. Current product regression is unchanged by this documentation-only work;
last full regression was 168/168.

## Handoff

Read current diff before resume. No live transactions or external AI requests authorized.

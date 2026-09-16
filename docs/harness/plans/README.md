# Execution plans

Plans retain execution state across sessions, not product specifications or chat.
Use one for multi-session/multi-module features, migrations, financial/auth changes
or work with meaningful sequencing, risk or blockers. Skip plans for tiny fixes.

## Lifecycle

1. Copy [PLAN_TEMPLATE](PLAN_TEMPLATE.md) to `active/YYYY-MM-DD-short-name.md`.
   Record the requested scope and code/Git baseline; do not invent unrequested work.
2. Use exactly one `Status: active` or `Status: blocked` line. Keep the file flat
   in [active/](active/); `.gitkeep` retains the folder when it has no plans.
3. Update completed/in-progress/remaining steps as implementation changes, not
   just at the end. Capture exact files, validation results and the next action.
   If blocked, say what is missing and which safe work can still proceed.
4. When the scoped work and acceptance checks finish, set `Status: completed`
   and move the same file to [completed/](completed/). Abandoned work may move
   there with `Status: cancelled` and an explicit reason. Never copy into both.
5. Update incoming links and CURRENT_STATE when appropriate. New follow-up scope
   gets a new plan referencing the old one, not a rewritten historical completion.

No product feature was confirmed active during the initial harness survey.
Directory contents, not this sentence, determine subsequent active work.

## Keep the boundaries clear

- Temporary choices belong here; durable decisions belong in [ADRs](../decisions/README.md).
- Link relevant existing docs instead of duplicating architecture or code.
- Finished plans and older `docs/product/*-plan.md` are historical intent,
  never automatic proof of current behavior or an approved backlog.
- A failed/unrun required check remains a gap; a passing mock test is not a
  live provider/Devnet result. Record external checks separately.
- `npm run check:repo` checks required harness files, local link targets and plan
  status/location consistency. It cannot judge whether claims are accurate.

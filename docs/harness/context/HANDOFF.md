# Session handoff

Use the repository root (`package.json` beside `AGENTS.md`). No memory service,
conversation export or machine-specific Codex configuration is required.

## Where each kind of knowledge belongs

| Knowledge | Owner |
| --- | --- |
| Current checkpoint and confirmed gaps | [CURRENT_STATE](CURRENT_STATE.md) |
| Temporary execution state, blockers and next step | [Active plan](../plans/README.md) |
| Durable architecture choice and trade-offs | [ADR](../decisions/README.md) |
| How a subsystem works | Existing guide via [docs index](../../README.md) |
| Release summary / detailed changes | [CHANGELOG](../../../CHANGELOG.md) / Git |

Link to the owner instead of copying its content. Keep CURRENT_STATE roughly a
1–2 minute read. Date observations and distinguish code/test evidence from live
deployment evidence. A file's existence does not prove a feature was tested.

## Old session: leave a recoverable checkpoint

1. Complete the task or stop at an explicit checkpoint; inspect staged/unstaged
   changes and preserve work belonging to others. Do not hide unfinished work.
2. Run relevant validation from [the test guide](../../testing/README.md). Record
   command, result, date, tested baseline/working-tree changes and skipped checks.
   Do not copy environment values or raw private logs into docs.
3. Update the active plan: done, in progress, remaining, exact relevant paths,
   blocker and next safe action. Distinguish implementation completion from
   external validation pending. Move it to completed only when its scope is done.
4. Refresh CURRENT_STATE if the project checkpoint changed; preserve confirmed
   unresolved gaps. Update an owning guide/ADR/CHANGELOG only as appropriate.
5. Review `git diff`, `git diff --cached`, `git status --short` and new files;
   run `npm run check:repo` and `git diff --check` after final documentation edits.
6. Commit/push only when requested. Otherwise report that changes are local:
   another checkout will not receive an uncommitted handoff automatically.

## New session: restore only the needed context

1. Read root [AGENTS.md](../../../AGENTS.md), then CURRENT_STATE and the docs index.
2. Inspect active plan filenames; read only the plan matching the user's task.
   If none matches, state that no active task is confirmed; do not resume an
   arbitrary completed/historical plan. Ask for scope if it is missing.
3. Read the relevant module README, nested instructions and task guides.
   For chain work (including backend/verifier integration), read
   [solana/AGENTS.md](../../../solana/AGENTS.md) explicitly.
4. Inspect `git status --short`, both diffs and recent commits. Compare their
   baseline to the checkpoint; inspect the relevant implementation/tests.
5. Resolve stale documentation against evidence; report uncertainty rather than
   guessing. Summarize current state, active work and the next safe action.
6. Continue the requested task, then hand off using the checklist above.

For a tiny copy/layout fix, use only its module context; no full-repository audit
or execution plan is required. Blockchain evidence files are historical receipts,
not permission to rerun transactions or proof of today's account state.

## Copyable new-session prompt

```text
Khôi phục ngữ cảnh SkillBridge-Vietnam từ repository, không dựa vào chat cũ.
Đọc AGENTS.md, docs/harness/context/CURRENT_STATE.md và docs/README.md. Kiểm tra git
status, diff staged/unstaged và recent commits. Chọn active plan liên quan;
chỉ đọc docs, README module và AGENTS cục bộ cần cho việc: [mô tả nhiệm vụ].
Đối chiếu code/tests hiện tại, phân biệt kết quả cũ với kiểm chứng mới.
Tóm tắt trạng thái, việc đang dở, blocker và bước tiếp theo trước khi sửa.
Nếu không có active task được xác nhận, đừng tự tạo roadmap. Khi kết thúc,
cập nhật handoff/plan/state nếu cần. Không commit, push, deploy hay chạy
giao dịch live khi chưa được yêu cầu cho nhiệm vụ này.
```

Nested guidance follows the [official AGENTS.md discovery rules](https://learn.chatgpt.com/docs/agent-configuration/agents-md).
The root instructions explicitly route cross-module chain work to its local guide;
do not assume every nested file is automatically loaded from the repository root.

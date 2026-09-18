# Handoff — Off-ramp adapters

Updated: 2026-09-18 (Asia/Saigon)
Checkpoint: OFFRAMP-06 — implementation 91198d6 committed and pushed to origin/main.
Baseline: `d8615d110430b108846112e55d16125dbf45e9cc` trên `main`.

## Đọc trước khi tiếp tục

Đây là checkpoint của workstream, không phải toàn bộ lịch sử chat. Thiết kế, file
map và acceptance ở [completed execution plan](../../plans/completed/2026-09-18-offramp-adapters.md).
Quy trình chung ở [HANDOFF](../../context/HANDOFF.md); trạng thái toàn dự án ở
[CURRENT_STATE](../../context/CURRENT_STATE.md). Không tạo bản thứ hai chỉ khác hoa/thường
với `HANDOFF.md` trong cùng thư mục trên Windows.

## Người dùng đã yêu cầu gì?

- Chuẩn bị plan chi tiết cho off-ramp và handoff để đổi account vẫn tiếp tục được.
- Kiến trúc adapter: USDC Devnet thật trên chain, VND payout chỉ mô phỏng.
- App không tự nhận là sàn/đơn vị cung cấp dịch vụ được cấp phép; không dùng P2P.
- Tương lai tích hợp provider hợp lệ; không bịa API, quyền truy cập hay production readiness.
- Làm từng phần, ghi checkpoint ngay; repository là nguồn sự thật, không cần chat cũ.

Quyền hiện tại: người dùng xác nhận triển khai toàn bộ plan rồi commit/push.
Không bao gồm deploy/mainnet/VND thật, tạo/fund ví hay gửi giao dịch live mới.

## Trạng thái dự án có thể dùng ngay

- Release gần nhất d8615d1: evidence portfolios, comparison, career AI trial,
  credential recovery; không triển khai lại những tính năng này.
- Next.js/Vercel, Turso/local SQLite; repo chia app/frontend/backend/solana/shared.
- Off-ramp hiện là sandbox nội bộ. Chưa thấy Circle/CPN trong flow được review.
- Giữ verification finalized, signature recovery, FX reference và nhãn sandbox.
- Các vấn đề baseline đã xử lý: bỏ fallback reward vault cho lệnh mới; chuyển
  simulation sang adapter; webhook v2 và inbox recovery; payout failure riêng biệt.
- Không nhầm tài liệu/Sites legacy với deployment Vercel hiện tại.

## Latest checkpoint (ghi đè phần này sau mỗi slice)

| Mục | Trạng thái |
| --- | --- |
| Đã xong | S1–S4 implementation; 16 fault/domain tests + HTTP journey; VI/EN reconciliation view QA at 375/768/1024/1440 |
| Đang làm | No active implementation; owner-run post-deploy acceptance remains |
| Product code đã đổi | Committed/pushed in 91198d6; compare new diffs before resuming |
| File chạm trong checkpoint | backend/services/cashout; HTTP cashout/webhook/build; database runtime/Drizzle/migration; solana/server/payments.ts |
| Validation mới | Final npm test with STANDARD production build 168/168 pass; lint/check/tsc pass. Browser no overflow/clipped details or console errors; recheck preserves reconciliation |
| Validation lịch sử | Release d8615d1 có 151 tests và CI pass; không phải bằng chứng cho refactor |
| Blocker | Earlier sandbox/font restrictions resolved after environment permission update; standard build now passes. Live wallets/provider/Vercel unrun |
| Running jobs/processes | No live transactions; QA preview stopped; no build/test jobs left running |
| Git publication | Feature commit 91198d6 pushed to origin/main as O Bao Tri. This handoff records that publication; Git log identifies its own docs follow-up |
| Next safe action | Owner sets dedicated public wallet if missing, redeploys/verifies intended Git revision, follows docs/testing/offramp.md; never resend an uncertain deposit |

Live RPC/funding/provider calls have not run. GitHub push succeeded; Vercel deployment
status and real-wallet acceptance have not been inspected or claimed.

## Bước đầu cho account/session mới

Chạy từ repository root `work/skillbridge-vietnam` (không nhầm với thư mục cha `toi`):

```powershell
git status --short --branch
git diff --stat
git diff --cached --stat
git log -8 --oneline
```

1. Đọc [root AGENTS](../../../../AGENTS.md), CURRENT_STATE và docs index.
2. Đọc file này, plan active, backend README; đọc `solana/AGENTS.md` trước chain work.
3. So sánh HEAD/diff với checkpoint. Khi có code mới chưa được note, kiểm tra chính
   code đó và cập nhật note; đừng reset/revert để ép tree giống snapshot.
4. Đọc sâu file map S0. Nếu đã được yêu cầu implement, chạy baseline tests trên
   dữ liệu cô lập rồi viết reproducer; không truy vấn/reset DB production.
5. Tóm tắt current state và next action ngắn, rồi tiếp tục đúng bước chưa xong.

## Quy tắc take-note liên tục

- Trước slice: ghi mục tiêu, file dự kiến và rủi ro/cần kiểm tra; đây là ý định,
  không phải việc đã hoàn thành.
- Sau thay đổi logic/schema/provider hoặc một lượt test: cập nhật latest checkpoint,
  đánh dấu bước tương ứng trong plan. Đừng chờ full feature xong mới ghi.
- Trước đổi account, toolchain, module hoặc dừng lâu: ghi diff, lỗi còn lại, command
  chính xác để tái hiện, next action, background process nếu có và file chưa lưu.
- Phân biệt passed/failed/not run, mocked/live; ghi baseline đã kiểm tra. Nếu sửa code
  sau test thì test cũ chưa chứng minh bản mới, phải ghi rõ.
- Ghi quyết định dài hạn bằng ADR khi thực sự chốt; không chép kiến trúc vào nhiều file.
- Mỗi checkpoint chỉ giữ thông tin cần tiếp tục. Lịch sử chi tiết thuộc Git/plan,
  không chép transcript hoặc raw logs lớn. Không ghi secret, tài khoản ngân hàng hay PII.
- Khi bị ngắt đột ngột có thể chưa kịp note. Git diff/code/tests luôn phải được đối
  chiếu lại; không thể bảo đảm tuyệt đối không mất working memory chưa ghi ra file.

Mẫu cập nhật:

```text
Checkpoint: OFFRAMP-XX, timestamp + timezone
HEAD / branch:
Scope vừa xử lý:
Files changed:
Completed (có evidence):
Partial / failing / not run:
Validation: exact command, outcome, baseline
Decision / assumption changed:
Next exact step:
Running jobs / external requests chưa rõ kết quả:
Git state / commit-push status:
```

## Đổi account hoặc đổi máy

- Cùng máy/cùng checkout: file và diff local vẫn còn; mở đúng repo và dùng prompt dưới.
- Máy/checkout khác: file chưa commit không tự xuất hiện từ GitHub. Cần người dùng
  cho phép commit/push hoặc chuyển các file/patch liên quan, gồm file mới chưa tracked.
  Không cho rằng `git diff` đơn thuần chứa cả untracked files.
- `.env.local`, private key và credential provider không đi theo Git; cấu hình lại
  qua kênh an toàn nếu thực sự cần. Không dán chúng vào handoff/chat.
- Quyền GitHub/private repo của account/máy mới cần kiểm tra riêng; không lưu token
  đăng nhập trong tài liệu. Không đổi Git author `O Bao Tri` ngoài yêu cầu người dùng.

## Prompt khôi phục (copy)

```text
Khôi phục workstream off-ramp SkillBridge từ repository, không dựa vào chat cũ.
Đọc AGENTS.md, docs/harness/context/CURRENT_STATE.md,
docs/harness/workstreams/offramp/handoff.md và active plan được liên kết.
Kiểm tra git status, staged/unstaged diff, untracked files và recent commits.
Đối chiếu code trước khi tin checkpoint; giữ nguyên thay đổi chưa commit.
Tóm tắt bước đã xong, phần dở, test đã/ chưa chạy và next step.
Sau đó tiếp tục việc tôi yêu cầu: [chỉ review / triển khai S0 rồi các bước đã duyệt].
Cập nhật handoff và plan sau mỗi slice/test quan trọng, trước khi dừng.
Không mainnet, VND thật, production provider giả, tự gửi tiền, commit/push/deploy
khi chưa có yêu cầu rõ cho nhiệm vụ hiện tại. Không tuyên bố fixture là live.
```

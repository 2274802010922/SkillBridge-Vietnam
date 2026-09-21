# Demo reliability — kế hoạch sửa toàn bộ luồng

Status: active
Updated: 2026-09-21
Baseline: main `0c6c4ff`; có báo cáo audit và checkpoint local chưa commit.

## Goal

Hoàn tất các hướng sửa F01–F16 trong [audit](../../../testing/demo-audit-2026-09-20.md),
để người dùng thực hiện được luồng từ kết nối ví đến claim, hiểu rõ bước tiếp theo
và phục hồi được khi mạng/nhà cung cấp lỗi. Implementation đã được người dùng yêu cầu
kèm commit/push. Local verification và live acceptance là hai cổng riêng.

## Context

Đọc [Current State](../../context/CURRENT_STATE.md),
[escrow runbook](../../../solana/escrow-runbook.md),
[Solana rules](../../../../solana/AGENTS.md) và audit trước khi triển khai.
Audit đã chạy build + 168 tests, lint, check:repo, các HTTP/RPC probe biệt lập.
Test xanh không bao phủ hết luồng demo trên Vercel.

## Constraints

- Giữ deployment Next.js/Vercel và ranh giới frontend/backend/Solana hiện tại.
- Mặc định sửa tích hợp và UX; chưa nâng cấp Anchor program, đổi IDL/layout/PDA.
- Không reset DB, đổi migration ID, di chuyển tiền hoặc sửa deadline của quỹ cũ.
- Quỹ legacy và program escrow giữ nguyên nguồn tiền và cơ chế ký tương ứng.
- Chấm tay độc lập; AI không phê duyệt, phân bổ hay chuyển tiền.
- Giữ chính sách backup sau review deadline; nếu cả hai không xử lý, quỹ chờ.
- Không hứa đảm bảo ngưỡng điểm bằng contract: contract hiện tin quyết định reviewer.
- Không tự động phát lại giao dịch mới khi transaction cũ chưa rõ kết quả.
- Người dùng đã yêu cầu triển khai và commit/push. Không tự ký giao dịch bằng ví người dùng hoặc thay điều khoản đã cam kết.

## Decisions

1. API trả trạng thái nghiệp vụ và các hành động được phép kèm lý do; frontend
   render thống nhất. HTTP 200 chỉ là thành công đọc request, không tự là paid.
2. Tách official assessment, reward eligibility, on-chain decision, allocation,
   claim và credential. Một người được duyệt bản chấm chưa chắc đạt ngưỡng thưởng.
3. Chỉ finalized chain state và kiểm tra account/config mới xác nhận quyền tài chính.
4. Thiết kế UI dựa trên trạng thái và vai trò; không chỉ ẩn nút khi chưa đủ điều kiện.
5. Giao dịch record/allocate/claim giữ chữ ký và các bước hiện tại của program;
   UX giảm chuyển trang nhưng không tự cấp quyền hoặc rút ngắn deadline.
6. Retry read có giới hạn; retry write phải có khóa nghiệp vụ và recovery.
7. Dữ liệu cũ cần đối soát: không âm thầm sửa quyết định đã ghi on-chain.

## Completed

- [x] Audit F01–F16 với phân biệt lỗi tái hiện và rủi ro theo code.
- [x] Lập thứ tự sửa, tiêu chí nghiệm thu và cổng kiểm chứng deployment.

## In progress

Implementation F01–F16 đã có trong working tree; final regression và publication
đang hoàn tất. Live Vercel acceptance vẫn cần owner thực hiện theo runbook.
Xem [checkpoint](../../workstreams/demo-reliability/handoff.md) và
[acceptance](../../../testing/demo-reliability-acceptance.md).

## Remaining

### A. Khóa baseline và dựng kiểm thử hành vi — F15

- [x] Xác định commit/deployment đang test, schema hiện tại và các test fixture.
- [x] Đưa HTTP probes của audit thành regression chạy được, DB/RPC biệt lập.
- [x] Thay assertion indexOf có thể nhận -1 bằng test hành vi thực.
- [x] Tạo ma trận actor/time/state cho escrow: primary, backup, student, outsider;
      trước/đúng/sau hai deadline; chưa funding, published, finalized, refunded.
- [x] Theo từng đợt fix thêm negative case trước rồi kiểm tra pass sau.

Nghiệm thu: bài 0 điểm, duplicate milestone signature, zero-funded sync,
paid escrow và plain-text error đều có test bắt được lỗi baseline.
Không chỉ kiểm tra chuỗi code hoặc sự tồn tại của nút.

### B. Sửa nền xử lý lỗi, ví và request — F06, F13, F14

- [x] Error envelope `code/message/retryable/requestId`, giữ status/header hợp lệ;
      không phá các response không phải JSON có chủ ý như file/download.
- [x] Parser frontend nhận JSON/text/HTML, timeout và mất session; không lộ URL/key.
- [x] Các action sửa trong reviews/submissions/payouts reset busy trong finally, báo ngay cạnh thao tác.
- [x] Bind wallet/account ký với session; thay ví phải có xác minh phù hợp.
- [x] Sửa selection extension bị gỡ; kiểm tra cả sign-only và sign-and-send.
- [x] Chống request chồng, response cũ ghi đè selection; polling dừng ở tab ẩn,
      backoff có giới hạn khi rate limit; giảm genesis/account reads trùng.
- [x] Recovery lưu signature/operation ID, expiry và signed bytes khi có;
      đọc bằng chứng trước, rebroadcast cùng bytes khi còn hợp lệ.
- [x] Khi sign-and-send không trả signature: hướng dẫn đối soát lịch sử, không
      tự gọi ký lần hai. Chỉ chuẩn bị lại sau khi chứng minh không thể settle.

Nghiệm thu: mô phỏng 401/403/429/500/HTML/timeout/mất mạng không kẹt nút,
không gửi thêm tiền; chuyển challenge/bài nộp nhanh không hiển thị nhầm dữ liệu.

### C. Hoàn thiện quỹ và trả thưởng thống nhất — F01–F05

- [x] Backend xác định role, phase, deadline, khả năng hành động và lý do bị chặn.
      Dùng thời gian server cho hướng dẫn; contract là nơi quyết định cuối.
- [x] Hai nút refresh/signature dùng chung kết quả: đang kiểm tra, xác minh lúc nào,
      đã đọc quỹ, đủ quỹ hay còn chờ, thông báo kế tiếp cụ thể.
- [x] Signature phải thuộc network/account/program mong đợi. Khi có operation ID,
      đối chiếu action và các account/receipt tương ứng; xử lý cả loaded addresses
      nếu chấp nhận transaction versioned. Missing transaction giữ pending.
- [x] Phân biệt postcondition: funded đúng ngân sách; consent đúng bit;
      publish đúng phase; result đúng receipt/hash/decision; allocation đúng ví;
      claim paid đúng receipt. Không dùng Boolean(account) làm thành công chung.
- [x] Dùng kết quả sync trả về để tránh GET dư; giữ freshness/slot, không lấy
      snapshot cũ làm kết luận mới.
- [x] Đọc điểm chính thức và ngưỡng trong điều khoản đã cam kết. Approved dưới
      ngưỡng hiển thị không đủ điều kiện và không build eligible/allocate.
- [x] Chưa có ngưỡng/kết quả tin cậy hoặc DB khác cam kết: cần đối soát,
      không mặc định cho qua. Không ghi lại quyết định on-chain đã immutable.
- [x] Payout read model nhận diện legacy/program, lấy trạng thái đúng nguồn.
      Claim ngoài website cũng được nhận ra qua receipt; không bắt buộc phải có
      signature trong DB để công nhận paid. Chỉ hiện tx link khi biết tx thật.
- [x] Trang Trả thưởng hiện các bước: đã chấm → ghi kết quả → phân bổ → nhận.
      Actor không có quyền thấy tên/ví actor cần tiếp tục và deadline liên quan.
- [x] Cho reviewer đúng quyền thao tác ngay trong khu vực trả thưởng hoặc mở
      deep-link đúng challenge/submission; Quỹ thưởng là chi tiết/bằng chứng.
- [x] Cảnh báo khi chốt toàn bộ kết quả còn bài đạt chưa chọn: chốt state=2 sẽ
      kết thúc khả năng allocate theo contract hiện tại. Không chốt tự động.

Nghiệm thu: primary xử lý trong cửa sổ hợp lệ, backup xử lý sau hạn; sai ví,
chưa hết hạn, chưa đủ điểm, quỹ hết suất đều có lý do. Claim chỉ một lần,
các màn hình đồng nhất paid và ngân sách. Cấp credential không chặn claim.

### D. Bất biến bài nộp và upload — F07, F12

- [x] INSERT/DELETE file kiểm tra state/lock/version trong write nguyên tử,
      không chỉ SELECT trước await upload. Khóa submit và manifest cùng snapshot.
- [x] Chặn thay đổi metadata/ghi chú/file sau signing, kể cả callback đến muộn.
- [x] Callback idempotent; verify identity/path/hash theo snapshot và chính sách
      kích thước trước dùng để ký/đánh giá; không tin SHA client là bằng chứng nội dung.
- [x] MIME fallback có kiểm tra định dạng cho Markdown/text; file khác giữ giới hạn.
- [x] Blob >4 MB chỉ báo hoàn tất khi metadata xuất hiện. Poll bounded/retry,
      hiển thị đang hoàn tất; không cần upload lại chỉ vì callback chậm.
- [x] Blob không gắn được DB được cleanup an toàn nếu không có tham chiếu,
      hoặc ghi nhận để cleanup sau; không xóa evidence của bài đã khóa.

Nghiệm thu: Markdown MIME rỗng, PDF nhỏ/lớn, callback lặp/chậm và upload/delete
đồng thời submit. Hash manifest đã ký không đổi; không mất file khi retry.

### E. Chuẩn bị issuer và cấp chứng nhận — F08, F06

- [x] Bootstrap theo PDA: đọc, kiểm tra owner/schema/authority/signers, tạo phần thiếu.
- [x] Lưu checkpoint operation, khóa đồng thời và proof trước khi broadcast nếu
      thao tác server-sign; phục hồi chain thành công/DB lỗi.
- [x] Tái sử dụng issuance recovery hiện có; không lặp cấp credential mới.
- [x] UI phân biệt reviewer và credential issuer, chỉ ra actor có quyền;
      đã chấm, đã đạt ngưỡng và đã cấp chứng nhận là trạng thái riêng.

Nghiệm thu: lỗi sau tạo credential account, sau tạo schema, trước ghi DB,
hai request cùng lúc, timeout khi cấp — retry ra cùng thực thể, không cấp trùng.

### F. Đối soát hợp đồng milestone và cashout — F09, F16, F14

- [x] Mỗi milestone mới có payment intent cố định: sender/payer được chỉ định,
      recipient, mint, amount, network và reference.
- [x] Xác minh finalized, đúng intent, chữ ký chưa được dùng. Reservation và
      chuyển trạng thái paid nguyên tử; cùng signature/cùng milestone idempotent.
- [x] Xử lý transaction bị thiếu/partial/không khớp bằng pending/reconciliation;
      không trả ok nếu state không cho thanh toán hoặc UPDATE không đổi gì.
- [x] Trước migration unique, scan signature trùng dữ liệu cũ. Không xóa/chọn
      thắng tùy ý; migration additive + cơ chế báo conflict/đối soát.
- [x] Milestone legacy thiếu reference phải có nhánh recovery có điều kiện
      và chống replay; không áp quy tắc intent mới rồi làm mất đường phục hồi.
- [x] Cashout load/error/stale riêng theo history, balance, beneficiary, FX.
      Một nguồn lỗi không che mất dữ liệu khác hoặc đổi số dư thành 0.
- [x] Giữ cashout sandbox, quote hết hạn, dedicated settlement, webhook/outbox
      idempotency; không đưa triển khai payout ngân hàng thật vào đợt này.

Nghiệm thu: cùng tx cho hai milestone bị chặn; cùng request retry không phát sinh
chi trả khác; RPC/FX lỗi hiển thị rõ; các regression off-ramp hiện có vẫn đạt.

### G. AI đáng tin cậy cho demo — F10, F11

- [x] Phân loại lỗi HTTP và error object trong HTTP 200, empty/refusal,
      finish_reason=length, invalid JSON/schema/citation, quota và timeout.
- [x] Reasoning không được dùng thay nội dung kết quả chính thức.
- [x] Budget end-to-end gồm extraction, provider và persistence, có thời gian
      dự phòng trong giới hạn route; tài liệu quá lớn chuyển chấm tay có giải thích.
- [x] Cache chỉ báo thành công khi validation đạt; invalid cache giữ failure.
      Response/audit phải dùng assessment ID thật sau UPSERT.
- [x] Không âm thầm fallback model/provider hoặc retry vô hạn; retry rõ ràng,
      hữu hạn, cùng cơ chế lock và hạn mức. Timeout không được coi chưa gọi provider.
- [x] Logs provider/model, duration, usage/finish reason; error response có mã định danh;
      không ghi API key hay toàn văn bài làm.
- [ ] Thử live OpenRouter bằng dữ liệu demo khi owner kiểm tra key/model; ghi
      kết quả thật. Manual vẫn phải chạy ngay nếu AI không sẵn sàng.

Nghiệm thu: mọi nhánh lỗi có thông báo hành động được, cache lỗi không thành 200
thành công, AI không ghi đè quyết định của người, không kẹt busy.

### H. Kiểm chứng toàn luồng, tài liệu và phát hành — F15 + tất cả

- [ ] Test UI ở 375/768/1024/1440px, VI/EN; kiểm tra trạng thái/lỗi ở vị trí thao tác.
- [ ] Golden flow qua các HTTP route thật và browser: connect → configure →
      fund → primary + backup accept → publish → join/upload → student register →
      manual approve → active reviewer record → allocate → student claim.
- [ ] Nhánh phụ: AI thành công/thất bại, credential bootstrap/issue/recovery,
      independent verifier, invoice, milestone, cashout sandbox.
- [ ] Thử reload sau ký, timeout RPC, đóng ví, hủy ký, phiên hết hạn, hai tab,
      trước/đúng/sau deadline; Phantom và ít nhất một Wallet Standard khác.
- [ ] Migrations chỉ additive, test DB mới/cũ, duplicate/history conflicts.
- [ ] Chạy check:repo/lint/typecheck/npm test; local-validator escrow tests nếu
      có môi trường. Không gắn nhãn Rust/SBF/live passed nếu chưa chạy.
- [x] Sửa kichbandemo.md, kichbandemo2.md và docs/demo: đủ wallet roles/consent,
      deadlines là thời điểm cố định; review window đủ dài cho thuyết trình.
- [ ] Ghi deploy commit; smoke trên Vercel với Blob/RPC/AI thực, account đúng quyền.
      Chữ ký do owner thực hiện; ghi Explorer proof và lỗi còn lại nếu có.
- [ ] Commit theo chặng khi được yêu cầu; cập nhật CHANGELOG/README/harness dựa
      trên bằng chứng, không quảng bá capability chưa nghiệm thu.

Nghiệm thu cuối: hoàn thành hai lượt demo liên tiếp với challenge mới, một lượt
reload/phục hồi có chủ ý; không reset DB hoặc sửa trạng thái thủ công để đi tiếp.
Giữ báo cáo live riêng với automated-test report.

## Existing challenge recovery

- Đọc lại chain/DB trước mọi bước; snapshot audit có thể đã cũ.
- Challenge ngắn `f35ce8bc-c88e-4ecd-9a39-ef154cf60ecb`: tại audit đã hết
  review deadline, backup có quyền record/allocate; không yêu cầu nạp lại.
- Challenge dài `560fe762-56ae-489c-a890-45bfea1680f8`: hạn nộp 25/09,
  không thể mở review sớm bằng sửa frontend. Dùng challenge demo khác khi cần.
- Bài đã có quyết định/award on-chain không bị sửa bởi migration. Nếu quyết định
  khác DB/điểm/ngưỡng, báo conflict để đối soát, không tự rollback/đòi lại tiền.
- Không tự refund quỹ đã công bố; giữ quy tắc contract hiện hành.

## Relevant files

- `frontend/features/{escrow,payouts,reviews,submissions,cashout}/`
- `frontend/components/wallet/{wallet-payment-button.tsx,wallet-session.ts}`
- `backend/auth/auth.ts`, `backend/http/challenges/[id]/escrow/handler.ts`
- `backend/services/escrow/escrow-store.ts`, `backend/http/payouts/handler.ts`
- `backend/http/assessments/`, `backend/ai/assessment-engine.ts`
- `backend/http/submissions/[id]/files/`, `backend/storage/evidence-store.ts`
- `backend/http/contracts/[id]/handler.ts`, `backend/services/cashout/`
- `backend/http/solana/bootstrap/handler.ts`, `backend/services/credentials/`
- `solana/server/solana-credentials.ts`, `solana/client/challenge-escrow.ts`
- `backend/database/{schema.ts,schema/,migrations/}` (xác nhận đường migration trước sửa)
- `tests/integration/`, `tests/backend/`, `tests/solana/`, `.github/workflows/ci.yml`
- `kichbandemo.md`, `kichbandemo2.md`, `docs/demo/`

## Known issues

F07 được đính chính: trigger bất biến đã tồn tại trước bản sửa. Live Vercel session/logs/env, Blob callback,
các ví mobile và provider AI cần acceptance riêng. Existing test không chứng minh
tính an toàn mainnet. Nếu cần thay invariant contract, tách đề xuất nâng cấp và
migration khỏi plan này trước khi triển khai.

## Validation

- Baseline audit: build + 168 tests, lint/check:repo passed; không phải test bản sửa.
- Plan Markdown: chạy check:repo, diff check sau tạo và cập nhật liên kết.
- Đã bổ sung unit/database/HTTP regression và browser fixture QA; kết quả cuối ghi tại handoff.
- Chưa chạy live transfer/provider/Blob acceptance. Không đánh dấu hoàn tất cổng này chỉ vì test local đạt.

## Handoff notes

Implementation is authorized, including commit/push. Finish the final checks and
publish the release; then use the acceptance guide against the deployed commit.
Leave this plan active until owner-run external checks are recorded. Do not confuse
unchecked live acceptance with unimplemented product code; use the handoff matrix.

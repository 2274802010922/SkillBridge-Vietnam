# Rà soát kỹ thuật phục vụ Demo Day — 20/09/2026

Phạm vi: checkout `main` tại commit `0c6c4ff`; kiểm tra implementation của các
luồng chính, bộ test, API trên server local biệt lập, một số endpoint công khai
trên Vercel và đọc hai escrow thật trên Devnet. Đây là báo cáo chẩn đoán;
không sửa product, không gửi transaction, không thay database production.

## Kết luận

Build và 168 test hiện có chạy đạt nhưng chưa đủ bảo đảm demo end-to-end.
Các điểm đứt nằm chủ yếu ở việc nối trạng thái giữa database, smart contract,
giao diện và xử lý request thất bại. Một số hướng dẫn demo trong repo cũng thiếu
bước hoặc diễn giải khác implementation.

P1 = cần xử lý trước khi xem luồng liên quan là sẵn sàng demo.
P2 = nên xử lý tiếp để giảm kẹt thao tác và thông báo gây hiểu nhầm.
“Tái hiện” bên dưới nghĩa là bằng môi trường local biệt lập, trừ mục ghi rõ Devnet.
“Theo code” là đường đi lỗi có thể xác định trong implementation, chưa tái hiện
toàn bộ với ví thật/browser production.

## Bằng chứng Devnet hiện tại

Đọc bằng RPC `https://api.devnet.solana.com`, xác minh genesis Devnet,
`getAccountInfo` và `getProgramAccounts` ở commitment `finalized`.

| Challenge | Quỹ | Đã nạp | Phân bổ / trả | Bài nộp / có kết quả |
| --- | --- | --- | --- | --- |
| `560fe762-56ae-489c-a890-45bfea1680f8` | `24asQ3DfPpJiCkxQvZZJmuDrKj8gBFPTNBB4dbvktDcd` | 0,1 SOL | 0 / 0 | 1 / 0 |
| `f35ce8bc-c88e-4ecd-9a39-ef154cf60ecb` | `3eBGy5f3tgsyvPok9mMT7hBJiczVMNHTFQhA6XPaifDW` | 0,1 SOL | 0 / 0 | 1 / 0 |

Slot quan sát lần lượt: `501286393`, `501286394`. Cả hai có `state=1`,
`accepted=3`, receipt `decision=0`, `paid=false`. Đây là snapshot tại thời điểm
rà soát, không phải bảo đảm trạng thái giữ nguyên sau này.

- Challenge dài: hạn nộp **05:34 25/09/2026**, hạn đánh giá **05:34 30/09/2026**.
- Challenge demo ngắn: hạn nộp **09:35 19/09/2026**, hạn đánh giá **09:45 19/09/2026**.
- Các giờ trên dùng múi giờ Việt Nam.
- Reviewer chính: `6EfhKG4YdW2Tc9NZQ7MUru7gBfnxrfPRpSYMgczW8gRC`.
- Reviewer dự phòng: `4RJ9buXaAvj9Ha6SjudbpuKzRMbjGvbvH2YcA4rJf3aL`.
- Challenge demo ngắn hiện cần **ví dự phòng** ghi kết quả và phân bổ; refresh
  quỹ không làm thay đổi quyền reviewer hoặc tự ghi quyết định.
- Địa chỉ `24as...` đúng với challenge dài. Phép tính địa chỉ trước đây dùng
  nhầm chuỗi ID thiếu ký tự `e`; không có bằng chứng mapping quỹ đó bị hỏng.

## Các phát hiện

### F01 — P1: Hết hạn review làm nút biến mất, không giải thích ví nào cần tiếp tục

**Đã xác nhận bằng code và snapshot Devnet.**
[`escrow-workspace.tsx`](../../frontend/features/escrow/escrow-workspace.tsx) dòng 184
chọn `standby` sau `reviewDeadline`. Dòng 577–584 chỉ render nút khi `mayReview`.
[`lib.rs`](../../solana/programs/challenge_escrow/src/lib.rs) `check_reviewer`
cũng chuyển quyền độc quyền sang backup khi hết hạn đánh giá.

Người đang dùng ví chính thấy “Đã nộp; chờ kết quả”, không có hành động tiếp theo.
Việc quyền chuyển sang backup là thiết kế hiện có; lỗi UX là không công bố lý do.

**Sửa:** trả capability/reason từ backend; hiện thời hạn, ví đang có quyền,
trạng thái đánh giá trong DB và trạng thái ghi kết quả on-chain tách biệt.
Không đổi chính sách deadline của quỹ đã ký.

### F02 — P1: Nút “Kiểm tra lại quỹ” thành công mà không có thông báo

**Theo code, phù hợp ảnh Network 200 người dùng đã gửi.**
[`escrow-workspace.tsx`](../../frontend/features/escrow/escrow-workspace.tsx) dòng 523
chỉ gọi `load()`. `load()` cập nhật dữ liệu/clock, không đặt notice hoặc trạng thái
đang kiểm tra. Bản sửa thông báo trước chỉ xử lý nút nhập signature ở cuối trang.
Nếu dữ liệu không đổi, người dùng không nhìn thấy phản hồi nào.

**Sửa:** trạng thái chờ/kết quả/thời điểm kiểm tra ngay cạnh từng nút; giữ lý do
chưa thể trả thưởng kể cả khi đọc quỹ thành công.

### F03 — P1: Đồng bộ tồn tại account bị diễn giải thành đã nạp đủ quỹ

**Đã tái hiện qua HTTP local.**
[`escrow/handler.ts`](../../backend/http/challenges/[id]/escrow/handler.ts) dòng 391
trả `finalized: Boolean(synced.state)`; client biến giá trị đó thành `funded` và
hiện “có thể tiếp tục công bố hoặc giải ngân”. Account tồn tại không chứng minh
đã nạp đủ, còn ngân sách hoặc thao tác vừa ký đã đạt trạng thái mong đợi.

Fixture account tồn tại, `funded="0"` vẫn trả HTTP 200,
`finalized=true`, `code=ESCROW_FINALIZED`.
Ngoài ra, `getTransaction=null` đang bị gộp thành giao dịch thất bại ở dòng 332,
trong khi node có thể chưa cung cấp lịch sử transaction.

**Sửa:** phân biệt đọc account finalized, đủ quỹ và từng kết quả thao tác;
xác minh postcondition của initialize/record/allocate/claim riêng.
Giao dịch chưa đọc được phải là trạng thái có thể thử lại, không kết luận đã thất bại.

### F04 — P1: Trang Trả thưởng không phản ánh escrow đã claim

**Đã tái hiện qua HTTP local.**
[`payouts/handler.ts`](../../backend/http/payouts/handler.ts) nhận diện escrow nhưng
`payout_status/payment_tx` vẫn lấy từ `challenge_payouts` của luồng legacy.
[`payouts-workspace.tsx`](../../frontend/features/payouts/payouts-workspace.tsx) dòng 38
đếm đã trả dựa trên trường legacy này.

Sau khi fixture escrow/receipt đã `paid=true` và GET escrow đã sync, GET payouts
vẫn trả `payout_status=null`, `payment_tx=null`, `fund_status=null`.
Nút điều hướng mới tránh khóa nhầm nhưng chưa hợp nhất trạng thái trả thưởng.

**Sửa:** một read model phân biệt legacy/program, thể hiện pending review,
eligible, allocated, paid và link proof của từng loại.

### F05 — P1: Điểm dưới ngưỡng vẫn được tạo transaction đủ điều kiện nhận thưởng

**Đã tái hiện qua HTTP local, không broadcast.**
Challenge đặt `minimum_score=80`. Chấm thủ công 0/100, có nhận xét đầy đủ:
API manual trả HTTP 200 `approved`, `officialScore=0`.
Sau đó `record_result` trả transaction với byte `eligible=1`.

[`escrow/handler.ts`](../../backend/http/challenges/[id]/escrow/handler.ts) dòng 547
chỉ xét `assessment_status === "approved"`; allocation cũng chỉ kiểm tra approved.
Ngược lại [`credentials/handler.ts`](../../backend/http/credentials/handler.ts)
có kiểm tra điểm tối thiểu, tạo ra hai cách áp dụng cùng điều kiện challenge.

**Sửa:** tách phê duyệt bản chấm khỏi đạt ngưỡng thưởng; dùng điểm chính thức và
điều khoản đã cam kết cho eligibility. Contract hiện tin quyết định reviewer,
không tự tính điểm; cần mô tả đúng ranh giới này.

### F06 — P1: API trả text nhưng client đọc JSON; lỗi mạng có thể khóa nút vĩnh viễn

**Đã tái hiện response; phần busy xác định theo code.**
[`auth.ts`](../../backend/auth/auth.ts) dòng 126 trả nguyên `Response` lỗi dạng text.
Một request escrow sai ví trả 403 `text/plain` với thông điệp đúng, nhưng
[`wallet-payment-button.tsx`](../../frontend/components/wallet/wallet-payment-button.tsx)
và nhiều màn hình gọi `.json()` trực tiếp nên biến nó thành lỗi parse JSON.
Endpoint production không có session `/api/payouts`, `/api/challenges`, `/api/cashout`
cũng trả 401 text/plain; kiểm tra này không dùng session của người dùng.

`bootstrap()`/`issue()` trong reviews, `save()`/`removeFile()` trong submissions,
`release()` trong payouts thiếu `try/finally`. Fetch hoặc parse thất bại sau
`setBusy(true)` có thể để nút bị disabled cho tới khi reload.

**Sửa:** thống nhất error envelope JSON, parser dự phòng cho text/HTML,
deadline request và always-reset busy; hiển thị lý do ngay bên cạnh thao tác.

### F07 — Đính chính: trigger đã bảo vệ bài escrow; gia cố các nhánh upload

**Đính chính khi triển khai:** audit trước bỏ sót `ESCROW_TRIGGERS`. Trigger đã chặn INSERT/UPDATE/DELETE sau khi khóa escrow ở baseline; chưa có bằng chứng bypass. Bản sửa bổ sung conditional writes và xác minh bytes của completion callback. Chưa chạy interleaving trên Blob thật.
[`files/handler.ts`](../../backend/http/submissions/[id]/files/handler.ts) kiểm tra
`state` trước khi đọc/upload file nhưng INSERT/DELETE sau đó không kiểm tra lại
trạng thái bằng điều kiện SQL nguyên tử. Client-upload callback cũng tách SELECT
và INSERT. Bài có thể chuyển sang `signing` giữa hai bước.

Hậu quả có thể là danh sách file thay đổi sau khi hash bằng chứng đã cố định;
không được nhầm việc từng file có SHA-256 với toàn bộ phiên bản đã bất biến.

**Sửa:** conditional writes cùng kiểm tra khóa/version trong transaction;
cleanup Blob nếu ghi DB không còn hợp lệ; test upload/delete đồng thời với submit.

### F08 — P1: Chuẩn bị issuer chưa có recovery tương đương bước cấp credential

**Theo code; chưa tạo issuer thật để ép lỗi.**
[`solana-credentials.ts`](../../solana/server/solana-credentials.ts) dòng 65–74
gửi tạo credential rồi tạo schema; [`bootstrap/handler.ts`](../../backend/http/solana/bootstrap/handler.ts)
chỉ ghi DB sau cả hai. Nếu bước một thành công, bước hai hoặc DB thất bại, lần
thử lại tiếp tục tạo PDA cũ mà không đọc trạng thái/reconcile trước.

**Sửa:** recovery theo credential/schema PDA và xác nhận fields; lưu checkpoint.
Không nhầm cơ chế recoverable issuance hiện có với bootstrap đã recoverable.

### F09 — P1: Một transaction có thể xác nhận thanh toán hai milestone

**Đã tái hiện qua HTTP local.**
[`contracts/[id]/handler.ts`](../../backend/http/contracts/[id]/handler.ts) dòng 25–26
chỉ kiểm tra USDC đến ví freelancer; không gắn reference với milestone, không
chống dùng lại signature và không yêu cầu finalized/sender đã thống nhất.
Bảng `contract_milestones` không unique `payment_tx`.

Hai milestone approved, mỗi cái 1 USDC, cùng nhận một signature fixture 1 USDC:
cả hai API trả 200 và cả hai bản ghi trở thành `paid` với cùng `payment_tx`.
RPC chỉ được gọi `getTransaction` hai lần, không `getSignatureStatuses`.
Đây là ghi nhận thanh toán sai, không phải bằng chứng đã chuyển hai lần on-chain.

**Sửa:** transaction binding, replay guard nguyên tử, finalized và kiểm tra
điều kiện trước khi ghi; không trả ok nếu UPDATE không thay đổi bản ghi.

### F10 — P2: Lỗi OpenRouter bị gom thành “rỗng”/timeout chung chung

**Đã tái hiện bằng fetch mock, không gọi AI thật.**
[`assessment-engine.ts`](../../backend/ai/assessment-engine.ts) dòng 236–248:
HTTP 200 có `finish_reason=length`, `content=null` và HTTP 200 có error object
503 cùng bị báo “OpenRouter trả về kết quả rỗng.”; TimeoutError đi thẳng ra ngoài.
Chưa có metadata chẩn đoán an toàn về finish reason/provider request ID.

Request AI 45 giây nằm trong route 60 giây còn phải tải file, extract/chunk và
ghi DB; khi phần trước/sau chậm, tổng thời gian có thể vượt giới hạn route.

**Sửa:** phân loại response, timeout và budget toàn request; log metadata không
chứa bài làm/API key; giữ manual độc lập. Chọn model thực tế phải được kiểm tra
bằng một request thật trước demo, không thể suy ra từ test fixture.

### F11 — P2: Cache AI thất bại có thể trả HTTP 200 ở lần thử sau

**Theo code.** [`generate/handler.ts`](../../backend/http/assessments/generate/handler.ts)
lưu `contract_failed` rồi trả 422, nhưng cache lookup dòng 132 không lọc validation
và lần sau trả 200 cho cùng cache. Client thấy response.ok sẽ báo dùng kết quả cũ
thành công. Khi UPSERT cập nhật assessment có sẵn, response/audit còn dùng UUID
mới thay vì ID của bản ghi được cập nhật.

**Sửa:** giữ đúng failure khi đọc cache, hiển thị validation errors và lựa chọn
manual; trả ID persisted thực tế, không tự ý gọi AI lặp vô hạn.

### F12 — P2: Upload Markdown/file lớn chưa ổn định ở đầu cuối

**Theo code; cần thêm acceptance với Chrome/Blob thật.**
[`submissions-workspace.tsx`](../../frontend/features/submissions/submissions-workspace.tsx)
truyền `file.type` nguyên trạng. Một số máy trả MIME rỗng hoặc octet-stream cho
`.md`; backend từ chối dù kịch bản demo yêu cầu nộp Markdown.
File >4 MB ghi DB qua completion callback, nhưng client báo đã tải lên rồi
GET danh sách ngay một lần; callback chậm có thể khiến file chưa xuất hiện.

**Sửa:** normalization MIME có kiểm tra nội dung/extension; chờ xác nhận metadata
đã ghi DB và hiển thị “đang hoàn tất tải lên”, có retry bounded.

### F13 — P2: Polling và đồng bộ lặp làm tăng request, phản hồi cũ có thể ghi đè UI

**Có đo RPC local và kiểm tra code.** POST sync không signature gọi bốn RPC:
genesis hai lần, account info, program accounts. Client sau đó GET lại toàn bộ
quỹ, thêm ba RPC. Auto-refresh escrow mỗi 12 giây và progress mỗi 15 giây tiếp
tục gọi khi mở nhiều tab. Không chống chồng request hoặc backoff sau rate limit.

`load()` của escrow và `choose()` của reviews không có guard chống response cũ
khi đổi selection; bài hoặc quỹ hiển thị có thể tạm thời không khớp selection.

**Sửa:** giảm kiểm tra mạng lặp, gộp refresh, in-flight dedup/backoff, guard ID hoặc
abort request cũ. Thay Helius không sửa được các lỗi logic này; 200 không chứng
minh mọi điều kiện trả thưởng đã đủ.

### F14 — P2: Ví ký giao dịch có thể khác ví vừa kết nối phiên đăng nhập

**Theo code.** [`wallet-payment-button.tsx`](../../frontend/components/wallet/wallet-payment-button.tsx)
tự chọn wallet đầu tiên thay vì wallet/session đang dùng. Khi nhiều extension,
request có thể chọn account khác và bị backend từ chối. Discovery ở nút thanh toán
cũng không sửa selection đã biến mất như phần đăng nhập đã làm.

Recovery nhánh sign-only lưu signature trước broadcast; nếu broadcast lỗi,
lần sau chỉ verify, không rebroadcast cùng signed bytes. Cashout có thể ở trạng
thái chờ signature chưa từng lên chain, cần quy trình xác định blockhash hết hạn.

**Sửa:** dùng wallet/account đang xác thực; hiển thị sai ví sớm; recovery phải
phân biệt signed, broadcast-uncertain, finalized, failed/expired theo bằng chứng.

### F15 — P1: Kịch bản demo và regression test chưa bảo vệ luồng thật

**Đã tái hiện false-positive assertion và đối chiếu contract.**
[`rendered-html.test.mjs`](../../tests/integration/rendered-html.test.mjs) dòng 269
so sánh vị trí chuỗi code đã bị đổi. Vị trí chuỗi `const synced = ...` là `-1`,
nhưng `-1 < 15156` vẫn true. Test tiếp tục xanh dù không kiểm tra đúng điều kiện.
CI chủ yếu chạy JS/HTTP fixtures; escrow HTTP smoke riêng không nằm trong
`npm test`, và smoke đó chưa đi hết funding → result → allocation → claim.

[`kichbandemo.md`](../../kichbandemo.md), [`kichbandemo2.md`](../../kichbandemo2.md)
thiếu cả hai reviewer ký **Nhận nhiệm vụ đánh giá** trước công bố;
program yêu cầu `accepted==3`. Deadline tính lúc configure, không tự tính lại
sau công bố. Ba ví chưa đủ nếu funder, primary và student tách biệt: cần backup
thứ tư; hoặc dùng funder kiêm primary và vẫn cần backup riêng.

Các hướng dẫn “cấp credential rồi mới trả thưởng”, “chỉ sinh viên ký mới có thể
chuyển thưởng”, “reviewer chính xử lý sau mọi deadline” cần đính chính:
credential và reward tách luồng; program cho caller khác claim vào recipient cố
định, giao diện mới giới hạn chủ ví; sau review deadline quyền thuộc backup.

**Sửa:** kịch bản bám runbook/program; test hành vi qua API thực với database/RPC
biệt lập, bao gồm lỗi SQL, deadline, role, partial failure; thêm browser golden flow.

### F16 — P2: Rút tiền vẫn có đường tải dữ liệu lỗi mà trông như chưa có dữ liệu

**Theo code; logic off-ramp server đã có nhiều test đạt.**
[`cashout-workspace.tsx`](../../frontend/features/cashout/cashout-workspace.tsx) dòng 236–288
bỏ qua response không ok ở các endpoint đọc lệnh/beneficiary/FX, còn lỗi mạng từ
Promise.all không được catch trong interval/initial load. Capabilities/history
có thể rỗng hoặc cũ mà thiếu giải thích rõ cho người dùng.

**Sửa:** trạng thái load/error/stale theo từng nguồn; giữ lịch sử có nhãn dữ liệu cũ,
không đánh đồng lỗi RPC với số dư 0 hoặc lỗi API với danh sách trống.

## Trình tự khắc phục đề xuất

1. **Hoàn thành luồng thưởng đang kẹt:** F01–F04, F06; kiểm tra bằng hai ví
   reviewer đúng thời hạn và ví sinh viên; tuyệt đối không sửa deadline/quỹ bằng SQL.
2. **Tính đúng đắn tiền và bằng chứng:** F05, F07–F09; test ngưỡng điểm,
   replay milestone, khóa file đồng thời, bootstrap dở dang.
3. **Khả năng phục hồi demo:** F10–F14, F16; error parsing, retry có giới hạn,
   upload hoàn tất, đúng ví ký, trạng thái stale rõ ràng.
4. **Chốt acceptance và tài liệu:** F15; quay lại toàn bộ golden flow trên một
   deployment đã xác định commit, ghi signature cho từng thao tác.

Điều kiện nghiệm thu: đọc quỹ thành công không hứa đã trả; approved không tự
đồng nghĩa đủ điểm; đã allocation/claim phải phản ánh ở mọi màn hình liên quan;
lỗi phải hiện ngay tại thao tác và không làm kẹt nút; retry không gửi lại tiền
khi trạng thái giao dịch trước còn chưa rõ.

## Các kiểm tra đã thực hiện

- `npm run check:repo`: đạt, 309 source modules / 55 documentation files trước báo cáo.
- `npm run lint`: đạt.
- `npm test`: build production đạt, **168/168** test đạt.
- HTTP local với fixture database/RPC: dưới ngưỡng vẫn eligible, paid escrow chưa
  hiện trên payouts, zero-funded account vẫn finalized=true, error text/plain,
  dùng lại signature milestone — kết quả nêu tại từng mục. Không broadcast.
- Mock OpenRouter: empty/length/provider-error/timeout; không tiêu thụ API thật.
- Browser Vercel phiên riêng chưa đăng nhập: landing tải, không thấy console error
  ban đầu hoặc ảnh lỗi, verifier static 200; protected APIs 401 như mô tả F06.
- Read-only Devnet: hai escrow và receipt thật nêu đầu báo cáo.

Chưa kiểm chứng: env/Function Logs của deployment hiện tại, live OpenRouter với
key người dùng, callback Blob thật, ký với tất cả extension/mobile, Rust/SBF mới
và mainnet. Không chạy live payout hay nâng cấp program trong lần rà soát này.
Bộ test đạt là bằng chứng phạm vi đã chạy, không phải kết luận tất cả tính năng
đã được kiểm thử end-to-end trên Vercel.

# Off-ramp adapters — sandbox hôm nay, tích hợp provider thật sau

Status: completed
Updated: 2026-09-18
Baseline: `d8615d110430b108846112e55d16125dbf45e9cc`, branch `main`.
Stage: S0–S5 implemented and validated; publication tracked in the handoff.

## Goal

Chuẩn hóa luồng USDC Devnet → payout VND mô phỏng thành orchestration + provider
adapter có thể kiểm thử, đối soát và khôi phục. Sau này thêm provider thật mà không
viết lại business flow; không tuyên bố chỉ đổi environment là có production.

Checkpoint đang làm: [handoff.md](../../workstreams/offramp/handoff.md).
Plan này giữ thiết kế/acceptance; handoff giữ trạng thái ngắn và bước tiếp theo.

## Context

Đã đọc đề xuất và review cashout/service/FX/verify/webhook ở baseline trên:

- Sandbox nội bộ: `CASHOUT_PROVIDER=skillbridge_devnet_offramp`;
  `.env.example` chọn `OFFRAMP_PROVIDER=devnet_sandbox`.
- Có receiving-method mapping bank/MoMo/ZaloPay; tên provider/config không chứng
  minh API của đối tác đã được tích hợp hoặc có quyền chi trả thực tế.
- `realPayoutEnabled` luôn false. `refresh` hiện tự tạo bank reference sandbox
  và đổi order thành `sandbox_completed` trong HTTP handler.
- Có tỷ giá tham chiếu, quote expiry, amount atomic, session ownership,
  signature recovery và kiểm tra USDC sender/recipient/mint/reference/finalized.
- Settlement wallet có thể fallback về reward vault. Chưa được coi là
  non-custodial chỉ vì người dùng tự ký.
- Chưa thấy Circle/CPN integration trong đường xử lý được khảo sát; không tạo
  Circle adapter giả để đủ danh sách. Khảo sát lại nếu code/branch đã thay đổi.
- Webhook hiện ký raw body nhưng event ID nằm ở header riêng; chưa thấy timestamp
  chống replay. Event được insert trước bước apply, còn duplicate trả sớm:
  cần test crash-between-insert-and-apply. Payout failure đang thành `onchain_failed`.
  Đây là phát hiện code-review, chưa tái hiện bằng fault tests của workstream này.

## Constraints

- Ngày 2026-09-18 người dùng xác nhận triển khai toàn bộ plan và commit/push.
  Không bao gồm mainnet, tiền thật hoặc deploy provider/program.
- Giữ Next.js/Vercel, SIWS, quyền tenant/user, UI VI/EN và luồng không liên quan.
- Không Binance P2P, merchant bot, chuyển tiền cho cá nhân, mainnet hoặc VND thật.
- Không bịa API, đối tác, giấy phép, khả năng VND/Solana hay kết quả certification.
- Không reset DB, đổi migration identifiers, đổi program ID hoặc di chuyển quỹ cũ.
- Không lưu khóa/seed/API secret trong frontend, docs, logs hoặc Git.
- Dùng Markdown/Git/tests và DB hiện có; không thêm framework/queue lớn chỉ để refactor.
- Đọc repo ở mức map trước, rồi đọc sâu dependency liên quan; không tải code mù quáng.

## Decisions

### D1. Ranh giới module

HTTP/auth → orchestration service → provider registry → adapter.
Chain verifier và FX reference là dependency riêng của orchestration.

- Domain giữ amount atomic, execution mode, quote snapshot, state transitions,
  invariants và lỗi chuẩn; không chứa SDK/provider-specific payload.
- Adapter chuyển request/response thật hoặc sandbox sang domain types.
- Payout provider chỉ là adapter riêng nếu cần điều phối trực tiếp; không xây
  thêm tầng payout giả khi một off-ramp provider đã bao trọn conversion + bank payout.
- KYC là capability tùy provider. Sandbox ghi rõ `not_required_for_sandbox`;
  không giả vờ `kyc_verified` hoặc thu ảnh giấy tờ thật trong demo.

### D2. Hợp đồng adapter dự kiến

Tên method là đề xuất, không phải API đã tồn tại:

- `getCapabilities`: modes, network/mint, source/destination currencies,
  countries, payout methods, min/max amounts, KYC/refund support.
- `getQuote`: provider quote ID, input amount, itemized fees, net VND, expiry,
  quote kind (reference/test/executable), terms/version.
- `createOrder`: stable idempotency key + frozen payload; trả provider order ID.
- `getFundingInstructions`: recipient/token account, mint, network, amount,
  reference/memo và funding deadline từ provider, không từ dữ liệu client tùy ý.
- `getOrderStatus`: trạng thái chuẩn + provider status/raw code an toàn.
- `verifyAndNormalizeWebhook`: xác thực raw bytes theo tài liệu của adapter,
  trả event ID/order ID/timestamp/status đã được xác thực.
- KYC session/status, cancel, refund, lookup-by-idempotency-key là capability
  bổ sung; unsupported phải trả lỗi rõ ràng, không trả thành công giả.

Chỉ triển khai `SandboxProvider` trong scope. Provider production placeholder
phải fail closed trước khi tạo order/funding instructions. Không tạo lớp Circle
trống mang tên integration thật. Giữ seam để bổ sung adapter khi có tài liệu/quyền.

### D3. Cấu hình và chuyển môi trường

- Giữ alias `devnet_sandbox` cho config cũ và provider ID cũ cho legacy records.
- Lưu provider ID, adapter/terms version và mode vào order ngay lúc tạo; refresh,
  webhook và retry sử dụng snapshot đó, không dùng provider mặc định mới.
- Provider không biết, mode không hỗ trợ, key/endpoint sai môi trường: unavailable,
  không âm thầm chuyển sang sandbox và báo hoàn tất.
- `REAL_CASHOUT_ENABLED=true` không được mở production trong release này.
- Production sau này cần adapter thật + capability corridor phù hợp + account
  permissions + KYC/beneficiary readiness + vận hành/pháp lý phù hợp. Ghi thành checklist.

### D4. Đường đi tiền và compatibility

- Order mới dùng dedicated `CASHOUT_DEVNET_SETTLEMENT_WALLET`; không fallback sang
  reward vault. Nếu thiếu, khóa tạo lệnh và hướng dẫn cấu hình, không yêu cầu nạp tiền.
- Order cũ tiếp tục đọc địa chỉ/mint/reference đã lưu, kể cả khi config mới đổi.
  Không đổi đích của transaction đã chuẩn bị hoặc tự chuyển số dư giữa các ví.
- Dedicated sandbox wallet vẫn phải được mô tả đúng bên giữ khóa; không gọi nó
  non-custodial. Không cần thêm private key vào app nếu chỉ xây giao dịch người dùng ký.
- Production ưu tiên ví người dùng → địa chỉ provider cấp. App không mặc định giữ
  tiền trung gian; custody thực tế phụ thuộc sản phẩm/provider đã ký kết.
- UI transaction phải kiểm tra mode/network/mint/recipient/amount/reference với
  funding snapshot trước khi yêu cầu ký. Solana Pay không phải dịch vụ đổi VND.

### D5. Hai loại giá và hai loại hạn

- FX reference chỉ là tham chiếu/cảnh báo, giữ source/freshness hiện có.
- Executable quote phải do provider thật cam kết. Sandbox là test quote rõ nhãn.
- Quote snapshot bất biến, gắn user/wallet/beneficiary token/provider/mode/mint,
  input atomic, gross/fee/net VND, timestamps, quote ID, payload hash.
- Phân biệt quote expiry và settlement deadline; không tự lấy giá tham chiếu thay
  provider quote, không tự đổi giá sau khi đã nhận crypto.
- Hết hạn trước khi có tiền: có thể expire. Đã gửi/đã nhận tiền, chuyển thiếu/thừa
  hoặc chuyển muộn: reconcile/requote/refund theo khả năng đã chốt, không bỏ mất lệnh.
- Dùng integer/decimal-safe math, không dùng floating point cho số tiền thực thi.

### D6. State machine và lỗi

Giữ API/UI legacy qua mapping nếu cần, không rename toàn bộ DB enum một lượt.
Domain tối thiểu: quoted → awaiting_crypto → crypto_pending → crypto_confirmed →
payout_processing → completed; KYC/conversion thêm khi capability thực sự cần.
Các nhánh riêng: expired_before_funding, failed_before_funding,
reconciliation_required, payout_failed, refund_pending, refunded.

- Track crypto status và payout status riêng; payout lỗi không làm chain thành lỗi.
- Mỗi transition cần expected current state/version, evidence và event key.
- Chỉ finalized đúng giao dịch mới chứng minh crypto confirmed.
- Completed chỉ từ sandbox adapter có nhãn hoặc provider payout evidence hợp lệ;
  HTTP 200 của createOrder không phải payout thành công.
- Refund pending khác refunded; không tự hoàn tiền khi không có cơ chế/quyền đó.
- Event đến muộn không lùi state. Bank return/reversal tương lai phải được đối soát
  rõ, không biến một completed thành failed cũ chỉ vì callback sai thứ tự.

### D7. Inbox, outbox và reconciliation

- Inbox unique theo provider + mode + verified event ID; lưu hash payload, trạng
  thái received/processing/processed/failed, attempt count, next retry và lỗi đã redact.
- Duplicate đã processed thì return reused; received/failed chưa áp dụng thì resume.
  Cùng ID khác payload phải báo conflict. Early event chưa có order được giữ chờ
  đối soát có giới hạn, không mất vĩnh viễn vì `ignored_unknown_order`.
- Sandbox signature v2 ràng buộc timestamp + event ID + raw body; giới hạn clock
  skew/replay window, constant-time compare, size limits. Provider thật dùng chuẩn
  chính thức của họ, không ép mọi provider ký theo scheme tự đặt.
- Event chỉ cập nhật đúng provider order/mode/amount/currency; không tin orderId
  do client hoặc header chưa được ký gửi tới.
- Transition + audit/event-processed cùng DB transaction/CAS. DB lease có expiry,
  retry và fencing phù hợp, không mutex chỉ nằm trong một process Vercel.
- Outbox lưu logical operation/idempotency key/payload hash trước request bên ngoài.
  Timeout có thể là external success: lookup/reconcile cùng key, không tạo payout mới.
- Rerun getStatus và applyNormalizedEvent phải idempotent; frontend chỉ yêu cầu
  kiểm tra, không được tự chọn completed. Không ghi private banking payload vào audit.
- Dùng explicit recheck endpoint/worker callable trên Vercel; không dựa vào timer
  chạy sau response. Chưa tạo cron/automation nếu người dùng chưa yêu cầu.

### D8. Schema và tài liệu

Tận dụng `cashout_sessions`, `cashout_events`, `cashout_webhook_events` và quote fields.
Chỉ thêm cột/bảng khi thiếu: adapter version/mode snapshot, normalized stage,
provider quote/order IDs, inbox processing fields, outbox operation và reconciliation.
PII dùng token/reference của partner; không biến sandbox beneficiary thành KYC thật.

Chọn migration ID mới sau khi xem thư mục thực tế (baseline có 0019/0020 của portfolios).
Giữ raw initialization và Drizzle metadata tương thích; backfill bảo thủ không gọi
provider hay gửi tiền. Test migration với order cũ đang pending/completed.
Không tuyên bố zero breaking changes: dedicated-wallet prerequisite và webhook
signature v2 là thay đổi cần thông báo/có hướng dẫn chuyển đổi; không mặc định chấp
nhận chữ ký cũ thiếu replay protection để giữ compatibility.

## Completed

- Đọc đề xuất, review code và làm rõ sandbox nội bộ thay vì giả định có Circle.
- Chốt phạm vi kế hoạch, quyền hạn và checkpoint bàn giao.
- S1–S4: provider contract/registry/sandbox; create/accept/recheck orchestration;
  immutable funding quote; dedicated wallet; fenced inbox/outbox and signature claims;
  additive 0021; finalized verification/reconciliation and pre-sign message inspection.
- S5: VI/EN state feedback, docs/README/env/ADR; regression and isolated browser checks.
- Domain types stay beside the server adapters; no unused shared framework was added.
- Existing cashout fields retain legacy labels; new journals do not rewrite old orders.

## In progress

No implementation remains in this approved sandbox scope. Git publication status
and any owner-run deployment acceptance are in the dedicated handoff.

## Remaining

No further product implementation in this plan. Owner-run live wallet acceptance,
Vercel redeploy and a future production adapter are distinct, unclaimed work.
The table below preserves the original execution breakdown, now completed:

| Bước | Việc làm / file chính | Gate trước khi chuyển bước |
| --- | --- | --- |
| S0 | Rà baseline; `tests/backend/cashout.test.ts`, payment tests và webhook handler | Ghi test baseline; tái hiện crash/replay/state bug trong DB/RPC giả lập |
| S1 | Đề xuất `shared/validation/offramp.ts`; `backend/services/cashout/providers/{types,registry,sandbox}.ts` | Contract tests, unsupported production fail closed; API payload cũ có mapping |
| S2 | `cashout.ts`, `fx-rates.ts`, `cashout-record.ts`, cashout create/accept/refresh | Sandbox đi qua adapter; quote/funding snapshot; dedicated wallet cho lệnh mới |
| S3 | Webhook handler, đề xuất `offramp-inbox.ts`, `offramp-operations.ts`, migration/schema | Duplicate/concurrent/crash recovery, failed payout không thành onchain_failed |
| S4 | Wallet builder, verification route và cashout UI | Ký/xác minh đúng snapshot; lỗi rõ; không VND thật; legacy pending vẫn recover |
| S5 | README VI/EN, env example, architecture, tests/runbook, ADR và harness | Full regression + review diff; ghi riêng live/manual chưa chạy |

Checkpoint sau từng slice đã kiểm tra, trước khi đổi module và trước khi nghỉ/đổi account.
Không đợi hết S0–S5 mới ghi chú. Xem mẫu trong handoff; giữ bước chưa xong là chưa xong.

## Relevant files

Implementation entry points (design proposals above are historical where names differ):

- [Create orchestration](../../../../backend/services/cashout/offramp-create.ts),
  [accept/recheck](../../../../backend/services/cashout/offramp-orchestrator.ts),
  [inbox](../../../../backend/services/cashout/offramp-inbox.ts),
  [operations](../../../../backend/services/cashout/offramp-operations.ts),
  [snapshot](../../../../backend/services/cashout/offramp-snapshot.ts),
  [providers](../../../../backend/services/cashout/providers/).

- [Cashout service](../../../../backend/services/cashout/cashout.ts),
  [record/DTO](../../../../backend/services/cashout/cashout-record.ts),
  [FX](../../../../backend/services/cashout/fx-rates.ts).
- [HTTP cashout](../../../../backend/http/cashout/),
  [webhook](../../../../backend/http/webhooks/offramp/handler.ts),
  [Next adapters](../../../../app/api/cashout/).
- [Payment verification](../../../../solana/server/payments.ts),
  [reward vault compatibility](../../../../solana/server/reward-vault.ts),
  [UI](../../../../frontend/features/cashout/cashout-workspace.tsx).
- [Runtime environment](../../../../backend/config/runtime-env.ts),
  [environment example](../../../../.env.example),
  [core schema](../../../../backend/database/schema/core-schema.ts),
  [Drizzle schema](../../../../backend/database/schema.ts),
  [migrations](../../../../backend/database/migrations/).
- [Cashout tests](../../../../tests/backend/cashout.test.ts),
  [payment tests](../../../../tests/solana/payments.test.ts),
  [test commands](../../../testing/README.md), [architecture](../../../architecture/README.md).

## Known issues

- Production provider/corridor/onboarding chưa xác minh; thiếu access không chặn sandbox,
  nhưng không được giả lập như production hoặc tự mở real-money flow.
- Dedicated wallet mới cần public address được chủ dự án cung cấp/chọn; chưa có thì
  dùng fixture cho tests, không tự tạo/fund ví hoặc tìm private key.
- Webhook recovery/replay behavior is covered by isolated fault tests; this is not
  an external security audit or provider certification.
- Quyền/trách nhiệm pháp lý không được suy ra chỉ từ nhãn orchestration layer.
- Luồng cashout vẫn là chức năng hỗ trợ SkillBridge, không thay đổi product thesis
  evidence → human review → credential/reward → opportunity.

## Validation

### Implementation completion (2026-09-18)

- `npm test`: standard production build (including static verifier) + **168/168 passed**.
- `npm run lint`, `npm run check:repo`, TypeScript build and `git diff --check`: passed.
- 16 new domain/fault/concurrency tests + one full HTTP journey, no external banking calls.
- Chrome reconciliation view: VI/EN at 375/768/1024/1440px, no horizontal overflow,
  clipped detail values or console errors; recheck preserves deposit evidence.
- Browser inspection found a stale countdown on terminal orders; fixed to show saved quote.
- Initial sandbox ancestor-read and Google Fonts errors were resolved after environment
  permissions changed. A temporary test-font build was superseded by passing standard builds.
- No live Devnet transfer, mainnet, real bank payout, physical-wallet signing or Vercel
  deploy in this workstream. Those remain owner-run acceptance, not inferred from mocks.

### Lượt chuẩn bị tài liệu (2026-09-18)

`npm run check:repo` passed (298 modules, 49 documents);
`node --test tests/tooling/repo-harness.test.mjs` passed 6/6;
`git diff --check` passed. Chỉ thay đổi Markdown; chưa chạy lint/full build/product
tests trong lượt này. Đã review diff và đường dẫn bàn giao.
151 tests + CI success thuộc release d8615d1 trước đó, không phải test refactor mới.

### Acceptance cho implementation

- Registry: unknown provider, production_requested, wrong network/mint, unsupported
  bank/country/currency, missing setup không tạo funding instructions/payout thật.
- Quotes: reference khác executable; expiry, rounding, fee/net, tamper và đổi config
  không sửa order đã tạo. Token decimals và lượng VND được test biên.
- Crypto: wrong sender/recipient/mint/reference, chưa finalized, RPC timeout,
  transaction trùng và concurrent verify; late/under/overpayment được nhận diện.
- Webhook: invalid signature/timestamp, header tamper, replay, duplicate ID khác body,
  concurrent callback, event sai order/provider/mode, out-of-order, unknown order,
  crash sau insert và sau external side effect, retry sau DB failure.
- State: payout thất bại sau crypto confirmed; không mất dấu tiền hoặc tự refund;
  REFUNDED/COMPLETED cần bằng chứng đúng loại; refresh không tạo double payout.
- Migration: order cũ, địa chỉ cũ, pending signature và unique indexes được giữ;
  không cần reset DB hoặc xóa journals để tiếp tục.
- UI VI/EN: Devnet/Sandbox/không VND thật ở quote, confirm, signing, tracking và kết quả;
  không nhầm bank account validation với KYC. Giữ chức năng ví không liên quan.
- `npm run check:repo`, `npm run lint`, `npx tsc --noEmit`, `npm test` và
  `git diff --check`; npm test đã bao gồm production build.
- Contract/HTTP tests chạy độc lập external service. Live Devnet chỉ khi được yêu
  cầu, đúng signer/mạng và không chuyển lại tiền do response mơ hồ.
- Ghi source docs và quyền truy cập Circle/provider nếu sau này tích hợp thật;
  reverify capability, không dùng tin nhắn cũ làm bằng chứng hỗ trợ VND.

## Handoff notes

Start at [handoff.md](../../workstreams/offramp/handoff.md). Implementation is complete;
do not restart S0 or add a fake production adapter. Check publication/deployment state there.
Người dùng đã cho phép implement và commit/push; deploy/live vẫn ngoài scope.
Giữ completed portfolio workstream riêng; không tiếp tục nhầm plan đã hoàn thành.

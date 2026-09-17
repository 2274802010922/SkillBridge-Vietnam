# Evidence-to-Opportunity — kế hoạch nâng cấp cho hai track

Status: completed
Updated: 2026-09-17
Baseline: `3c16444`; working tree sạch trước khi lập kế hoạch.
Stage: local implementation and validation complete; external acceptance listed below.

## Goal

Một hành trình thống nhất: người dùng chọn bằng chứng năng lực → chuẩn bị hồ sơ
theo mục tiêu → doanh nghiệp đối chiếu và chọn người → kiểm tra chứng nhận/quyền
nhận thưởng. Sinh viên và freelancer dùng chung nền tảng hồ sơ, không bị buộc
đổi ví hoặc đi theo cùng một con đường nghề nghiệp.

Phạm vi đã được người dùng yêu cầu lập plan: hồ sơ bằng chứng; so sánh ứng viên;
AI đóng gói hồ sơ có nguồn/hạn mức; củng cố chứng nhận/claim và demo xuyên suốt.
Ngày 2026-09-17, người dùng đã yêu cầu triển khai end-to-end, cập nhật README,
harness, kiểm thử rồi commit/push. Không mở rộng sang mainnet hoặc deploy chương trình.

### Bằng chứng cần có khi hoàn thành implementation

- Người làm tự tạo được bộ hồ sơ gắn bằng chứng và kiểm soát ai xem phần nào.
- Doanh nghiệp so sánh được 2–3 ứng viên, mở nguồn được phép và ghi quyết định.
- AI đưa ra bản nháp có dẫn nguồn, không sửa điểm/chứng nhận hoặc hứa có việc.
- Reload/retry không cấp chứng nhận trùng, vượt suất hoặc mất dấu giao dịch.
- Bản demo có một luồng kinh doanh và một bộ bằng chứng kỹ thuật từ cùng sản phẩm.
- Các tính năng hiện có, VI/EN và deployment Vercel tiếp tục hoạt động.

## Context

### Hiện trạng đã đối chiếu

| Đã có | Chưa thấy trong phạm vi code đã khảo sát |
| --- | --- |
| Hồ sơ ví; private/unlisted/public; lựa chọn chia sẻ thành tích | Bộ hồ sơ theo từng cơ hội, quyền chia sẻ chi tiết theo nguồn |
| Ứng tuyển bằng credential; kiểm tra lại; reviewing/shortlisted/rejected | So sánh cạnh nhau, ghi chú quyết định có lịch sử |
| AI đánh giá, hỗ trợ brief/feedback; cache/rate limit | AI tạo bộ hồ sơ của người làm theo mục tiêu có nguồn |
| Unique index assessment/attestation; nonce xác định từ assessment | Journal cấp credential và recovery chain-thành-công/DB-thất-bại đầy đủ |
| Challenge escrow Devnet, claim độc lập, sponsored SOL proof | Không suy ra escrow freelance từ module milestone/invoice hiện có |

Điểm cuối cần tái hiện bằng test trước khi sửa: cấp credential đang kiểm tra suất,
gọi chain rồi ghi DB; helper gửi chờ `confirmed`. Unique index không tự giải quyết
race giữa hai assessment khác nhau hoặc lỗi sau khi chain đã ghi nhận.

### Liên hệ tiêu chí cuộc thi

Nguồn: [UniHackFest Learn](https://unihackfest.vn/learn/), đối chiếu 2026-09-17.
Business: bài toán 25%, sản phẩm 30%, kinh doanh 25%, trình bày 20%.
Technical: chiều sâu 30%, kiến trúc 25%, Solana/tích hợp/hiệu năng 25%, demo 20%.

| Phần | Bằng chứng Business | Bằng chứng Technical |
| --- | --- | --- |
| Hồ sơ bằng chứng | Người dùng có đầu ra dùng khi ứng tuyển/chào dịch vụ | Phân quyền, nguồn, phiên bản, hiệu lực và thu hồi |
| So sánh ứng viên | Doanh nghiệp có căn cứ ra quyết định | Rubric tương thích, phân quyền theo tổ chức, kiểm tra nguồn |
| AI hồ sơ | Công cụ cá nhân hóa có thể đóng gói thành dịch vụ | Retrieval, dẫn nguồn, cache, hạn mức, xử lý lỗi |
| Chứng nhận/claim | Quy trình đáng tin và có thể kiểm tra | Recovery, idempotency, finalized, claim ngoài API |

Demo chứng minh chức năng và cách đóng gói, không chứng minh willingness-to-pay,
doanh thu, hiệu quả tuyển dụng hay chất lượng AI khi chưa đo với người dùng thật.

## Constraints

- Giữ một Next.js/Vercel deployment, module boundaries và URL đang có.
- Thay đổi DB phải additive, giữ migration identifiers và dữ liệu cũ; không reset.
- Giữ SIWS/session, quyền tổ chức, thủ công độc lập với AI và thiết kế light-terminal.
- Giữ Devnet, program IDs, chính sách reviewer/quỹ chờ; không nâng cấp Anchor mặc định.
- Không xây mới cashout, mainnet, token, marketplace, escrow freelancer, lịch/email,
  chat, thanh toán thuê bao thật hoặc cơ chế tranh chấp trong release này.
- Không dùng trả phí để nâng điểm, ưu tiên thứ hạng, mua credential hoặc giữ tiền
  thưởng/khóa quyền xác minh. Không hạ quyền miễn phí của chức năng đã tồn tại.
- Không tự gửi tài liệu riêng cho AI, công khai hồ sơ hay mời ứng viên thay người dùng.
- Chỉ thêm dependency nếu có nhu cầu chưa giải quyết được bằng stack hiện có.

## Decisions

Các thiết kế dưới đây ghi lại phạm vi được duyệt. Implementation và operation guide
là nguồn hiện tại; không dùng bản plan này như bản mô tả runtime bất biến. Quyết định
đã triển khai được ghi tại [ADR-003](../../decisions/ADR-003-evidence-portfolios.md).

### M1 — Hồ sơ bằng chứng và bộ hồ sơ theo mục tiêu

**Luồng người làm**

1. Trong Hồ sơ của tôi, chọn Tạo bộ hồ sơ; chọn mục tiêu tìm việc hoặc nhận dự án.
2. Chọn một cơ hội đã có hoặc nhập mô tả mục tiêu bằng văn bản. Không fetch URL
   do người dùng nhập ở MVP (tránh SSRF và phụ thuộc scraping).
3. Chọn nguồn từ tài khoản của mình, viết giới thiệu và sắp xếp các mục.
4. Xem trước chính xác phần bên nhận sẽ thấy; lưu bản nháp hoặc chia sẻ có chủ đích.
5. Chỉnh sửa tạo phiên bản mới; không sửa âm thầm bản đã gắn với application.

**Nguồn và mức độ chứng minh**

- Tự khai: mô tả/URL do người dùng nhập, không hiện dấu đã xác minh.
- Được người đánh giá xác nhận: kết quả chính thức kèm đơn vị/ngày/rubric.
- Chứng nhận on-chain: issuer, schema, subject, hiệu lực, thời điểm kiểm tra.
- Giao dịch: trạng thái/loại tiền được kiểm tra riêng; không đồng nghĩa chất lượng bài.
- Hồ sơ rỗng vẫn dùng được; không tạo điểm hoặc chứng nhận giả để lấp giao diện.

**Chia sẻ và quyền truy cập**

- Mặc định draft riêng tư. Bản public chỉ chứa phần người dùng chủ động chọn.
- Quyền xem public credential không kéo theo quyền tải bài nộp riêng tư.
- Bản gửi doanh nghiệp gắn application, organization và phiên bản cụ thể; mỗi lần
  đọc lại đều kiểm tra quyền. Không dùng applicationId đoán được như một quyền xem.
- MVP chia sẻ bản giới thiệu, tóm tắt chính thức và trích đoạn được phép, không
  tự chia sẻ toàn bộ file. Nguồn do tổ chức sở hữu cần có quyền tương ứng.
- Thu hồi grant ngăn truy cập sau đó; ghi chú quyết định không chứa raw evidence.
  Thông báo rõ bản đã tải hoặc sao chép trước đó không thể thu hồi từ thiết bị người nhận.
- Chứng nhận bị thu hồi/hết hạn phải hiện trạng thái mới cả trong hồ sơ cũ; giữ
  riêng lịch sử quan sát, không xóa hoặc viết lại lịch sử xét tuyển.
- RPC không truy cập được = chưa xác minh/stale, không biến thành active hoặc 0 chứng nhận.

**Output MVP:** trang xem bộ hồ sơ và bản in qua trình duyệt; chưa tạo pipeline PDF
server hoặc custom domain. Bản xuất ghi thời điểm và link xác minh, không hứa trạng thái vĩnh viễn.

### M2 — Trung tâm so sánh ứng viên

- Mở rộng màn hình chi tiết cơ hội hiện có, không tạo một ATS độc lập.
- Danh sách có lọc trạng thái và chọn tối đa 3 application trong cùng một cơ hội.
- Hiển thị tên hiển thị, giới thiệu, bộ hồ sơ đã được chia sẻ, điểm chính thức,
  rubric/version, nguồn đánh giá và trạng thái kiểm tra credential.
- Cùng challenge và rubric/version mới được đối chiếu điểm cùng thang đo. Khác
  rubric thì hiển thị riêng, không chuẩn hóa tùy tiện hoặc xếp hạng tổng tự động.
- Không dùng số dư ví, ngân hàng, thông tin nhạy cảm hoặc trạng thái trả phí để chọn người.
- Ghi chú riêng theo organization/application; ghi người tạo, thời điểm và lịch sử sửa.
- Giữ reviewing/shortlisted/rejected; lưu sự kiện đổi trạng thái idempotent.
  Chưa thêm tự động gửi lời mời, calendar hoặc trạng thái hired trong scope này.
- Recheck trước khi ghi nhận shortlist. Revoked/invalid không được báo là đủ điều
  kiện hiện tại. RPC unavailable giữ quyết định lịch sử và cho thử lại, không auto-reject.
- Doanh nghiệp khác hoặc reviewer không có membership phù hợp phải bị API từ chối.

**UX:** desktop so sánh cạnh nhau; mobile là các mục theo tiêu chí/ứng viên để tránh
bảng rộng làm tràn trang. Một CTA chính, label/value tách rõ; giữ lựa chọn khi mở nguồn/quay lại.

### M3 — Trợ lý hồ sơ có nguồn và hạn mức

**Luồng:** chọn mục tiêu → chọn nguồn của mình → xem nội dung sẽ gửi cho AI → xác
nhận → nhận bản nháp → sửa/duyệt → lưu vào bộ hồ sơ. Lỗi AI vẫn cho hoàn thành thủ công.

**Kết quả có cấu trúc**

- Bản giới thiệu ngắn theo mục tiêu.
- Các kinh nghiệm/kỹ năng có dẫn chứng cụ thể.
- Yêu cầu mục tiêu đã có bằng chứng và phần chưa tìm thấy bằng chứng.
- Gợi ý trình bày hoặc câu hỏi luyện tập dựa trên nguồn; không hứa được tuyển.

**Invariants kỹ thuật**

- Tách endpoint và quyền của người sở hữu hồ sơ khỏi assist brief/feedback của reviewer.
- Chỉ đọc nguồn được sở hữu/được phép dùng; không nhận arbitrary file URL.
- Dùng OpenRouter với model tường minh, structured output; không fallback sang model trả phí khác.
- AI không thay đổi bài nộp, điểm, kết quả chính thức, eligibility, credential hoặc giao dịch.
- Từng factual claim có source ID + version/hash; quote phải khớp văn bản nguồn.
  Quote khớp chưa bảo đảm suy luận đúng: hiển thị là nháp và có đánh giá thủ công mẫu.
- Phân biệt thiếu bằng chứng trong dữ liệu được chọn với kết luận người dùng thiếu kỹ năng.
- Chống prompt injection trong cả mô tả cơ hội lẫn tài liệu, giới hạn kích thước/input/output.
- Cache theo owner, nguồn/phiên bản, target hash, locale, prompt/schema version và model.
  Kiểm tra quyền/thu hồi nguồn trước khi trả cache, không chỉ khi tạo cache.
- Khóa generation theo request, dự trữ quota nguyên tử, một lượt trừ cho một kết quả
  thành công. Cache hit không trừ lại. Lượt lỗi không mất credit dịch vụ nhưng vẫn
  chịu giới hạn chống lạm dụng; giữ usage/cost thực của provider nếu có.
- Timeout có trạng thái rõ; không tự gọi lại provider vô hạn. Dữ liệu lỗi chưa rõ
  phải được phân biệt với output đã hoàn tất; ghi operation ID để điều tra.
- Không lưu key hoặc raw tài liệu nhạy cảm trong logs/analytics.

**Đóng gói thương mại giới hạn**

- Core: hồ sơ cơ bản, thành tích đã đạt, xác minh, manual editing và claim luôn dùng được.
- Personal Plus đề xuất: nhiều bộ hồ sơ theo mục tiêu và lượt AI bổ sung; dùng chung
  cho sinh viên/freelancer. Business đề xuất: công cụ so sánh/ghi chú theo đợt.
- Giai đoạn demo chỉ có entitlement trial với nguồn cấp/quyền hạn/expiry được ghi nhận;
  user không tự PATCH gói. Các con số hạn mức là config thử nghiệm, không phải giá đã kiểm chứng.
- Hết hạn gói không xóa hồ sơ/nguồn/ghi chú hoặc quyền vốn có; hạn chế thao tác premium mới.
- Có trang quyền lợi và mức dùng thật từ backend. Không dựng checkout giả, doanh thu
  giả hay xử lý thanh toán thật trong scope này. Giá, refund và merchant provider để sau.

### M4 — Củng cố cấp credential và claim hiện có

1. Viết fault/concurrency tests cho luồng hiện tại trước để phân biệt bug thực và rủi ro.
2. Journal operation keyed theo assessment, lưu fingerprint bất biến: issuer/schema,
   wallet, evidence/result, expiry và attestation PDA. Giữ unique index hiện có.
3. Reserve capacity trong DB bằng điều kiện nguyên tử; tính cả tiến trình đang giữ
   suất. Không dùng mutex trong bộ nhớ giữa nhiều Vercel instance.
4. Tách prepare/sign, lưu signed wire/signature/expiry trước broadcast vào server-only
   storage. Retry đối soát cùng operation, không cấp identity hay expiry mới.
5. Khi chain đã finalized nhưng DB thiếu, đọc đúng account, owner/schema/issuer,
   subject, payload và expiry rồi hoàn tất DB + audit trong transaction.
6. Unknown/RPC timeout không tự giải phóng suất. Blockhash expiry phải được đối soát
   trước khi reprepare; credential đã thu hồi không được hồi sinh bởi retry cũ.
7. Không đổi helper gửi transaction dùng chung một cách ngầm: giới hạn thay đổi ở
   issuance/recovery và có test cho caller bị ảnh hưởng.
8. Giữ claim recipient/idempotency, không ký chuyển tiền thay người dùng. UI giữ
   signature và đường recheck/independent claim ngay cả khi session refresh.

Chuỗi trạng thái dự kiến: reserved → prepared → broadcast → finalized → completed;
definitive failure và needs-reconciliation tách riêng. Chính sách dùng lại suất của
credential đã thu hồi phải giữ hành vi hiện tại, không tự tạo rule kinh doanh mới.

Không yêu cầu upgrade Anchor cho thiết kế dự kiến này. Nếu phát hiện cần đổi program
hoặc business rule, tách ADR/phạm vi và hỏi người dùng; không tự deploy.

### UX dùng chung

- Giữ token/font/spacing trong [design system](../../../design/system.md); không redesign landing.
- Giữ menu hiện tại; bộ hồ sơ nằm dưới Hồ sơ của tôi, so sánh dưới Cơ hội.
- VI/EN đầy đủ; mobile 375px, tablet 768px, split screen 1024px, desktop 1440px.
- Skeleton khi tải, giữ dữ liệu cũ khi refresh, lỗi có hướng xử lý; không báo thành công khi chỉ ký.
- Keyboard/focus/label đủ; đạt contrast 4.5:1 cho chữ thường, touch target 44px;
  200% zoom không che CTA/nội dung. Hủy hoặc quay lại không tự gọi AI/gửi giao dịch.
- Áp dụng UI/UX skill về bảng responsive: mobile đổi cách trình bày, không thu nhỏ chữ.

### Dữ liệu/API dự kiến (chưa tồn tại)

Ưu tiên mở rộng có ranh giới, không xây framework chung quá lớn:

| Nhóm dữ liệu mới | Nội dung/tính toàn vẹn |
| --- | --- |
| Portfolio packs + versions + selected sources | Owner, target, locale, nội dung, version; tham chiếu nguồn chứ không nhân bản file |
| Evidence grants | Organization/application, phiên bản, danh sách nguồn/phạm vi, thời hạn/thu hồi |
| Decision notes/events | Org/application, actor, timestamp, action; không ghi nội dung nguồn riêng vào audit |
| Career assistance operations/cache | Fingerprint, trạng thái, result, source refs, model/usage, quota reservation |
| Feature entitlements/usage | Scope user/org, feature, trial provenance, expiry; xử lý concurrent requests |
| Credential issuance operations/reservations | Fingerprint, capacity, wire/signature, blockhash expiry, trạng thái recovery |

Tên và cấu trúc cuối phải được xác nhận qua migration review; bảng có overlap với
cache/journal hiện có cần tái sử dụng phù hợp, không thêm bản sao mù quáng.

Route đề xuất: `/api/portfolio/packs`, `/api/portfolio/packs/[id]`,
`/api/portfolio/packs/[id]/share`, `/api/career-assistance`,
`/api/career-assistance/[id]`, `/api/opportunities/[id]/comparison`,
`/api/features/usage`, `/api/credentials/operations/[id]` và POST recheck tương ứng.
Mọi route bảo vệ session/owner/org; không dùng query string làm bằng chứng quyền.
UI dự kiến thêm `/app/profile/packs/[id]`; mở comparison trong route opportunity
hiện có. Không đổi URL cũ; không thêm public raw-file route.

Backfill bảo thủ: dữ liệu cũ vẫn đọc được, mặc định không có grant mới, không chạy
AI/chain trong migration; record thiếu provenance có cảnh báo thay vì gắn nhãn verified.

## Completed

- Khảo sát baseline, module guides, code profile/application/AI/issuance và lịch sử gần.
- Chốt phạm vi đề xuất, giới hạn, thứ tự và acceptance gates trong plan này.
- M1: versioned packs, source selection, public/application sharing, revocation and reviewer permission.
- M2: comparison, append-only internal notes, fresh shortlist checks and idempotent decision events.
- M3: grounded career drafts, consent, source rechecks before cache, atomic quota and launch trials.
- M4: issuance reservation/journal, signed bytes before broadcast, finalized recovery and safe operator states.
- Additive migrations 0019/0020, Drizzle metadata and runtime initialization; no reset or Anchor change.
- English/Vietnamese README, acceptance guide and ADR updated to actual scope.

## In progress

Không có implementation còn dở trong phạm vi release này.

## Remaining

Các bước implementation sau đã hoàn tất; giữ bảng để ghi lại thứ tự thực hiện.

| Bước | Phụ thuộc | Đầu ra/gate |
| --- | --- | --- |
| 0. Chốt hợp đồng dữ liệu/quyền | Người dùng đồng ý triển khai | Spec grant, provenance, quota; test failing cho issuance |
| 1. M4 recovery + schema nền | 0 | Chứng nhận phục hồi được; migration không mất dữ liệu |
| 2. M1 hồ sơ và chia sẻ | 0–1 | Owner/public/employer boundaries qua test |
| 3. M2 comparison | 2 | So sánh đúng thang đo; revoke grant không lộ nguồn |
| 4. M3 AI + trial entitlements | 2 | Có nguồn, cache, quota; lỗi AI vẫn sửa hồ sơ thủ công |
| 5. Tích hợp và demo | 1–4 | Manual QA, regression, hai kịch bản demo cùng dữ liệu |

Không ấn định số ngày khi chưa biết môi trường API/Devnet và kết quả test. Không giảm
privacy/recovery để chạy kịp; nếu cần cắt, bỏ export nâng cao và nhiều template trước.

External acceptance còn lại: chủ dự án chạy OpenRouter thật; funded sponsored USDC;
Vercel redeploy và ví trên thiết bị thật. Không tuyên bố các bước này đã được kiểm chứng.

## Relevant files

- [Profile service](../../../../backend/services/profiles/wallet-profile.ts),
  [profile UI](../../../../frontend/features/profile/profile-workspace.tsx),
  [public view](../../../../frontend/features/profile/wallet-profile-view.tsx).
- [Applications](../../../../backend/services/opportunities/applications.ts),
  [application contract](../../../../shared/validation/job-application.ts),
  [opportunity UI](../../../../frontend/features/opportunities/opportunity-detail.tsx).
- Existing API adapter/handler directories: `app/api/profile`, `app/api/profiles`,
  `backend/http/opportunities`, `backend/http/credentials`, `backend/http/ai/assist`.
- [AI assist](../../../../backend/http/ai/assist/handler.ts),
  [provider selection](../../../../backend/ai/provider-selection.ts),
  [retrieval](../../../../backend/ai/evidence-retrieval.ts).
- [Credential handler](../../../../backend/http/credentials/handler.ts),
  [SAS integration](../../../../solana/server/solana-credentials.ts),
  [legacy journal reference](../../../../solana/server/legacy-vault-journal.ts).
- [Core schema](../../../../backend/database/schema/core-schema.ts),
  [Drizzle schema](../../../../backend/database/schema.ts),
  [competition schema](../../../../backend/database/schema/competition-schema.ts).
- [Test guide](../../../testing/README.md), [competition runbook](../../../testing/competition-upgrades.md),
  [trust boundaries](../../../product/proof-to-payout.md), [chain instructions](../../../../solana/AGENTS.md).

## Known issues

- Legacy SELECT-count race reproduced in an isolated test. New atomic reservation,
  concurrent recovery and DB-after-chain failure tests pass; not a security audit.
- Live OpenRouter and sponsored USDC remain separate verification gaps; owner had
  reserved live AI testing for the end. Do not claim success without a recorded run.
- Existing freelance milestone records do not establish program escrow protection.
- Paid willingness, hiring outcomes and ROI are hypotheses; demo data must be labeled.
- Publication permission on organization-owned evidence is not implied by student
  ownership of a profile; default deny unless the relevant authorization exists.
- Rule-changing questions stay open: real prices/charging, expanding credential
  slots beyond reward_slots, freelance dispute/refund policy. Excluded from this release.

## Validation

### Kiểm tra cho lượt lập plan này

2026-09-17: `npm run check:repo` passed (267 source modules, 45 documentation files);
`git diff --check` passed. Đã review scope, links, trạng thái plan và ranh giới proposed/runtime.
Không chạy full product tests cho thay đổi Markdown-only; 131 tests trong snapshot
là kết quả lịch sử của wallet onboarding, không phải kết quả của tính năng được đề xuất.

### Implementation validation — 2026-09-17

- `npm test`: production Next.js/standalone build and 151 tests passed.
- `npm run lint`, `npm run check:repo`, TypeScript check and `git diff --check`: passed.
- Chrome headless: portfolio/comparison VI/EN at 375/768/1024/1440px; no horizontal
  overflow/page errors; career draft fixture interaction passed. Local screenshots
  under `.data/evidence-ui/`, not customer data or proof of a live AI provider.
- Signed issuance wire tested with deterministic test keys and mocked SAS accounts;
  mismatched payloads and deleted finalized accounts are rejected.
- New authenticated HTTP journey tests source permissions, cache invalidation,
  revocation, employer notes after trial expiry, decision events and operation privacy.
- Limitations: formal accessibility audit/physical-wallet tests and live career AI
  not run. Unknown/definitively failed issuance may require operator review.
- Browser QA initially found a loopback hostname/Origin mismatch in the test helper;
  corrected the QA origin without weakening production same-origin checks.

### Acceptance bắt buộc khi triển khai

- Privacy: A không đọc/sửa pack của B; org B không đọc application của org A; nguồn
  không được chia sẻ không xuất hiện trong API, AI input, cache, export hoặc logs.
- Grant revoke/expiry chặn đọc tiếp; downloaded copy limitation hiển thị rõ.
- Provenance: link nguồn/hash đúng; sửa/thu hồi nguồn khiến view/cache phù hợp đổi
  trạng thái; RPC outage không tạo dấu verified sai.
- Comparison: 2–3 ứng viên, cùng/khác rubric, thiếu dữ liệu, revoked và stale;
  chọn người không tự cấp tiền/credential, không tự mở rộng chia sẻ.
- AI: valid JSON nhưng citation sai vẫn bị từ chối; injection, unsupported input,
  quota, concurrent requests, cache hit, timeout, provider error và manual fallback.
- Entitlements: server enforcement, cùng lúc vượt quota, expiry/downgrade không
  khóa core rights; trial không được báo cáo là doanh thu.
- Issuance: cùng assessment concurrent; hai assessment tranh suất cuối; chain thành
  công rồi DB lỗi; retry; expired blockhash; wrong account/payload; revoked receipt.
- Chain: existing SOL/USDC instruction paths, paid/unallocated/wrong recipient,
  independent claim không gọi API SkillBridge; không broadcast duplicate khi mơ hồ.
- Existing data migration fixtures; full `npm run check:repo`, `npm run lint`, `npm test`.
- UI thực tế: desktop/mobile/split screen, keyboard, zoom, VI/EN, back/reload và lỗi mạng.
- Nếu đổi Rust/program: chạy Rust/SBF/local-validator theo runbook; không coi JS test là thay thế.
- Live cuối: OpenRouter thật và Devnet theo authority/prerequisites riêng, lưu scope và timestamp.

### Demo và phạm vi lời tuyên bố

Chuẩn bị challenge/nguồn trước để không phải chờ deadline trên sân khấu. Một bộ QA
có ghi nhãn gồm: người làm là sinh viên, một freelancer, doanh nghiệp và reviewer.

- Business: mở hồ sơ → tạo bộ hồ sơ theo mục tiêu → xem nháp AI có nguồn → doanh
  nghiệp so sánh/shortlist → xem quyền lợi/mức dùng trial. Thể hiện đầu ra đáng mua,
  không biến tên khách hàng giả định thành traction.
- Technical: truy nguồn → đổi quyền chia sẻ/thu hồi để chứng minh kiểm tra mới →
  fault-injection recovery trong môi trường QA → claim khoản đã phân bổ bằng tool
  độc lập trên Devnet. Phân biệt RPC fixtures với transaction live.
- Benchmark ghi điều kiện, mẫu và p50/p95 hoặc từng lần đo nếu mẫu nhỏ: verification
  latency, RPC calls, token usage và chain fee. Không suy ra % tiết kiệm tuyển dụng.
- Không ghi seed/API keys, raw PII hoặc raw private evidence vào repo/demo proof.

## Handoff notes

Implementation complete. Người dùng cho phép commit/push; xem Git/remote để xác nhận
publication, không dựa vào plan để suy ra deployment đã cập nhật. Hướng dẫn vận hành:
[evidence portfolios](../../../testing/evidence-portfolios.md). External acceptance
ở trên vẫn cần được ghi nhận riêng; đừng coi fixtures là giao dịch/live AI mới.

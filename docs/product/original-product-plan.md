# SKILLBRIDGE VIETNAM — QUY TRÌNH DỰ ÁN END-TO-END

> Tài liệu điều hành sản phẩm, kỹ thuật, kiểm thử và hồ sơ dự thi UniHackFest
> Trạng thái tài liệu: Living document — cập nhật sau mỗi vòng kiểm thử/pilot
> Thị trường ưu tiên: Việt Nam
> Nền tảng: AI + Solana Web3 + Education/Employment

## 1. Tên đề tài

### Tên sản phẩm

**SkillBridge Vietnam**

### Tên đề tài đầy đủ

**SkillBridge Vietnam — Nền tảng Proof-of-Skill sử dụng AI và Solana giúp sinh viên Việt Nam chứng minh năng lực, nhà trường xác thực kết quả và doanh nghiệp tuyển dụng dựa trên bằng chứng kỹ năng.**

### One-liner

SkillBridge biến một bài làm thực tế của sinh viên thành credential kỹ năng có thể xác minh trên Solana và dùng credential đó để mở khóa cơ hội từ doanh nghiệp.

### Thông điệp pitch ngắn

> CV cho biết ứng viên nói gì về bản thân. SkillBridge cho doanh nghiệp thấy ứng viên đã làm được gì, ai đã xác thực và bằng chứng có còn hiệu lực hay không.

## 2. Bối cảnh hình thành ý tưởng

Điểm xuất phát là hệ sinh thái sinh viên tại Việt Nam, đặc biệt từ bối cảnh Đại học Văn Lang — một trường có nhiều hoạt động, cuộc thi và sự kiện cho sinh viên. Những hoạt động này tạo ra rất nhiều năng lực thực tế nhưng kết quả thường bị phân mảnh trong file, email, giấy chứng nhận hoặc bài đăng mạng xã hội.

Ba nhóm đang gặp vấn đề khác nhau:

| Nhóm | Vấn đề hiện tại |
|---|---|
| Sinh viên | Có nhiều trải nghiệm nhưng khó chứng minh năng lực bằng bằng chứng đáng tin cậy; CV dễ trở thành các claim tự khai. |
| Nhà trường | Khó chuyển kết quả từ môn học, sự kiện, challenge và hoạt động ngoại khóa thành hồ sơ năng lực có thể xác minh. |
| Doanh nghiệp | Tốn thời gian sàng lọc CV, khó kiểm tra claim và khó tìm sinh viên đã chứng minh đúng kỹ năng cần thiết. |

Ý tưởng ban đầu về kết nối ban tổ chức sự kiện với sinh viên được mở rộng thành hạ tầng ba bên:

**Sinh viên ↔ Nhà trường ↔ Doanh nghiệp**

Sự kiện và challenge vẫn là kênh tạo bằng chứng, nhưng không còn là toàn bộ phạm vi sản phẩm.

## 3. Problem statement

Sinh viên Việt Nam thiếu một cơ chế đơn giản để biến kết quả công việc thật thành proof-of-skill có thể sở hữu và tái sử dụng. Nhà trường thiếu công cụ xác thực theo quy trình human-in-the-loop. Doanh nghiệp thiếu một lớp kiểm chứng kỹ năng trước khi cấp quyền tiếp cận cơ hội.

## 4. Product thesis

Nếu sinh viên có thể:

1. Nhận một challenge thực tế từ doanh nghiệp hoặc nhà trường.
2. Nộp evidence thay vì chỉ tự khai năng lực.
3. Được AI đánh giá theo rubric với trích dẫn nguồn.
4. Được con người có thẩm quyền phê duyệt.
5. Nhận credential gắn với ví cá nhân trên Solana.
6. Dùng credential còn hiệu lực để mở khóa cơ hội.

thì quá trình chứng minh năng lực sẽ minh bạch, có thể kiểm tra, có khả năng tái sử dụng và ít phụ thuộc vào một cơ sở dữ liệu tập trung duy nhất.

## 5. Vì sao cần AI và Web3

### Vai trò của AI

AI không phải chatbot trang trí. AI thực hiện một công việc cụ thể trong product workflow:

- Trích xuất evidence có thể chấm điểm từ file sinh viên nộp.
- Đánh giá evidence theo rubric định sẵn.
- Trả về structured output theo JSON schema.
- Gắn từng nhận định với source/locator cụ thể.
- Phát hiện dấu hiệu prompt injection trong evidence.
- Tạo draft để reviewer con người kiểm tra, không tự phát hành credential.

### Vai trò của Solana

Solana không được dùng chỉ để thêm nhãn Web3. Solana đảm nhiệm các trạng thái cần khả năng kiểm chứng độc lập:

- Ví là danh tính và quyền sở hữu của sinh viên.
- Credential là digital asset/proof có thể xác minh.
- Trạng thái active/revoked có thể kiểm tra từ bên ngoài ứng dụng.
- Opportunity policy được program thực thi độc lập.
- Access receipt chứng minh một credential hợp lệ đã vượt qua điều kiện tại một thời điểm.
- Solana Explorer cung cấp bằng chứng giao dịch cho giám khảo và đối tác.

### Những dữ liệu không đưa lên chain

- File bài làm gốc.
- Thông tin cá nhân không cần thiết.
- Nội dung đánh giá chi tiết.
- Email và dữ liệu vận hành nội bộ.

On-chain chỉ lưu claim tối thiểu, địa chỉ, hash, score/policy cần thiết và bằng chứng trạng thái. Đây là nguyên tắc **minimum on-chain disclosure**.

## 6. Phạm vi thị trường

### Giai đoạn đầu

- Việt Nam.
- Sinh viên đại học có hoạt động dự án, cuộc thi, sự kiện hoặc challenge thực tế.
- Trường đại học có nhu cầu xác thực kỹ năng ngoài điểm số truyền thống.
- Doanh nghiệp cần tuyển intern, fresher hoặc talent trẻ theo năng lực thực tế.

### Beachhead market đề xuất

1. Một khoa/câu lạc bộ/đơn vị tại Đại học Văn Lang.
2. Một challenge thật với một doanh nghiệp đối tác.
3. 20–50 sinh viên tham gia pilot.
4. 2–5 reviewer từ nhà trường.
5. 1–3 vị trí hoặc cơ hội được mở khóa bằng credential.

### Mở rộng sau pilot

- Các trường đại học khác tại TP.HCM.
- Hackathon, innovation hub và cộng đồng sinh viên.
- Chương trình tuyển intern/fresher của doanh nghiệp.
- Student reputation passport xuyên trường.

## 7. Các role và quyền hạn

| Role | Trách nhiệm | Không được phép |
|---|---|---|
| Student | Đăng nhập bằng ví, nhận challenge, nộp evidence, xem kết quả, nhận credential, dùng credential để kiểm tra cơ hội. | Không tự chấm, tự phê duyệt hoặc tự phát hành credential. |
| University Admin/Reviewer | Thiết lập issuer, xem submission được phân quyền, kiểm tra AI draft, phê duyệt/từ chối, issue hoặc revoke credential. | Không thay sinh viên nộp bài; không tạo access receipt giả. |
| Business Admin/Challenge Manager | Tạo challenge, mời sinh viên, tạo opportunity và điều kiện score/issuer, xác minh eligibility. | Không tự cấp credential đại diện nhà trường. |
| Platform | Điều phối workflow, lưu audit log, gọi AI, xác minh attestation và gửi giao dịch được ủy quyền. | Không được bỏ qua human approval hoặc giả lập giao dịch trong production flow. |

## 8. Golden flow của sản phẩm

### Luồng production end-to-end

1. Mỗi người dùng chuẩn bị một ví Solana khác nhau.
2. Người dùng ký thông điệp Sign In With Solana; server xác minh chữ ký và chống replay.
3. Business tạo organization và challenge.
4. Business phát hành invitation cho Student và/hoặc University.
5. Student nhận challenge và tạo participation.
6. Student viết reflection, khai báo evidence source và upload file.
7. Hệ thống lưu file vào R2, metadata/hash/workflow vào D1.
8. AI trích xuất evidence từ file khi cần.
9. AI tạo assessment draft theo rubric và chỉ được cite evidence đã cung cấp.
10. Validation engine kiểm tra schema, điểm số, citation, locator và grounding coverage.
11. University reviewer đọc evidence, AI draft và reviewer flags.
12. Reviewer phê duyệt hoặc yêu cầu xử lý lại.
13. University phát hành Solana Attestation Service credential trên Devnet.
14. Student nhìn thấy credential trong Skill Passport và trang public verification.
15. Business tạo opportunity với issuer bắt buộc và minimum score.
16. Anchor program tạo policy PDA trên Devnet.
17. Student yêu cầu kiểm tra quyền truy cập opportunity.
18. Backend xác minh attestation còn active, đúng schema, đúng student wallet và đủ score.
19. Anchor program ghi access receipt PDA không trùng lặp.
20. Opportunity được mở khóa.
21. Khi University revoke credential, lần xác minh sau phải bị từ chối.

### Luồng demo cho giám khảo

`/workspace` là console mô phỏng cô lập để kể câu chuyện nhanh và tránh demo bị gián đoạn. Console phải luôn được gắn nhãn preview. Luồng production thật nằm dưới `/app` và yêu cầu đăng nhập bằng các ví khác nhau.

## 9. Trạng thái workflow cần hỗ trợ

```text
Challenge draft
  → published
  → invited
  → accepted
  → evidence submitted
  → AI draft generated
  → in human review
  → approved
  → credential issued
  → opportunity verified/unlocked
  → credential revoked (nếu có)
  → opportunity access denied ở lần kiểm tra tiếp theo
```

Không role nào được nhảy qua bước không thuộc quyền của mình.

## 10. Kiến trúc hệ thống

### Application layer

- React 19 + TypeScript.
- Vinext/Vite, Cloudflare Worker-compatible runtime.
- Responsive web app cho ba role.
- Sign In With Solana và server session.

### Data layer

- Cloudflare D1: user, wallet, organization, membership, challenge, invitation, submission, assessment, review, credential metadata, opportunity, access grant và audit log.
- Cloudflare R2: evidence files.
- Không dùng browser storage cho dữ liệu nghiệp vụ quan trọng.

### AI layer

- OpenAI Responses API.
- Model mặc định: `gpt-5.6-luna`.
- Structured Outputs với JSON schema.
- Evidence firewall và prompt-injection detection.
- Human-in-the-loop approval bắt buộc.
- `store: false` cho API request hiện tại.

### Solana layer

- Network: Solana Devnet.
- Wallet-based authentication.
- Solana Attestation Service cho credential/schema/attestation/revocation.
- Anchor/Rust program cho opportunity policy và access receipt.
- Program ID:

```text
AuXFxfT41YMsG53euEB1tFjyUiMLKxfucQnYX4jhekCE
```

### Security layer

- Same-origin protection cho mutation endpoint.
- Session authentication và server-side RBAC.
- Rate limiting cho các thao tác nhạy cảm/tốn chi phí.
- Audit trail.
- Secret chỉ nằm ở server runtime.
- Không commit API key hoặc Solana private key.
- Public verification không hiển thị evidence riêng tư.

## 11. Bằng chứng kỹ thuật hiện có

### Product URL

<https://skillbridge-vietnam-demo.yfydeuuefiifis865nov.chatgpt.site>

Hiện site được triển khai ở chế độ private/custom access.

### Solana program

- Program: <https://explorer.solana.com/address/AuXFxfT41YMsG53euEB1tFjyUiMLKxfucQnYX4jhekCE?cluster=devnet>
- Deployment transaction: <https://explorer.solana.com/tx/2cJrpTCdD8d3yAfrKnvshq1uJrvLUMYnDNiw14zbqQh5ruxupcA9hKqgns3eTLevhcrdTZsb2S7DdHffEfCmkWW7?cluster=devnet>

### Devnet end-to-end smoke proof

- Credential transaction: <https://explorer.solana.com/tx/2xCs9ZLzUjYjn3x7joHFVQJ9Du5fmRncGrGWRfqBs9MQZQha7v8eSLPqCsPFNgepEz9WhiW4cbEHUv2222Na1Z85?cluster=devnet>
- Schema transaction: <https://explorer.solana.com/tx/4tn8VDH8aitZav7Fhzy2hFx8nfH4HZSrmatXWiPGzAeKVZBNeiKdTgyEHLZSBUZXnNSf8xyh9fsQqTonfQKtPtdQ?cluster=devnet>
- Attestation transaction: <https://explorer.solana.com/tx/3DGmZV4euE4xpcqo5efunxzedL4npJa22QhHDUaQV9GyBTjHyP2AgsQ7LvZBHgkdwtiHwmSYSgz6H1o3o5Mofigd?cluster=devnet>
- Policy transaction: <https://explorer.solana.com/tx/495SptGrMyUGyXwEFmexmAya7QSwr2K5ZwavqhD4oXcpikqPwY1X3VLKz2neRj5niwsdhv8Kj6qLjm6EdHRRAnpn?cluster=devnet>
- Access receipt transaction: <https://explorer.solana.com/tx/35nrHd76iPnXxbmyC5kEov6S2j9dRQZyuw8jDsDhptfdXesKqEpmfRAJT5zvREoaqvjed9bJyBRgKEHHGcdU4RSL?cluster=devnet>

### Automated validation

- Build production: PASS.
- Lint: PASS.
- Automated application tests: **52/52 PASS**.
- Anchor policy tests: PASS.
- Local validator deployment/smoke test: PASS.
- Live Devnet credential → verification → policy → receipt smoke test: PASS.

## 12. Đối chiếu với yêu cầu UniHackFest

Nguồn tiêu chí: <https://docs.unihackfest.vn/>

UniHackFest yêu cầu ít nhất 3/5 lớp Digital Asset, Solana, AI, Education và Business. SkillBridge thiết kế để đáp ứng cả 5 lớp.

| Lớp | SkillBridge đáp ứng bằng gì | Trạng thái hiện tại | Điều kiện PASS cuối |
|---|---|---|---|
| Digital Asset | Wallet-owned proof-of-skill credential, reputation asset và credential-gated access. | PASS kỹ thuật | Pitch giải thích rõ vì sao credential on-chain tốt hơn chứng chỉ file/PDF. |
| Solana | Wallet login, SAS credential, Devnet transaction, Anchor program, PDA, Explorer proof. | PASS kỹ thuật | Demo trực tiếp và có backup Explorer links/video. |
| AI | Evidence extraction, rubric assessment, structured output, safety validation, human review. | BLOCKED một phần | OpenAI account có credits và ít nhất 3 assessment thật chạy thành công. |
| Education | Student challenge, university reviewer, skill credential và passport. | PASS về use case | Có pilot/user interview chứng minh nhu cầu thực. |
| Business | Employer challenge, opportunity policy và credential-based talent access. | PARTIAL | Hoàn thành GTM, pricing/sustainability và partner adoption plan. |

## 13. Scorecard theo 100 điểm của cuộc thi

| Tiêu chí | Trọng số | Bằng chứng cần chuẩn bị | Trạng thái |
|---|---:|---|---|
| Solana Integration | 20% | Program ID, wallet flow, Devnet transactions, credential, PDA, access receipt, Explorer demo. | PASS kỹ thuật |
| Digital Asset Design | 15% | Luận điểm về ownership, portability, revocation, minimal on-chain disclosure và credential-gated access. | Cần hoàn thiện slide |
| AI Integration | 15% | AI chạy thật, structured output, source citation, eval, failure case và human approval. | Chờ API credits + live test |
| Technical Execution | 10% | Live app, architecture, tests, error handling, rate limit, audit, backup demo. | PASS tự động; chờ manual role QA |
| Product Experience | 10% | Journey rõ, wallet onboarding dễ hiểu, trạng thái/feedback tốt, mobile usable. | Chờ manual usability test |
| Market & GTM | 10% | First users, market sizing, pilot design, partner pipeline, pricing. | Chưa PASS |
| Problem Clarity | 10% | Interview quotes/data từ student, university, business; problem statement cụ thể. | Chưa PASS đầy đủ |
| Education/Community Impact | 5% | Impact metrics và kế hoạch đo pilot. | Cần hoàn thiện |
| Pitch Quality | 5% | Deck 8–10 slide, live script, FAQ, demo video, rehearsal. | Chưa thực hiện |

### Kết luận scorecard

Sản phẩm đã mạnh ở phần technical build và Solana proof. Rủi ro lớn nhất để cạnh tranh giải cao không còn là “thiếu tính năng”, mà là:

1. Chưa có live AI test do chưa có API credits.
2. Chưa hoàn thành manual QA bằng ba ví/ba role.
3. Chưa có user research và pilot evidence.
4. Chưa có market sizing, GTM, business/sustainability model.
5. Chưa đóng gói pitch deck, demo video và FAQ.

## 14. Toàn bộ quy trình dự án từ ý tưởng đến Demo Day

### Giai đoạn 0 — Chốt đề tài và nguyên tắc sản phẩm

**Công việc**

- Chốt tên SkillBridge Vietnam.
- Chốt ba nhóm người dùng.
- Chốt proof-of-skill là core asset.
- Chốt thị trường Việt Nam trước.
- Chốt AI chỉ tạo draft; con người quyết định.
- Chốt không phát hành token nếu token chưa giải quyết thêm vấn đề.

**Đầu ra**

- One-liner.
- Problem statement.
- Product thesis.
- Why AI / Why Solana / Why now.

**PASS khi**

- Một người ngoài nhóm có thể hiểu sản phẩm trong 30 giây.
- Mỗi công nghệ đều có nhiệm vụ sản phẩm rõ ràng.

### Giai đoạn 1 — Market-first validation

**Công việc**

- Phỏng vấn tối thiểu 10 sinh viên.
- Phỏng vấn tối thiểu 3 giảng viên/reviewer/đơn vị nhà trường.
- Phỏng vấn tối thiểu 3 người từ HR/talent/business.
- Ghi lại current workflow, pain, frequency, cost và workaround.
- Phân tích 5–8 đối thủ/giải pháp thay thế.
- Ước tính TAM/SAM/SOM với assumption ghi rõ.

**Đầu ra**

- Interview notes đã ẩn danh.
- Persona và jobs-to-be-done.
- Market Opportunity Memo.
- Competitor matrix.
- Market sizing sheet.
- Problem evidence slide.

**PASS khi**

- Có ít nhất 3 insight lặp lại ở mỗi nhóm chính.
- Có một beachhead segment cụ thể.
- Có bằng chứng người dùng đang dùng workaround hoặc chịu chi phí hiện tại.

### Giai đoạn 2 — Product definition

**Công việc**

- Viết PRD.
- Chốt role, permission và state machine.
- Chốt MVP/non-goals.
- Viết acceptance criteria cho từng flow.
- Xác định dữ liệu on-chain/off-chain.

**Đầu ra**

- PRD.
- User journey ba role.
- Permission matrix.
- State diagram.
- Data classification.
- MVP scope và backlog sau MVP.

**PASS khi**

- Không có action nghiệp vụ nào thiếu owner.
- Không có role nào có thể tự tạo và tự xác nhận proof của chính mình.
- Mỗi feature đều liên kết với một user problem hoặc tiêu chí cuộc thi.

### Giai đoạn 3 — Technical design

**Công việc**

- Thiết kế architecture.
- Thiết kế D1 schema và R2 storage.
- Thiết kế AI contract/evaluation.
- Thiết kế Solana credential và Anchor policy accounts.
- Threat modeling và risk register.

**Đầu ra**

- Architecture diagram.
- Database/data-flow diagram.
- AI workflow diagram.
- Solana transaction/PDA diagram.
- Threat model.
- Technical decision log.

**PASS khi**

- Reviewer kỹ thuật có thể lần theo dữ liệu từ UI đến DB/AI/chain.
- PII không bị đưa lên chain ngoài mục đích cần thiết.
- Secret không đi qua client.

### Giai đoạn 4 — Build nền tảng và identity

**Công việc**

- Xây landing và app shell.
- Kết nối ví Solana.
- Thực hiện SIWS challenge/verify/session/logout.
- Xây organization, invitation, membership và RBAC.
- Thêm same-origin, rate limit và audit.

**Đầu ra**

- Wallet login hoạt động.
- Ba ví tạo ba session/role riêng.
- Role-restricted navigation/action.
- Audit events.

**PASS khi**

- Signature sai, domain sai và replay đều bị từ chối.
- Student không gọi được API dành cho University/Business.

### Giai đoạn 5 — Build business workflow

**Công việc**

- Challenge CRUD/publish.
- Invitation và acceptance.
- Submission/reflection/evidence source.
- Upload/download/delete evidence file.
- Review queue và decision.

**Đầu ra**

- Challenge workspace.
- Submission workspace.
- Review workspace.
- D1/R2 persistence.

**PASS khi**

- Dữ liệu vẫn còn sau refresh/re-login.
- Người không có quyền không đọc được file/submission.
- State transition sai bị server từ chối.

### Giai đoạn 6 — Build và kiểm định AI layer

**Công việc**

- Kết nối OpenAI Responses API.
- Structured output schema.
- Evidence-only citations.
- Prompt injection detector.
- Validation contract.
- Human reviewer workflow.
- Rate limit/cost control.

**Đầu ra**

- Assessment JSON hợp lệ.
- Rubric score và total score.
- Citation/source locator.
- Reviewer flags và unsupported claims.
- AI provenance: provider, model, timestamp, validation status.
- Eval report.

**PASS khi**

- Có tối thiểu 3 live assessments chạy thành công.
- AI không cite source không tồn tại.
- Điểm tổng bằng tổng rubric items.
- Prompt injection test bị phát hiện hoặc vô hiệu hóa.
- Credential không thể issue nếu chưa có human approval.

### Giai đoạn 7 — Build Solana credential layer

**Công việc**

- Bootstrap issuer và schema.
- Issue attestation.
- Public verify.
- Revoke attestation.
- Hiển thị Explorer links.

**Đầu ra**

- Credential address.
- Schema address.
- Attestation address.
- Issue/revoke transaction.
- Public verification page.

**PASS khi**

- Attestation active verify thành công.
- Sai wallet/challenge/schema/score bị từ chối.
- Credential revoked không còn valid.

### Giai đoạn 8 — Build opportunity gate program

**Công việc**

- Anchor/Rust program.
- Policy PDA theo opportunity.
- Minimum score, issuer/schema/verifier rules.
- Unique access receipt PDA.
- Deploy Devnet.
- Frontend/backend integration.

**Đầu ra**

- Program ID.
- Deployment transaction.
- Policy PDA/transaction.
- Receipt PDA/transaction.
- Rust unit tests và Devnet smoke result.

**PASS khi**

- Program executable trên Devnet.
- Policy sai hoặc score thấp bị từ chối.
- Không tạo receipt trùng cho cùng subject/credential/policy.
- Explorer kiểm tra được tất cả transaction quan trọng.

### Giai đoạn 9 — Automated QA và security gate

**Công việc**

- Build production.
- Lint.
- Contract tests.
- Authorization tests.
- SIWS security tests.
- Lifecycle tests.
- Devnet smoke test.

**Đầu ra**

- Test report.
- Known issues.
- Risk register cập nhật.
- Release candidate.

**PASS khi**

- Build/lint PASS.
- 100% critical test PASS.
- Không commit secret.
- Không còn blocker severity cao chưa có mitigation.

### Giai đoạn 10 — Manual QA bằng người dùng thật

**Chuẩn bị**

- Wallet A: Business.
- Wallet B: Student.
- Wallet C: University.
- Một challenge thực tế.
- Một file evidence mẫu hợp lệ và một file có prompt injection.
- OpenAI credits.
- Devnet SOL đủ cho transaction.

**Kịch bản PASS**

1. Ba wallet đăng nhập độc lập.
2. Mỗi wallet chỉ nhìn thấy action đúng role.
3. Business tạo challenge và mời Student.
4. Student accept và submit evidence.
5. AI tạo draft thật, không fallback fixture.
6. University review và approve.
7. Credential issue thành công trên Devnet.
8. Public verification trả active.
9. Business tạo opportunity policy.
10. Student đủ điểm nhận access granted và receipt transaction.
11. University revoke credential.
12. Verification sau revoke trả denied.
13. Audit log phản ánh toàn bộ action chính.

**Đầu ra**

- Manual QA checklist có timestamp.
- Screenshot/video từng bước.
- Wallet/transaction proof đã che thông tin nhạy cảm.
- Bug log và retest result.

### Giai đoạn 11 — Pilot và traction

**Công việc**

- Chạy một pilot nhỏ tại VLU hoặc cộng đồng phù hợp.
- Thu thập funnel và feedback.
- Đo thời gian review, completion và verification.

**Metric đề xuất**

- Số student onboarded.
- Wallet sign-in completion rate.
- Challenge acceptance/completion rate.
- Số assessment được reviewer approve.
- Thời gian từ submission đến credential.
- Số credential được verify bởi business.
- Số opportunity unlock.
- Reviewer correction rate đối với AI draft.
- Chi phí AI trên mỗi assessment.
- NPS/qualitative feedback.

**PASS khi**

- Có ít nhất một challenge và người dùng ngoài nhóm hoàn thành golden flow.
- Có feedback từ đủ ba phía hoặc tối thiểu hai phía với partner commitment rõ.
- Có một con số traction thật đưa vào pitch.

### Giai đoạn 12 — Business model và GTM

**Giả thuyết mô hình doanh thu**

- B2B SaaS/pilot fee cho university hoặc doanh nghiệp.
- Phí theo số assessment/credential đã phát hành.
- Talent access/recruitment campaign fee cho doanh nghiệp.
- Không thu phí sinh viên trong giai đoạn đầu.

**GTM wedge đề xuất**

1. Bắt đầu từ một challenge có sponsor/doanh nghiệp.
2. Nhà trường làm trust issuer.
3. Sinh viên tham gia miễn phí để tạo supply.
4. Doanh nghiệp nhận shortlist theo verified skill.
5. Mở rộng từ challenge sang Skill Passport xuyên chương trình/trường.

**Đầu ra**

- Pricing hypothesis.
- Unit economics sơ bộ.
- Partner pipeline.
- 90-day GTM plan.
- Adoption playbook.

**PASS khi**

- Xác định rõ ai là user, ai là buyer và ai là issuer.
- Có ít nhất 3 partner conversations hoặc 1 pilot commitment.
- Có cách vận hành bền vững sau hackathon.

### Giai đoạn 13 — Pitch và submission package

**Công việc**

- Chốt câu chuyện trước/sau khi có SkillBridge.
- Chuẩn bị demo trực tiếp và backup video.
- Chuẩn bị câu trả lời về Web3 necessity, AI hallucination, privacy, cost và adoption.

**PASS khi**

- Demo 2–3 phút không có bước thừa.
- Pitch nằm trong thời lượng.
- Mọi claim quan trọng đều có proof.
- Có phương án fallback nếu ví/RPC/API gặp lỗi.

### Giai đoạn 14 — Triển khai production trên Vercel

**Mục tiêu**

Sau khi bản beta, manual QA và demo dự thi đã ổn định, chuyển web application
sang Vercel để có preview deployment theo từng thay đổi và môi trường production
phù hợp cho giai đoạn pilot/mở rộng.

**Công việc**

- Chuyển Vinext/Cloudflare runtime sang Next.js runtime tương thích Vercel.
- Chuyển D1 sang managed Postgres; giữ R2 qua S3-compatible API hoặc chuyển file
  evidence sang Vercel Blob.
- Cấu hình OpenAI, Solana RPC và signer bằng Vercel Environment Variables.
- Tách rõ Development, Preview và Production; không dùng chung dữ liệu hoặc
  secret giữa các môi trường.
- Chạy lại automated tests và manual golden flow ba role trên Vercel Preview.
- Chỉ promote bản Preview đã PASS lên Production và gắn custom domain.

**PASS khi**

- Vercel Preview build và chạy đủ các route/API quan trọng.
- Dữ liệu, upload evidence, wallet sign-in và session hoạt động ổn định.
- AI assessment, credential issue/revoke và opportunity gate PASS end-to-end.
- Không có secret trong repository hoặc client bundle.
- Có rollback plan và bản demo dự phòng nếu production gặp sự cố.

Solana program và các địa chỉ on-chain không phụ thuộc web host, vì vậy không
cần deploy lại chỉ vì chuyển frontend/backend sang Vercel.

## 15. Mười deliverables bắt buộc cần hoàn thành

| # | Deliverable | Nội dung tối thiểu | Điều kiện PASS | Trạng thái |
|---:|---|---|---|---|
| 1 | Product One-Pager | Problem, solution, target users, value proposition, why AI/Solana, current proof. | Đọc trong 2 phút và hiểu toàn bộ thesis. | TODO |
| 2 | Market Opportunity Memo | Market insight, segment, competitors, sizing, opportunity thesis. | Có nguồn và interview evidence, không chỉ suy đoán. | TODO |
| 3 | PRD | Scope, roles, user stories, flows, states, acceptance criteria, non-goals. | Dev/QA có thể test từ tài liệu. | PARTIAL — cần tách thành artifact riêng |
| 4 | Solana Technical Proof | Program, wallet flow, Devnet tx, credential, PDA, Explorer. | Links hoạt động và demo được. | PASS kỹ thuật |
| 5 | AI Feature Demo | AI thật, structured output, citation, eval, human review. | Không fixture; có ít nhất 3 case và 1 failure case. | BLOCKED — cần credits |
| 6 | Pitch Deck | 8–10 slides theo cấu trúc cuộc thi. | Có market, product, traction, business model, team, ask. | TODO |
| 7 | Demo Video | Walkthrough 2–3 phút. | Thấy wallet, AI, Devnet transaction/Explorer và outcome. | TODO |
| 8 | Technical Appendix | Architecture, data, AI, Solana, security, tests. | Judge kỹ thuật kiểm tra được logic. | TODO |
| 9 | Risk & Compliance Note | Wallet, custody, privacy, AI, fraud, user protection, Devnet limits. | Mỗi risk có mitigation/owner. | PARTIAL — app đã có risk page |
| 10 | GTM Plan | First users, pilot, university/business adoption, pricing/sustainability. | Có timeline, owner, metric và partner targets. | TODO |

## 16. Pitch deck 10 slide đề xuất

1. **Title + one-liner** — SkillBridge Vietnam.
2. **Problem** — CV claim, fragmented proof và verification cost.
3. **Why now / Market** — student talent, university activities, skill-based hiring, Web3 credential.
4. **Solution** — challenge → evidence → AI → human approval → credential → opportunity.
5. **Product demo** — ba role và golden flow.
6. **Why AI + Why Solana** — chức năng cụ thể, không buzzword.
7. **Technical proof** — architecture, Program ID, Explorer transactions, tests.
8. **Market/GTM/business model** — VLU wedge → Vietnam universities/businesses.
9. **Traction/impact/roadmap** — pilot numbers, metrics, next 90 days.
10. **Team + ask** — partner, pilot, mentor, ecosystem support.

## 17. Demo video 2–3 phút đề xuất

### 0:00–0:20 — Problem

Một sinh viên có năng lực thật nhưng doanh nghiệp chỉ thấy CV tự khai. Nhà trường có thể xác thực nhưng dữ liệu không di chuyển theo sinh viên.

### 0:20–0:40 — Solution

Giới thiệu SkillBridge và sơ đồ challenge → proof-of-skill → opportunity.

### 0:40–1:20 — Product flow

- Business tạo challenge.
- Student đăng nhập bằng ví và nộp evidence.
- AI tạo assessment có citation.
- University reviewer phê duyệt.

### 1:20–1:55 — Web3 proof

- Credential xuất hiện trong passport.
- Mở public verification.
- Mở Explorer transaction.
- Business kiểm tra opportunity và receipt.

### 1:55–2:20 — Trust/safety

- Human-in-the-loop.
- Revocation.
- Không đưa file/PII lên chain.

### 2:20–2:50 — Market và impact

- VLU pilot wedge.
- Giá trị cho student/university/business.
- Next step/ask.

## 18. Manual test matrix chi tiết

| ID | Actor | Action | Expected result |
|---|---|---|---|
| AUTH-01 | Tất cả | Ký SIWS đúng challenge | Đăng nhập thành công, session gắn đúng wallet. |
| AUTH-02 | Attacker | Replay signature | Bị từ chối. |
| RBAC-01 | Student | Gọi API issue credential | 403/denied. |
| CH-01 | Business | Tạo/publish challenge | Challenge được lưu và xuất hiện đúng phạm vi. |
| INV-01 | Business | Mời Student | Token/link hợp lệ, dùng một lần. |
| SUB-01 | Student | Upload evidence | File nằm ở R2, hash/metadata nằm ở D1. |
| AI-01 | University flow | Generate assessment | Provenance là `openai`, schema validation PASS. |
| AI-02 | Malicious evidence | Chứa lệnh override prompt | Không làm thay đổi system rule; flag xuất hiện. |
| REV-01 | University | Approve assessment | Chỉ reviewer đúng quyền thực hiện được. |
| SOL-01 | University | Issue credential | Devnet transaction confirmed; Explorer mở được. |
| VER-01 | Public | Verify active credential | Trả active/valid với claim tối thiểu. |
| OPP-01 | Business | Tạo policy minimum score | Policy PDA được tạo. |
| OPP-02 | Student đủ điều kiện | Verify opportunity | Access granted, receipt PDA được ghi. |
| OPP-03 | Student thiếu điểm/sai issuer | Verify opportunity | Access denied, không có receipt giả. |
| REV-02 | University | Revoke credential | Transaction confirmed. |
| VER-02 | Public/Business | Verify sau revoke | Invalid/denied. |
| AUD-01 | Admin | Xem audit | Có actor, action, target, timestamp và metadata phù hợp. |

## 19. Risk register tối thiểu

| Risk | Tác động | Mitigation | PASS gate |
|---|---|---|---|
| AI hallucination | Chấm sai hoặc tạo claim giả | Structured schema, citation validation, unsupported claim flags, human approval. | Eval cases PASS. |
| Prompt injection trong file | Evidence điều khiển model | Evidence treated as untrusted data, detector, system rule, validation. | Red-team test PASS. |
| Wallet/key loss | Mất quyền truy cập identity | Pilot education, recovery/migration roadmap, không custody seed phrase. | UX warning rõ. |
| API key leak | Mất tiền/dữ liệu | Server-only secret, ignored env, rate limit, rotation plan. | Secret scan PASS. |
| OpenAI cost spike | Vượt ngân sách | Luna model, prepaid credits, auto-recharge off, rate limit, usage monitoring. | Budget policy ghi rõ. |
| Devnet reset/instability | Demo thất bại | Backup video, Explorer proof, isolated judge console. | Backup demo sẵn sàng. |
| RPC/faucet rate limit | Transaction chậm | Dự trữ Devnet SOL, retry UX, pre-demo health check. | Runbook có owner. |
| PII on-chain | Không thể xóa dữ liệu | Minimum disclosure, hash/address only, files off-chain. | Data review PASS. |
| Unauthorized role action | Fraudulent credential | Server RBAC, membership checks, audit, smart-contract constraints. | Negative tests PASS. |
| Credential still used after revoke | Sai trust decision | Live on-chain verification trước access; revoked credential denied. | Revocation E2E PASS. |

## 20. Definition of Done toàn dự án

Dự án chỉ được xem là **competition-ready**, không chỉ “code xong”, khi toàn bộ điều kiện sau PASS:

- [ ] Live app truy cập ổn định bằng tài khoản giám khảo hoặc chế độ đã thống nhất.
- [ ] Ba ví thật hoàn thành manual golden flow.
- [ ] OpenAI live assessment chạy thành công, không dùng fixture trong production demo.
- [ ] Human approval bắt buộc trước issuance.
- [x] Solana program chạy trên Devnet.
- [x] Credential/policy/receipt có Explorer proof.
- [ ] Active → revoke → denied được demo end-to-end.
- [x] Build, lint và critical automated tests PASS.
- [ ] Không còn blocker/security issue mức cao.
- [ ] Có user research thật và market sizing có nguồn.
- [ ] Có ít nhất một pilot/partner conversation đáng tin cậy.
- [ ] Hoàn thành đủ 10 deliverables.
- [ ] Deck, video, live script và FAQ đã mock pitch ít nhất hai vòng.
- [ ] Có backup video và danh sách Explorer links nếu live demo lỗi.
- [ ] Mỗi claim trong pitch có bằng chứng hoặc được ghi rõ là hypothesis.

## 21. Thứ tự việc cần làm tiếp theo

### P0 — Blocker kỹ thuật trước manual test

1. Nạp mức OpenAI prepaid nhỏ và tắt auto-recharge.
2. Chạy một API health test.
3. Xác nhận production AI provenance là `openai`.
4. Chuẩn bị ba ví cho ba role.

### P1 — Manual end-to-end QA

1. Test Business.
2. Test Student.
3. Test University.
4. Test AI assessment và human approval.
5. Test issue/verify/opportunity/revoke.
6. Ghi bug và retest.

### P2 — Market validation và pilot

1. Lập interview guide.
2. Tuyển interview participants.
3. Tổng hợp insights.
4. Chốt pilot challenge tại VLU/đối tác.
5. Thu thập traction metrics.

### P3 — Hồ sơ dự thi

1. Product One-Pager.
2. Market Opportunity Memo.
3. PRD chính thức.
4. Technical Appendix.
5. Risk & Compliance Note.
6. GTM Plan.
7. Pitch Deck.
8. Demo Video.
9. FAQ.
10. Mock pitch và final polish.

### P4 — Vercel production deployment sau khi demo ổn định

1. Chuẩn bị kiến trúc Next.js + Postgres/object storage cho Vercel.
2. Tạo Preview deployment và cấu hình secret theo từng environment.
3. Migration dữ liệu từ D1 và xác minh toàn vẹn file/evidence metadata.
4. Chạy automated QA và manual three-wallet QA trên Preview.
5. Promote Production, gắn custom domain, bật monitoring và chuẩn bị rollback.

## 22. Các câu hỏi giám khảo có khả năng đặt ra

### Tại sao không dùng database Web2?

Database vẫn được dùng cho workflow và dữ liệu riêng tư. Solana được dùng cho proof cần ownership, portability, revocation state và independent verification. Đây là kiến trúc hybrid, không ép mọi dữ liệu lên chain.

### Tại sao AI được quyền chấm sinh viên?

AI không có quyền quyết định cuối. AI tạo draft có citation và validation; reviewer con người phê duyệt. Credential chỉ được issue sau human approval.

### Làm sao chống sinh viên gian lận?

Evidence được hash/lưu nguồn, AI chỉ cite nguồn đã nộp, reviewer kiểm tra claim, audit log ghi lại action và credential có thể revoke. Pilot tiếp theo cần bổ sung rubric/identity/fraud policy theo từng challenge.

### Vì sao doanh nghiệp sẽ dùng?

Giả thuyết giá trị là giảm thời gian xác minh claim và tạo shortlist theo kỹ năng đã được issuer tin cậy xác thực. Giả thuyết này phải được chứng minh bằng interview/pilot metrics trước Demo Day.

### Có cần token không?

Không ở MVP. Credential và access receipt đã là digital asset/on-chain proof có utility rõ. Chỉ thêm token khi có incentive/payment use case đã được kiểm chứng.

### Sản phẩm có phải chỉ dành cho Văn Lang?

Không. VLU là beachhead để có first users và pilot nhanh. Data model hỗ trợ nhiều university, business và student organization tại Việt Nam.

## 23. Nguồn tham chiếu

- UniHackFest Learning Track, Capstone requirements, deliverables và judging criteria: <https://docs.unihackfest.vn/>
- SkillBridge live pilot: <https://skillbridge-vietnam-demo.yfydeuuefiifis865nov.chatgpt.site>
- Solana Explorer program proof: <https://explorer.solana.com/address/AuXFxfT41YMsG53euEB1tFjyUiMLKxfucQnYX4jhekCE?cluster=devnet>

---

## Tóm tắt điều hành

SkillBridge Vietnam đã vượt qua cột mốc prototype kỹ thuật: có web app, wallet authentication, RBAC ba role, evidence storage, AI assessment contract, human review, Solana credential, Anchor program, Devnet proof và automated tests. Để chuyển từ **technical MVP** thành **ứng viên cạnh tranh giải cao**, nhóm phải ưu tiên live AI validation, manual three-wallet QA, user research/pilot evidence và bộ 10 deliverables/pitch hoàn chỉnh.

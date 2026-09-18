Nội dung slide SkillBridge Vietnam
Slide 1 — SkillBridge Vietnam
UNIHACKFEST · HƯỚNG ĐI: BEST TECHNICAL BUILD
SKILLBRIDGE VIETNAM
SkillBridge biến bài làm thực tế thành bằng chứng kỹ năng có thể kiểm chứng — AI hỗ trợ, con người quyết định, kết quả mang theo sang cơ hội tiếp theo.
Vai trò
- Doanh nghiệp
- Sinh viên
- Người đánh giá
Công nghệ
- Devnet · thử nghiệm
- Web App
- Human Review
- AI Assist · AI hỗ trợ
Luồng sản phẩm
Thử thách → Bằng chứng → Đánh giá → Chứng nhận → Cơ hội

Slide 2 — Vấn đề
CV cho biết ứng viên “nói” mình làm được gì — nhưng chưa chứng minh họ thực sự làm được gì
Các bên liên quan
- Nhà trường / sinh viên
- Doanh nghiệp
- Reviewer · người đánh giá
Vấn đề
- Có bài làm thực tế, CV và portfolio.
- Bài làm đã được đánh giá nhưng bằng chứng và kết quả thường bị phân mảnh.
- CV, PDF, GitHub và Drive khó tái sử dụng để xác minh năng lực.
- Doanh nghiệp khó kiểm chứng lại kỹ năng thật của ứng viên.
Trust Gap · Khoảng trống xác minh kỹ năng
Bài làm đã tồn tại. Thứ còn thiếu là một lớp bằng chứng có thể kiểm chứng, được con người đánh giá và tái sử dụng xuyên suốt.
Slide 3 — Giá trị sản phẩm
Một bài làm thực tế tiếp tục tạo giá trị — ngay cả sau khi thử thách kết thúc
1. Doanh nghiệp tạo challenge · thử thách.
2. Sinh viên nộp bài làm.
3. Hệ thống cố định phiên bản bằng chứng.
4. Reviewer đánh giá.
5. Credential · chứng nhận xác minh được cấp.
6. Reward · phần thưởng được phân bổ.
7. Bằng chứng được tái sử dụng cho cơ hội tiếp theo.
AI hỗ trợ — con người quyết định.
Mọi bằng chứng đều có thể kiểm chứng và tái sử dụng.

Slide 4 — Vì sao cần AI và Solana
AI giúp đọc bằng chứng — Solana giúp kiểm chứng những cam kết quan trọng
AI · Hỗ trợ đánh giá
- Đọc bằng chứng.
- Tìm nội dung liên quan đến rubric · bộ tiêu chí chấm.
- Đề xuất nhận xét và citation · dẫn nguồn.
- Không tự quyết định kết quả cuối cùng.
Solana · Xác minh và settlement
- Ký quỹ phần thưởng · escrow.
- Phân bổ phần thưởng.
- Cố định người nhận.
- Chống nhận thưởng hai lần.
- Credential và revocation · thu hồi.
- Public verification · xác minh công khai.
- Nhiều bên có thể kiểm tra độc lập.
Blockchain không lưu toàn bộ bài làm. Nó bảo vệ và công khai những trạng thái cần kiểm chứng. Blockchain phải giải quyết một phần cụ thể của sản phẩm, không chỉ để ghi dữ liệu.

Slide 5 — Phân tách dữ liệu
Dữ liệu riêng tư ở ngoài blockchain — trạng thái cần kiểm chứng nằm trên Solana
Off-chain · Riêng tư
- Bài nộp.
- Evidence · bằng chứng chi tiết.
- Thông tin cá nhân.
- Review nội bộ.
- Dữ liệu ứng dụng.
On-chain · Solana Devnet
- Hash · dấu vân tay số.
- Signed transaction · giao dịch đã ký.
- Trạng thái escrow.
- Allocation · phân bổ.
- Credential.
- Claim và revocation.
SkillBridge dùng mỗi hệ thống đúng nơi nó mạnh nhất.

Slide 6 — Demo sản phẩm
Một challenge · ba vai trò · một vòng bằng chứng hoàn chỉnh
Business · Doanh nghiệp
- Tạo challenge.
- Cấp quỹ escrow.
- Thiết lập brief, rubric và funding.
Student · Sinh viên
- Nộp evidence · bằng chứng bài làm.
- Upload file.
- Theo dõi trạng thái bài nộp.
Reviewer · Người đánh giá
- Đọc evidence.
- Kiểm tra rubric.
- Đánh giá và quyết định.
Luồng demo
Challenge đã tạo → Student nộp bài → Reviewer đánh giá → Credential cấp → Employer xác minh → Devnet proof

Tính năng hỗ trợ
- Evidence Reader.
- Skill Passport.
- AI citation.
- Funding verification.
- Transaction verification.
- Independent claim.
AI chỉ hỗ trợ, reviewer vẫn là người quyết định.

Slide 7 — Kiến trúc kỹ thuật
Một ứng dụng — nhiều lớp trách nhiệm rõ ràng
Frontend
Next.js + React + Wallet Standard
- Giao diện người dùng.
- Kết nối ví Phantom / Solflare.
- Luồng dành cho từng vai trò.
Backend
- Auth.
- RBAC · phân quyền theo vai trò.
- Review services.
- Portfolio.
- Transaction recovery.
- Quản lý challenge và bài nộp.
AI Provider
- Đọc bằng chứng.
- Hỗ trợ review.
- Đề xuất citation.
- Không tự quyết định kết quả.
Data + Storage
- Database.
- Private storage.
- Dữ liệu ứng dụng.
- Evidence riêng tư.
Solana Devnet
- Challenge escrow.
- Credential / SAS.
- Opportunity gate.
- Trạng thái cần kiểm chứng.
- Settlement.
Trust boundary
Dữ liệu riêng tư ở backend và storage. Chỉ các trạng thái cần kiểm chứng mới được ghi on-chain. Đây là ranh giới thiết kế cốt lõi.
Slide 8 — Chiều sâu kỹ thuật
Không chỉ xử lý luồng thành công — hệ thống được thiết kế cho cả trường hợp lỗi
Các tình huống được xử lý
- AI thiếu căn cứ
  → Citation gắn trực tiếp với evidence.
- Funding transaction chưa được xác minh
  → Kiểm tra lại bằng transaction signature.
- Challenge chưa đủ quỹ
  → Chỉ công bố sau khi on-chain xác nhận.
- Bài nộp cần người duyệt
  → Human review độc lập với AI.
- Credential / claim độc lập
  → Có thể kiểm tra ngoài website.
Bằng chứng sản phẩm
- 1 challenge có quỹ.
- 1 bài nộp + review thủ công.
- Credential.
- Independent claim.
- 168 tests.
Slide 9 — Independent Claim
Independent Claim · Tự nhận thưởng độc lập
Các vai trò
- Reviewer · duyệt
- Escrow · ký quỹ
- RPC · công khai
- Verifier · độc lập
- Wallet · ví nhận
Luồng
- Reviewer tạo allocation · phân bổ phần thưởng.
- Escrow ghi nhận trạng thái allocation.
- RPC công khai để mọi người đọc trạng thái.
- Verifier kiểm tra trạng thái độc lập.
- Người dùng claim trực tiếp khi đủ điều kiện.
Phần được bảo vệ on-chain
- Allocation.
- Claim.
- Credential.
- Revocation.
Không tuyên bố “fully decentralized” — backend vẫn tham gia các bước ứng dụng trước đó.

Slide 10 — Hạ tầng tổ chức
Hạ tầng tổ chức và xác minh thử thách kỹ năng
Doanh nghiệp
- Tạo và tài trợ challenge · thử thách.
- Xác minh ứng viên.
- Quản lý reviewer · người duyệt.
Trường / CLB
- Tổ chức challenge · thử thách.
- Nhận credential · chứng nhận.
- Đánh giá kết quả.
Sinh viên
- Tiếp cận challenge.
- Xây evidence portfolio · hồ sơ bằng chứng.
- Nhận credential và cơ hội.
Mô hình giả thuyết
Pilot → gói cho tổ chức → dịch vụ theo challenge/usage

Ưu tiên sinh viên tiếp cận chi phí thấp hoặc miễn phí.
Mô hình kinh doanh hiện là giả thuyết cần kiểm chứng — không tuyên bố doanh thu hoặc khách hàng khi chưa có bằng chứng.

Slide 11 — Trạng thái kỹ thuật và roadmap
Phần kỹ thuật đã được kiểm chứng — bước tiếp theo là kiểm chứng với người dùng thật
Đã build và kiểm thử
- Kết nối ví · wallet.
- Challenge · thử thách.
- Evidence · bằng chứng.
- Human review · người duyệt.
- AI hỗ trợ.
- Escrow · ký quỹ.
- Credential · chứng nhận.
- Claim · nhận thưởng.
- Portfolio · hồ sơ.
- VI/EN · song ngữ.
- 168 tests · kiểm thử.
- Devnet evidence · bằng chứng Devnet.
Chưa claim · Trung thực
- Mainnet · mạng chính.
- Security audit · kiểm toán bảo mật.
- VND payout · chi trả VND; hiện chỉ là sandbox.
- Khách hàng trả tiền.
- Traction · lực kéo thị trường.
- Market validation · kiểm chứng thị trường.
Roadmap
Giai đoạn	Mục tiêu
Hiện tại	Hackathon technical proof
Tiếp theo	Pilot với trường, CLB và doanh nghiệp
Beta	Nhiều challenge và reviewer
Production	Sau security review và partner thực tế


Slide 12 — Kết thúc
Cảm ơn · Thank You
Bài làm thành bằng chứng.
Evidence mở ra cơ hội.

Demo · GitHub · Verifier
Human review · Solana Devnet
SkillBridge giúp sinh viên biến bài làm thực tế thành bằng chứng kỹ năng được đánh giá, có thể kiểm chứng và mang theo sang cơ hội tiếp theo.
SkillBridge Vietnam · UniHackFest 2026
Solana Devnet

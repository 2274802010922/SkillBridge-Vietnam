import type { Metadata } from "next";
import { LegalPage } from "../components/legal-page";

export const metadata: Metadata = { title: "Điều khoản sử dụng" };

export default function TermsPage() {
  return <LegalPage title="Điều khoản sử dụng pilot" kicker="REAL PRODUCT · DEVNET">
    <section><h2>1. Phạm vi pilot</h2><p>SkillBridge là sản phẩm proof-of-skill đang ở giai đoạn pilot tại Việt Nam. Các transaction hiện chạy trên Solana Devnet, token Devnet không có giá trị tiền tệ và môi trường có thể được reset.</p></section>
    <section><h2>2. Danh tính ví</h2><p>Bạn chịu trách nhiệm bảo vệ ví và thiết bị của mình. Chữ ký đăng nhập không gửi transaction hoặc chuyển tài sản. SkillBridge không bao giờ yêu cầu seed phrase; mọi yêu cầu như vậy phải được xem là giả mạo.</p></section>
    <section><h2>3. Nội dung và tính trung thực</h2><p>Bạn chỉ được nộp nội dung mình có quyền sử dụng và phải mô tả evidence trung thực. Không tải mã độc, dữ liệu trái phép, thông tin nhạy cảm không cần thiết hoặc nội dung nhằm thao túng AI/reviewer. Bạn giữ quyền với sản phẩm của mình và cấp quyền giới hạn để hệ thống xử lý cho challenge.</p></section>
    <section><h2>4. AI và human review</h2><p>AI tạo bản nháp có dẫn chứng, không phải quyết định cuối. Reviewer được ủy quyền phê duyệt, từ chối hoặc yêu cầu sửa. Credential không bảo đảm việc làm, học bổng hay tuyển chọn; mỗi doanh nghiệp vẫn chịu trách nhiệm cho quyết định của mình.</p></section>
    <section><h2>5. Credential và thu hồi</h2><p>Credential gắn với ví, không được chuyển nhượng và có thể hết hạn hoặc bị issuer hợp lệ thu hồi khi có sai sót, gian lận hay vi phạm chính sách. Access gate luôn có quyền đọc lại trạng thái hiện hành thay vì tin một ảnh chụp cũ.</p></section>
    <section><h2>6. Tổ chức</h2><p>Người tạo hoặc quản lý tổ chức xác nhận mình có thẩm quyền phù hợp. Việc một tổ chức xuất hiện trên hệ thống không đồng nghĩa đã được Văn Lang, UniHackFest hay SkillBridge chứng thực trừ khi có nhãn xác minh rõ ràng.</p></section>
  </LegalPage>;
}


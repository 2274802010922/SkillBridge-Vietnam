import type { Metadata } from "next";
import { LegalPage } from "../components/legal-page";

export const metadata: Metadata = { title: "Chính sách dữ liệu" };

export default function PrivacyPage() {
  return <LegalPage title="Chính sách dữ liệu và quyền riêng tư" kicker="DATA MINIMIZATION">
    <section><h2>1. Dữ liệu được xử lý</h2><p>SkillBridge xử lý địa chỉ ví công khai, hồ sơ và tư cách thành viên tổ chức, challenge, bài nộp, file evidence, hash file, kết quả đánh giá, quyết định reviewer, credential và nhật ký bảo mật. Địa chỉ IP có thể được băm để giới hạn lạm dụng. Chúng tôi không yêu cầu hoặc lưu seed phrase/private key.</p></section>
    <section><h2>2. Mục đích</h2><p>Dữ liệu được dùng để xác thực ví, vận hành challenge, đánh giá evidence, phát hành credential, kiểm tra điều kiện cơ hội, xử lý sự cố và đo hiệu quả pilot. AI chỉ được cung cấp nội dung cần thiết cho lượt đánh giá; kết quả AI luôn cần reviewer chịu trách nhiệm phê duyệt.</p></section>
    <section><h2>3. On-chain và off-chain</h2><p>Evidence và thông tin nhận dạng chi tiết nằm off-chain. Solana Devnet chỉ nhận claim tối thiểu như ví chủ thể, schema, điểm, hash evidence, hạn dùng và trạng thái. Dữ liệu blockchain công khai, có thể được sao chép và không thể xóa theo cách giống cơ sở dữ liệu thông thường; revocation làm mất hiệu lực nhưng không xóa lịch sử giao dịch.</p></section>
    <section><h2>4. Chia sẻ và quyền truy cập</h2><p>Doanh nghiệp chỉ thấy dữ liệu thuộc challenge hoặc credential được trình cho cơ hội. Reviewer của trường chỉ thấy bài được giao cho đơn vị mình. Nhà cung cấp hạ tầng lưu trữ, AI và blockchain xử lý dữ liệu trong phạm vi cần thiết để cung cấp dịch vụ.</p></section>
    <section><h2>5. Lưu giữ</h2><p>Trong pilot, evidence thô dự kiến được giữ tối đa 180 ngày sau khi challenge đóng; audit và sự kiện bảo mật tối đa 12 tháng, trừ khi cần giữ lâu hơn để xử lý tranh chấp. Credential on-chain tuân theo vòng đời của Devnet. Chính sách chính thức trước production sẽ thay thế các mốc pilot này.</p></section>
    <section><h2>6. Quyền của bạn</h2><p>Bạn có thể yêu cầu xem, sửa hoặc xóa dữ liệu off-chain không còn cần thiết; rút khỏi pilot; hoặc yêu cầu giải thích quyết định đánh giá. Yêu cầu pilot gửi tới <a href="mailto:pilot@skillbridge.vn">pilot@skillbridge.vn</a>. Việc xóa có thể không áp dụng cho transaction công khai hoặc log bắt buộc để bảo vệ hệ thống.</p></section>
  </LegalPage>;
}


import type { Metadata } from "next";
import { LegalPage } from "../components/legal-page";

export const metadata: Metadata = { title: "Công bố rủi ro" };

export default function RiskPage() {
  return <LegalPage title="Công bố rủi ro và giới hạn" kicker="RISK DISCLOSURE">
    <section><h2>Blockchain</h2><p>Devnet có thể gián đoạn, reset hoặc thay đổi trạng thái; Explorer và RPC có thể chậm. Transaction đã xác nhận là công khai. Không đưa PII, bí mật kinh doanh hoặc tài liệu gốc lên chain.</p></section>
    <section><h2>AI</h2><p>Mô hình có thể trích xuất sai, bỏ sót evidence hoặc thiên lệch. Hệ thống giới hạn bằng structured output, citation validation, prompt-injection checks và human approval, nhưng không loại bỏ hoàn toàn rủi ro.</p></section>
    <section><h2>Credential</h2><p>Credential chứng minh một issuer đã phê duyệt kết quả theo schema tại một thời điểm; nó không phải bằng cấp pháp lý, chứng khoán, token đầu tư hoặc cam kết tuyển dụng.</p></section>
    <section><h2>Vận hành pilot</h2><p>Dịch vụ có thể được tạm dừng để sửa lỗi và chưa có SLA production. Không dùng pilot cho quyết định có tác động nghiêm trọng nếu thiếu quy trình kiểm tra và khiếu nại độc lập.</p></section>
  </LegalPage>;
}


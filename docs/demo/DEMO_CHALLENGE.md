# Thử thách Demo — Thiết kế trải nghiệm thanh toán USDC cho freelancer Việt Nam

## Thông tin doanh nghiệp

- **Đơn vị tạo thử thách:** NexaPay Demo
- **Đơn vị đánh giá:** SkillBridge Review Board
- **Mạng:** Solana Devnet
- **Tài sản thưởng:** 0.05 SOL Devnet
- **Số người nhận:** 1
- **Hình thức:** Công khai
- **Thời hạn nộp:** 3 phút sau khi công bố trong buổi demo
- **Thời hạn đánh giá:** 10 phút sau khi công bố

## Bối cảnh

NexaPay đang nghiên cứu trải nghiệm giúp freelancer Việt Nam nhận thanh toán quốc tế bằng USDC trên Solana. Người dùng cần biết ai đã gửi tiền, số tiền thực nhận, phí, trạng thái giao dịch và nơi kiểm chứng transaction mà không cần hiểu sâu về blockchain.

## Đề bài

Hãy thiết kế chiến lược và user flow cho trải nghiệm nhận thanh toán USDC của một freelancer Việt Nam làm việc với khách hàng quốc tế.

Giải pháp cần thể hiện cách người dùng:

1. Tạo hoặc nhận yêu cầu thanh toán.
2. Theo dõi trạng thái giao dịch.
3. Kiểm tra số tiền thực nhận và phí.
4. Xác minh giao dịch trên Solana Explorer.
5. Xử lý trường hợp giao dịch đang chờ, thất bại hoặc sai mạng.

## Deliverables

- 01 file Markdown hoặc PDF từ 3–5 trang.
- Problem statement và user persona.
- Ít nhất 3 insight hoặc giả định nghiên cứu, ghi rõ nguồn/trạng thái.
- User flow từ lúc khách hàng thanh toán đến khi freelancer nhận USDC.
- Đề xuất các màn hình hoặc chức năng chính.
- Ít nhất 3 KPI.
- Ít nhất 3 rủi ro và phương án giảm thiểu.
- Kế hoạch validation prototype.

## Tiêu chí chấm điểm

| Tiêu chí | Điểm tối đa |
| --- | ---: |
| Problem framing | 25 |
| Evidence quality | 25 |
| Strategy quality | 30 |
| Feasibility | 20 |
| **Tổng** | **100** |

Bài đạt từ **80/100** được công nhận hoàn thành và đủ điều kiện nhận credential cùng phần thưởng theo điều khoản challenge.

## Ràng buộc

- Luồng phải sử dụng USDC và Solana.
- Người dùng phổ thông không bị bắt buộc hiểu wallet address, RPC hoặc private key.
- Transaction signature và Explorer phải là phương thức kiểm chứng độc lập.
- Không đưa dữ liệu cá nhân hoặc nội dung riêng tư lên blockchain.
- Dữ liệu giả định phải được ghi rõ là giả định.
- Không trình bày cashout USDC sang VND như giao dịch ngân hàng thật; nếu có, phải ghi rõ sandbox.
- Phân biệt rõ `processing`, `finalized` và `completed`.

## Điều khoản phần thưởng

- Doanh nghiệp ký quỹ trước khi công bố.
- Reviewer là người quyết định kết quả cuối cùng.
- AI chỉ hỗ trợ nhận xét, không tự phê duyệt và không tự chuyển tiền.
- Phần thưởng được phân bổ qua escrow program trên Solana Devnet.
- Người nhận tự ký transaction claim về ví của mình.
- Transaction funding, allocation và claim có thể kiểm chứng công khai.

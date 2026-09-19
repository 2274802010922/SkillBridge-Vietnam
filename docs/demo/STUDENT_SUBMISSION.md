# NexaPay Flow — Trải nghiệm nhận thanh toán USDC cho freelancer Việt Nam

**Người thực hiện:** Nguyễn Minh Anh  
**Challenge:** Thiết kế trải nghiệm thanh toán USDC cho freelancer Việt Nam  
**Định dạng:** Bài nộp Markdown mẫu cho Demo Day  
**Trạng thái dữ liệu:** Các insight định lượng bên dưới là giả định dùng cho prototype, chưa phải nghiên cứu người dùng thực tế.

## 1. Problem statement

Freelancer Việt Nam làm việc với khách hàng quốc tế thường gặp ba vấn đề: không biết khoản thanh toán đang ở trạng thái nào, khó đối soát số tiền thực nhận sau phí và khó giải thích transaction cho người không chuyên blockchain.

Mục tiêu của NexaPay Flow là giúp freelancer trả lời được ba câu hỏi trong vài giây:

1. Tiền đang ở bước nào?
2. Tôi thực nhận bao nhiêu?
3. Tôi có thể tự kiểm chứng ở đâu?

## 2. Persona

**Lan, 27 tuổi, freelancer thiết kế**

- Nhận thanh toán từ khách hàng Singapore và Australia.
- Biết dùng ví nhưng không hiểu RPC, block hoặc token account.
- Muốn nhận USDC, theo dõi trạng thái và có bằng chứng gửi cho khách hàng.
- Lo lắng nhất là gửi nhầm mạng hoặc không biết tiền đã đến chưa.

## 3. Insight và giả định

> Đây là các giả định cần được kiểm chứng bằng phỏng vấn/prototype test.

1. Người dùng quan tâm trạng thái dễ hiểu hơn là số block.
2. Một nút **Sao chép bằng chứng** hữu ích hơn việc bắt người dùng tự tìm transaction trên Explorer.
3. Người dùng cần thấy số tiền trước phí, phí và số tiền thực nhận trên cùng một màn hình.
4. Cảnh báo sai mạng cần xuất hiện trước khi ký, không phải sau khi giao dịch thất bại.

## 4. User flow

```text
Khách hàng tạo yêu cầu thanh toán
→ Freelancer gửi địa chỉ nhận hoặc QR
→ Khách hàng chuyển USDC trên Solana
→ Hệ thống theo dõi processing
→ RPC xác nhận finalized
→ Freelancer thấy số tiền thực nhận
→ Freelancer mở transaction proof trên Explorer
```

### Trạng thái hiển thị

- **Đang chờ thanh toán:** chưa thấy transaction hợp lệ.
- **Đang xử lý:** đã thấy transaction nhưng chưa finalized.
- **Đã xác nhận:** transaction finalized, đúng mint và đúng recipient.
- **Hoàn tất:** số dư đã được đối soát và có bằng chứng chia sẻ.
- **Cần kiểm tra:** sai mạng, sai token mint, sai người nhận hoặc sai số tiền.

## 5. Các màn hình chính

### A. Payment request

- Số tiền USDC.
- Mô tả công việc.
- Địa chỉ nhận rút gọn và nút copy.
- QR Solana Pay.
- Network badge: `Solana Devnet` trong prototype.

### B. Payment status

- Timeline 4 bước: Created → Processing → Finalized → Completed.
- Số tiền dự kiến.
- Phí mạng ước tính.
- Số tiền thực nhận.
- Cảnh báo nếu transaction dùng sai network.

### C. Proof drawer

- Transaction signature.
- Người gửi và người nhận.
- Token mint.
- Amount atomic và amount hiển thị.
- Confirmation status.
- Nút **Mở Solana Explorer**.

## 6. KPI

1. 90% người dùng mới xác định đúng trạng thái payment trong 10 giây.
2. 95% payment hợp lệ được đối soát đúng recipient và amount.
3. Giảm 50% số câu hỏi hỗ trợ kiểu “tiền đã đến chưa?”.
4. Tỷ lệ hoàn tất payment flow trên prototype đạt ít nhất 80%.

## 7. Rủi ro và giảm thiểu

| Rủi ro | Giảm thiểu |
| --- | --- |
| Người dùng gửi sai network | Hiển thị network lớn, khóa luồng và cảnh báo trước khi ký. |
| Sai token mint | Kiểm tra mint on-chain, không chỉ dựa vào symbol USDC. |
| Transaction chưa finalized | Dùng trạng thái processing, cho phép refresh bằng signature, không yêu cầu gửi lại. |
| Sai recipient | So sánh recipient on-chain với invoice trước khi đánh dấu completed. |
| Người dùng chia sẻ dữ liệu riêng tư | Chỉ ghi hash/evidence cần thiết, không đưa nội dung riêng tư lên blockchain. |

## 8. Validation plan

1. Cho 5 freelancer hoàn thành payment flow với prototype.
2. Đo thời gian họ tìm được trạng thái và số tiền thực nhận.
3. Cố tình đưa transaction sai network để kiểm tra cảnh báo.
4. Cho người dùng copy proof và giải thích lại cho người khác.
5. Phỏng vấn sau test về mức độ tin cậy và điểm gây khó hiểu.

## 9. Kết luận

NexaPay Flow dùng Solana để tạo lớp đối soát công khai và không thể sửa ngầm, nhưng giữ giao diện đơn giản cho freelancer. Giá trị của blockchain nằm ở ownership, payment settlement và independent verification; AI chỉ có thể hỗ trợ giải thích trạng thái, không thay thế bằng chứng on-chain.

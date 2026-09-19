# Kịch bản thuyết trình + demo trực tiếp — SkillBridge Vietnam

Thời lượng đề xuất: **6–8 phút**. Luồng chính:

```text
Doanh nghiệp tạo challenge
→ Ký quỹ Devnet
→ Công bố
→ Sinh viên nộp bài
→ Reviewer phê duyệt
→ Escrow phân bổ thưởng
→ Sinh viên claim
→ Kiểm chứng độc lập
```

## 0. Chuẩn bị trước khi quay

- [ ] Chuẩn bị ba ví tách biệt: doanh nghiệp, sinh viên và reviewer.
- [ ] Chọn Solana **Devnet** trong tất cả ví.
- [ ] Nạp đủ SOL Devnet cho phí giao dịch.
- [ ] Tạo challenge mới, không dùng escrow cũ hoặc deadline đã hết.
- [ ] Cấu hình reward `0.05 SOL Devnet`, một người nhận, challenge public.
- [ ] Đặt deadline nộp khoảng 3 phút và deadline review khoảng 10 phút.
- [ ] Không hiển thị private key, seed phrase hoặc secret vault.

## 1. Mở đầu — Problem và Solution (45 giây)

### Lời nói

> Freelancer và sinh viên có thể làm tốt nhưng khó chứng minh năng lực bằng bằng chứng đáng tin cậy. Doanh nghiệp cũng khó tổ chức thử thách, đánh giá và trả thưởng minh bạch.
>
> SkillBridge biến toàn bộ quy trình thành một luồng có thể kiểm chứng: doanh nghiệp tạo challenge, ký quỹ trên Solana, sinh viên nộp bằng chứng, reviewer chấm người thật, sau đó phần thưởng được phân bổ on-chain.

### Thao tác

1. Mở landing page.
2. Chỉ vào các phần Challenge, Human Review, Escrow, Credential và Independent Verification.

### Thông điệp cần nhấn mạnh

> Blockchain không chỉ hiển thị transaction. Nó giữ quỹ, khóa điều kiện và quyết định quyền claim phần thưởng.

## 2. Doanh nghiệp tạo challenge (60 giây)

### Lời nói

> Tôi bắt đầu với vai trò doanh nghiệp. Doanh nghiệp có thể tạo challenge public hoặc invite-only, chọn phần thưởng và đơn vị đánh giá.

### Thao tác

1. Kết nối ví doanh nghiệp, chọn role **Doanh nghiệp**.
2. Vào **Thử thách → Tạo thử thách**.
3. Nhập tiêu đề, mô tả, rubric và phần thưởng.
4. Chọn deadline ngắn rồi lưu bản nháp.

### Lời nói khi nhập nội dung

> Challenge không chỉ là một bài đăng. Nó gồm tiêu chí đánh giá, người chịu trách nhiệm, thời hạn và điều khoản phần thưởng.

## 3. Ký quỹ trên Solana Devnet (60–75 giây)

### Lời nói

> Trước khi công bố, doanh nghiệp phải ký quỹ. Điều này chứng minh phần thưởng tồn tại thật trên blockchain, thay vì chỉ là một con số trong database.

### Thao tác

1. Mở **Quỹ thưởng**.
2. Kiểm tra escrow address, asset, amount, reviewer và deadlines.
3. Bấm **Nạp tiền thưởng**, ký bằng ví doanh nghiệp.
4. Chờ transaction `finalized`.
5. Mở transaction trên Solana Explorer với `cluster=devnet`.
6. Quay lại SkillBridge, bấm **Kiểm tra lại quỹ**.
7. Kiểm tra trạng thái **Đã nạp quỹ**.
8. Đọc/ký điều khoản rồi bấm **Công bố challenge**.

### Lời nói trên Explorer

> Người xem có thể kiểm tra người gửi, escrow address, số tiền và trạng thái finalized.

### Điểm nhấn

> Nếu reload trang, transaction signature vẫn có thể được dán lại để khôi phục trạng thái. Người dùng không cần nạp tiền lần hai.

## 4. Sinh viên tham gia và nộp bài (60 giây)

### Thao tác

1. Đăng xuất ví doanh nghiệp.
2. Kết nối ví sinh viên, chọn role **Sinh viên**.
3. Mở challenge public và bấm **Tham gia**.
4. Tải file bài làm, nhập ghi chú.
5. Bấm **Nộp bài** và ký nếu được yêu cầu.
6. Xác nhận trạng thái `Đã nộp · Chờ kết quả`.

### Lời nói

> Sinh viên chỉ cần tải file và ghi chú. Họ không cần hiểu seed phrase, private key hay smart contract.

## 5. Reviewer đánh giá (75 giây)

### Lời nói

> AI chỉ hỗ trợ đọc và gợi ý. Người quyết định kết quả cuối cùng vẫn là reviewer.

### Thao tác

1. Đăng xuất ví sinh viên, kết nối ví reviewer.
2. Vào **Đánh giá**, chọn bài nộp.
3. Mở file/evidence trực tiếp.
4. Chấm bốn tiêu chí: Problem framing, Evidence quality, Strategy quality và Feasibility.
5. Viết nhận xét và bấm lưu/phê duyệt.
6. Nếu đủ điều kiện, cấp credential Devnet.

### Nếu muốn trình diễn AI

> Tôi có thể bật AI hỗ trợ để tạo nhận xét sơ bộ, nhưng AI không tự phê duyệt và không tự chuyển tiền.

Nếu AI không hoạt động trong môi trường demo, bỏ qua phần này và tiếp tục chấm thủ công.

## 6. Reviewer ghi kết quả và phân bổ escrow (60 giây)

> Chỉ thực hiện sau khi submit deadline đã kết thúc.

### Thao tác

1. Vào **Quỹ thưởng**, chọn challenge và bấm **Kiểm tra lại quỹ**.
2. Trong **Bài nộp và phần thưởng**, chọn bài đã approved.
3. Bấm **Xác nhận kết quả chấm**, ký transaction và chờ `finalized`.
4. Bấm **Xác nhận người nhận thưởng/Phân bổ phần thưởng**.
5. Ký transaction allocation.
6. Kiểm tra trạng thái **Đã phân bổ phần thưởng**.

### Lời nói

> Từ thời điểm này, smart contract ghi nhận ví sinh viên là người có quyền claim phần thưởng.

> Challenge dùng escrow program phải đi qua luồng này; không dùng payout legacy để chuyển trực tiếp.

## 7. Sinh viên nhận thưởng (45 giây)

### Thao tác

1. Đăng nhập lại bằng ví sinh viên.
2. Mở challenge đã đạt.
3. Kiểm tra recipient, amount và escrow address.
4. Bấm **Nhận thưởng**, ký giao dịch claim và chờ `finalized`.
5. Kiểm tra số dư SOL Devnet.
6. Mở transaction claim trên Explorer.

### Lời nói

> Người nhận tự ký giao dịch claim cuối cùng. Tiền đi từ escrow đến đúng ví sinh viên và bất kỳ ai cũng có thể kiểm chứng.

## 8. Kiểm chứng độc lập (45 giây)

### Thao tác

1. Mở **Công cụ nhận thưởng độc lập** hoặc trang credential.
2. Nhập challenge/credential ID hoặc địa chỉ ví sinh viên.
3. Kiểm tra credential, badge, reward allocation và claim transaction trên Devnet.
4. Mở Explorer lần cuối.

### Lời nói

> Bằng chứng không bị khóa trong SkillBridge. Người khác có thể kiểm tra độc lập bằng địa chỉ ví và transaction công khai.

## 9. Kết luận Business và Technical Value (40 giây)

### Lời nói

> Với doanh nghiệp, SkillBridge giảm chi phí tổ chức challenge, đánh giá và trả thưởng. Với sinh viên, mỗi bài làm tốt có thể trở thành credential và bằng chứng năng lực có thể chia sẻ.
>
> Blockchain được dùng ở nơi không thể thay thế: giữ quỹ, khóa điều kiện, ghi nhận quyền nhận thưởng và cung cấp bằng chứng công khai.
>
> AI chỉ là lớp hỗ trợ. Quyết định cuối cùng thuộc về con người. SkillBridge kết nối evidence, human review và on-chain payout trong một luồng hoàn chỉnh.

## 10. Reviewer dự phòng (chỉ trình diễn nếu còn thời gian)

- Sau `reviewDeadline`, reviewer dự phòng có thể xử lý nếu reviewer chính không hành động.
- Không có reviewer tự động và không tự động hoàn tiền khi cả hai reviewer không xử lý; quỹ giữ trạng thái chờ.

## 11. Xử lý lỗi khi đang demo

| Hiện tượng | Cách nói và xử lý |
| --- | --- |
| `Quỹ chưa sẵn sàng` | Kiểm tra đúng signature và escrow address; không nạp lại ngay. |
| `Chưa tải được dữ liệu` | Tải lại sau deploy, kiểm tra session và API `/api/payouts`. |
| Không thấy nút ghi kết quả | Submit deadline chưa hết hoặc assessment chưa approved. |
| Không thấy nút claim | Reviewer chưa allocate award on-chain. |
| Transaction chưa finalized | Chờ rồi kiểm tra lại cùng signature, không gửi giao dịch mới. |
| Sai escrow address | Dừng và dùng đúng challenge/transaction, không dùng escrow cũ. |

### Câu nói dự phòng

> Tôi sẽ không gửi lại giao dịch. SkillBridge hỗ trợ khôi phục bằng transaction signature vì blockchain là nguồn sự thật; giao diện chỉ đang đồng bộ lại trạng thái.

## 12. Phiên bản rút gọn 3–5 phút

```text
Landing page
→ Doanh nghiệp tạo challenge
→ Ký quỹ và verify funding
→ Ký điều khoản, công bố
→ Sinh viên tham gia và nộp file
→ Reviewer chấm thủ công, phê duyệt
→ Record result on-chain
→ Allocate award
→ Sinh viên claim reward
→ Mở Explorer và verifier độc lập
```

## Thông điệp kết thúc

> SkillBridge biến một bài nộp thành bằng chứng có người chịu trách nhiệm, phần thưởng được khóa on-chain, và quyền nhận thưởng có thể kiểm chứng độc lập trên Solana Devnet.

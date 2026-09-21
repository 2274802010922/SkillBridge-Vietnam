# Kịch bản Demo Day — SkillBridge Vietnam

> Luồng chuẩn: Doanh nghiệp ký quỹ → Sinh viên nộp bài → Reviewer phê duyệt → Escrow phân bổ → Sinh viên claim → kiểm chứng độc lập.

## 0. Chuẩn bị

- [ ] Deploy Vercel đúng commit mới nhất và chọn Solana **Devnet**.
- [ ] Chuẩn bị bốn ví: doanh nghiệp, sinh viên, reviewer chính, reviewer dự phòng.
- [ ] Nạp SOL Devnet cho phí giao dịch.
- [ ] Dùng challenge mới, không dùng challenge có escrow/deadline cũ.
- [ ] Cấu hình: `0.05 SOL`, `1` người nhận, public, hạn nộp đủ cho cả hai reviewer nhận nhiệm vụ và sinh viên ký nộp, hạn review ít nhất 30 phút sau hạn nộp.
- [ ] Không đưa private key, seed phrase hay secret vault vào video.

## 1. Doanh nghiệp — tạo và ký quỹ

1. Kết nối ví doanh nghiệp, chọn role **Doanh nghiệp**.
2. Vào **Thử thách → Tạo thử thách**.
3. Nhập tiêu đề, mô tả, rubric, phần thưởng và deadline ngắn; lưu bản nháp.
4. Mở **Quỹ thưởng**, chọn reviewer chính và kiểm tra escrow address, asset, amount, reviewer, deadlines.
5. Bấm **Nạp tiền thưởng**, ký bằng ví doanh nghiệp.
6. Chờ transaction `finalized` trên Solana Devnet.
7. Bấm **Kiểm tra lại quỹ** hoặc dán transaction signature.
8. Xác nhận trạng thái **Đã nạp quỹ**.
9. Reviewer chính kết nối ví và bấm **Nhận nhiệm vụ đánh giá**; reviewer dự phòng thực hiện tương tự.
10. Doanh nghiệp đọc điều khoản, xác nhận và ký **Công bố challenge** sau khi có đủ 2/2 consent.

**Cảnh cần quay:** escrow address, số tiền khóa, transaction funding trên Explorer (`cluster=devnet`), trạng thái funded và điều khoản hoàn quỹ.

## 2. Sinh viên — tham gia và nộp bài

1. Đăng xuất doanh nghiệp, kết nối ví sinh viên, chọn role **Sinh viên**.
2. Vào **Thử thách**, mở challenge public và bấm **Tham gia**.
3. Tải file bài làm, nhập ghi chú, bấm **Nộp bài** và ký nếu được yêu cầu.
4. Xác nhận trạng thái `Đã nộp · Chờ kết quả`.

**Cảnh cần quay:** challenge public, file có thể xem/tải, không yêu cầu seed phrase.

## 3. Reviewer — chấm và phê duyệt

1. Đăng nhập bằng ví reviewer, vào **Đánh giá** và chọn bài nộp.
2. Mở file/evidence trực tiếp.
3. Chấm thủ công: Problem framing, Evidence quality, Strategy quality, Feasibility.
4. Viết nhận xét và bấm lưu/phê duyệt.
5. Có thể dùng **AI hỗ trợ**, nhưng AI không bắt buộc và không tự quyết định.
6. Nếu đủ điều kiện, cấp credential Devnet.

## 4. Reviewer — ghi kết quả và phân bổ escrow

Sau khi submit deadline kết thúc:

1. Vào **Quỹ thưởng**, chọn challenge và bấm **Kiểm tra lại quỹ**.
2. Trong **Bài nộp và phần thưởng**, chọn bài đã approved.
3. Bấm **Xác nhận kết quả chấm**, ký và chờ `finalized`.
4. Bấm **Xác nhận người nhận thưởng/Phân bổ phần thưởng**, ký transaction allocation.
5. Kiểm tra trạng thái **Đã phân bổ phần thưởng**.

> Challenge dùng escrow program phải đi qua luồng này; không dùng payout legacy để chuyển trực tiếp.

## 5. Sinh viên — claim phần thưởng

1. Đăng nhập lại bằng ví sinh viên.
2. Mở challenge đã đạt, kiểm tra recipient, amount và escrow address.
3. Bấm **Nhận thưởng**, ký giao dịch claim và chờ `finalized`.
4. Kiểm tra số dư SOL Devnet và mở transaction claim trên Explorer.

**Cảnh cần quay:** sinh viên ký claim cuối cùng, tiền đi từ escrow tới đúng ví sinh viên.

## 6. Kiểm chứng độc lập

1. Mở **Công cụ nhận thưởng độc lập** hoặc trang credential.
2. Nhập challenge/credential ID hoặc địa chỉ ví sinh viên.
3. Kiểm tra credential, badge, reward allocation và transaction claim trên Devnet.
4. Mở Explorer để chứng minh kết quả không chỉ là dữ liệu giao diện.

## 7. Reviewer dự phòng

- Chỉ dùng sau `reviewDeadline` nếu reviewer chính không xử lý.
- Không tự động đổi reviewer và không tự động hoàn tiền khi cả hai reviewer không hành động; quỹ giữ trạng thái chờ.

## 8. Lỗi thường gặp

| Hiện tượng | Xử lý |
| --- | --- |
| `Quỹ chưa sẵn sàng` | Kiểm tra đúng signature và escrow address; không nạp lại ngay. |
| `Chưa tải được dữ liệu` | Tải lại sau deploy, kiểm tra session và `/api/payouts`. |
| Không thấy nút ghi kết quả | Deadline nộp chưa hết hoặc assessment chưa approved. |
| Không thấy nút claim | Reviewer chưa allocate award on-chain. |
| Chưa finalized | Chờ rồi kiểm tra lại cùng signature, không gửi giao dịch mới. |
| Sai escrow address | Dừng và dùng đúng challenge/transaction, không dùng escrow cũ. |

## 9. Kịch bản rút gọn 3–5 phút

```text
Doanh nghiệp tạo challenge mới
→ nạp SOL Devnet và verify funding
→ ký điều khoản và công bố
→ Sinh viên tham gia, nộp file
→ Reviewer chấm thủ công và phê duyệt
→ hết deadline nộp, reviewer record result
→ reviewer allocate award vào escrow
→ Sinh viên claim reward
→ mở Explorer và verifier độc lập
```

> SkillBridge biến bài nộp thành bằng chứng có người chịu trách nhiệm, phần thưởng được khóa on-chain, và quyền nhận thưởng có thể kiểm chứng độc lập trên Solana Devnet.

## Lưu ý sau bản sửa reliability

- Nếu dùng ba ví, doanh nghiệp kiêm reviewer chính; vẫn cần reviewer dự phòng riêng và ví sinh viên.
- Sau hạn đánh giá, **chỉ reviewer dự phòng** được ghi kết quả/phân bổ; giao diện chỉ rõ ví cần tiếp tục.
- Phê duyệt bản chấm không tự phân bổ thưởng. Điểm chính thức phải đạt ngưỡng đã cam kết.
- Cấp chứng nhận là luồng độc lập, không phải điều kiện để claim phần thưởng đã phân bổ.
- Giao diện claim dùng ví sinh viên. Program cho phép caller khác trả phí claim, nhưng tiền luôn tới recipient cố định.
- Deadline tính từ lúc thiết lập quỹ, không tự cộng lại từ lúc công bố; các quỹ cũ giữ deadline đã ký.
- Chờ transaction finalized và kiểm tra trạng thái nghiệp vụ. HTTP 200 không tự chứng minh đã trả thưởng.

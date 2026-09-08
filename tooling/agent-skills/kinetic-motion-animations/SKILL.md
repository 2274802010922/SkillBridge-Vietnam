---
name: kinetic-motion-animations
description: Hướng dẫn hiệu ứng chuyển động cao cấp K95 (Kinetic 2-tier Split Text, Custom Difference Cursor, Lenis Smooth Scroll, Boot Loader).
---

# Kinetic Motion & Micro-animations Specification

## 1. Kinetic Split Typography
Mỗi ký tự được tách thành 2 tầng (`char-top` và `char-bot`):
```html
<span class="nav__link-char" style="--i: 0;">
  <span class="char-top">W</span>
  <span class="char-bot" aria-hidden="true">W</span>
</span>
```
Khi hover: `char-top` trượt lên `-100%`, `char-bot` từ `100%` trượt về `0%` với `transition-delay: calc(var(--i) * 35ms)`.

## 2. Custom Difference Blend Cursor
- Vòng tròn con trỏ cố định (`position: fixed; pointer-events: none; mix-blend-mode: difference; z-index: 99999`).
- Mặc định: kích thước `15px x 15px`, nền trắng (sẽ đảo màu ngược lại so với nền bên dưới).
- Khi hover vào phần tử có thuộc tính `data-hover` hoặc `[data-cursor]`: mở rộng thành `45px x 45px`, viền trắng mỏng `1px solid white`, nền trong suốt.

## 3. Smooth Scrolling (Lenis)
- Khởi tạo Lenis với `lerp: 0.1` hoặc `duration: 1.2` để tạo cảm giác lướt quán tính êm ái đặc trưng của các website Studio Awwwards.

## 4. Boot Loader Counter
Bộ đếm `[0%]` → `[100%]` chạy dạng tabular numbers, kết thúc bằng hiệu ứng mở màn (expanding scale & blur fade out) tiết lộ sân khấu chính.

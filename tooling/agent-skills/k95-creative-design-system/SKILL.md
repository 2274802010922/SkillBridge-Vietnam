---
name: k95-creative-design-system
description: Hướng dẫn và quy chuẩn thiết kế giao diện cao cấp phong cách Studio K95 (Brutalist, Swiss Typography, Electric Cobalt Blue, Glassmorphism, Tabular Numbers). Kích hoạt khi thiết kế giao diện SkillBridge theo chuẩn K95.
---

# K95 Creative Design System Specification

## 1. Palette màu chủ đạo (Color Palette)
- `--color-bg`: `#1500E1` (Electric Cobalt Blue - biểu tượng K95)
- `--color-noir`: `#0C0A0C` (Dark Noir / Deep Charcoal)
- `--color-white`: `#FFFFFF` (Pure Stark White)
- `--color-accent-lime`: `#C7FB5B` (Solana / Devnet neon lime)
- `--color-glass`: `hsla(0, 0%, 100%, 0.12)` (Frosted blur layer)
- `--color-glass-border`: `hsla(0, 0%, 100%, 0.22)`
- `--color-dimmed`: `rgba(255, 255, 255, 0.55)`

## 2. Nghệ thuật chữ (Typography)
- **Primary Grotesk**: Thụy Sĩ / Modern Grotesk (Geist, Space Grotesk, Syne, Inter, Helvetica Neue).
- **Tracked Uppercase Navigation & Badges**: `text-transform: uppercase; letter-spacing: 0.05em to 0.1em; font-size: 0.875rem;`.
- **Tabular Numbers**: `font-variant-numeric: tabular-nums; font-family: monospace, Geist Mono;` cho các bộ đếm `[0% → 100%]`, mã băm, số chỉ mục `01, 02, 03`.

## 3. Quy tắc giao diện & Không gian (Layout & Grid)
- **Margin & Padding**: `var(--margin)` linh hoạt từ `24px` (mobile) đến `48px` - `64px` (desktop).
- **Brutalist Borders**: Đường phân cách sắc nét `1px solid rgba(255,255,255,0.15)`.
- **Floating Controls**: Nút bấm bo tròn 100px dạng pill với lớp nền kính mờ `backdrop-filter: blur(14px)`.

## 4. Bảo toàn Backend & Toàn vẹn hệ thống
- Không thay đổi các API Route Handlers, Database Schemas (`drizzle`), logic SIWS Auth, Solana program credentials, hay AI rubric prompts.
- Toàn bộ giao diện mới kết nối trực tiếp vào state và context sẵn có của dự án (`useLanguage`, `wallet-sign-in`, etc.).

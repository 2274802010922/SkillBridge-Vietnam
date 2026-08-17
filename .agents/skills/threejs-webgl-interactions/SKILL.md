---
name: threejs-webgl-interactions
description: Hướng dẫn xây dựng sân khấu WebGL/Three.js 3D theo phong cách K95 (Rings & Spiral Switcher, Orbit Physics, Raycasting Hover, Project Label Pill).
---

# Three.js WebGL 3D Orbit & Interaction Guide

## 1. Mô hình hiển thị Rings & Spiral
- **Rings Mode**: Các card bằng chứng & đối tác (Solana, VLU, UniHackFest, Corelia, USDC, v.v.) được xếp thành các vòng tròn 3D đồng tâm chuyển động chậm (slow orbital rotation).
- **Spiral Mode**: Các card được xếp theo đường xoắn ốc 3D (logarithmic / Archimedean spiral) có thể cuộn vô tận.
- **Chuyển đổi trạng thái (Morphing)**: Dùng lerp / GSAP tween để nội suy mượt mà vị trí `(x, y, z)` và góc xoay `(rx, ry, rz)` của từng card giữa 2 chế độ.

## 2. Tương tác chuột & Vật lý quán tính (Drag & Momentum)
- Lắng nghe sự kiện kéo chuột (`pointerdown`, `pointermove`, `pointerup`) hoặc cuộn bánh xe (`wheel`) để xoay trục 3D.
- Áp dụng hệ số ma sát (friction ~0.92) và vận tốc quán tính (velocity damping) giúp chuyển động mượt mà.
- Raycasting để phát hiện card đang được hover: Phóng to nhẹ (`scale: 1.08`), đổi màu viền sáng và cập nhật vị trí cho thẻ nổi `ProjectLabelPill` bám theo chuột.

## 3. Tối ưu hiệu năng
- Sử dụng InstancedMesh hoặc cấu trúc Canvas 2D/3D GPU-accelerated nhẹ nhàng.
- Tự động tạm dừng render loop khi tab trình duyệt không kích hoạt hoặc khi người dùng cuộn khỏi vùng nhìn thấy.
- Hỗ trợ fallback mượt mà cho các thiết bị yếu hoặc giảm chuyển động (`prefers-reduced-motion`).

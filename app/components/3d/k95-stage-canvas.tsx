"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { ORBIT_NODES, type OrbitNodeItem } from "./orbit-card-data";
import { ProjectLabelPill } from "./project-label-pill";
import { K95LayoutSwitch, type LayoutMode } from "../ui/k95-layout-switch";

interface K95StageCanvasProps {
  isEn?: boolean;
}

// Generate high-resolution crisp 2D canvas texture for each node card
function createCardTexture(node: OrbitNodeItem, isEn: boolean): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 420;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // Background gradient with deep studio contrast
    const grad = ctx.createLinearGradient(0, 0, 640, 420);
    grad.addColorStop(0, "rgba(18, 12, 40, 0.95)");
    grad.addColorStop(1, "rgba(8, 6, 20, 0.98)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(0, 0, 640, 420, 28);
    ctx.fill();

    // Vibrant Glowing Border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Top Accent line with category color
    ctx.fillStyle = node.accentColor || "#14F195";
    ctx.fillRect(36, 26, 90, 6);

    // Index & Category
    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    ctx.font = "bold 22px monospace";
    ctx.fillText(`[${node.index}]`, 36, 72);

    ctx.fillStyle = node.accentColor || "#FFFFFF";
    ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText((isEn ? node.categoryEn : node.categoryVi).toUpperCase(), 130, 72);

    // Title (Bold Crisp White)
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 36px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(node.name, 36, 140);

    // Subtitle (Wrapped & Legible)
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "22px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    const subText = isEn ? node.subtitleEn : node.subtitleVi;
    const words = subText.split(" ");
    let line = "";
    let y = 200;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      if (metrics.width > 560 && n > 0) {
        ctx.fillText(line, 36, y);
        line = words[n] + " ";
        y += 32;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 36, y);

    // Bottom badge (Solana Verified)
    ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
    ctx.beginPath();
    ctx.roundRect(36, 340, 260, 48, 14);
    ctx.fill();
    ctx.fillStyle = "#C7FB5B";
    ctx.font = "bold 18px monospace";
    ctx.fillText(`✓ VERIFIED ON SOLANA`, 54, 372);

    // Arrow icon top right
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(570, 64);
    ctx.lineTo(592, 42);
    ctx.moveTo(570, 42);
    ctx.lineTo(592, 42);
    ctx.lineTo(592, 64);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 16;
  return texture;
}

export function K95StageCanvas({ isEn = false }: K95StageCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("spiral");
  const [hoveredNode, setHoveredNode] = useState<OrbitNodeItem | null>(null);
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });
  const [showPill, setShowPill] = useState(false);

  const modeRef = useRef<LayoutMode>("spiral");
  modeRef.current = layoutMode;

  const handleLayoutChange = useCallback((mode: LayoutMode) => {
    setLayoutMode(mode);
    modeRef.current = mode;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- THREE.JS SCENE SETUP ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x07060b, 0.035);

    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 0.5, 14);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    // Dynamic Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
    scene.add(ambientLight);

    const pointLightBlue = new THREE.PointLight(0x1500e1, 5, 40);
    pointLightBlue.position.set(6, 6, 10);
    scene.add(pointLightBlue);

    const pointLightPurple = new THREE.PointLight(0x7b2cbf, 3.5, 40);
    pointLightPurple.position.set(-8, -4, 8);
    scene.add(pointLightPurple);

    // --- CENTER PROOF STAR / FLOWER ---
    const centerGroup = new THREE.Group();
    centerGroup.position.set(0, 0, -2);
    const petalGeo = new THREE.CylinderGeometry(0.14, 0.4, 2.6, 16);
    const petalMat = new THREE.MeshStandardMaterial({
      color: 0x1500e1,
      emissive: 0x2e19d6,
      emissiveIntensity: 0.9,
      roughness: 0.15,
      metalness: 0.7,
    });

    for (let p = 0; p < 10; p++) {
      const petal = new THREE.Mesh(petalGeo, petalMat);
      petal.rotation.z = (p * Math.PI * 2) / 10;
      petal.position.set(
        Math.sin((p * Math.PI * 2) / 10) * 1.1,
        Math.cos((p * Math.PI * 2) / 10) * 1.1,
        0
      );
      centerGroup.add(petal);
    }
    const coreGeo = new THREE.SphereGeometry(0.65, 32, 32);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xc7fb5b,
      emissive: 0xc7fb5b,
      emissiveIntensity: 0.8,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    centerGroup.add(coreMesh);
    scene.add(centerGroup);

    // --- ORBIT CARD MESHES ---
    const main3DGroup = new THREE.Group();
    scene.add(main3DGroup);

    const cardWidth = 2.8;
    const cardHeight = 1.84;
    const cardGeometry = new THREE.PlaneGeometry(cardWidth, cardHeight);

    interface CardMeshState {
      mesh: THREE.Mesh;
      node: OrbitNodeItem;
      ringAngle: number;
      ringRadius: number;
      ringY: number;
      spiralT: number;
      spiralAngle: number;
      spiralRadius: number;
      spiralBaseY: number;
    }

    const cardStates: CardMeshState[] = [];

    ORBIT_NODES.forEach((node, i) => {
      const texture = createCardTexture(node, isEn);
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        roughness: 0.2,
        metalness: 0.1,
      });

      const mesh = new THREE.Mesh(cardGeometry, material);
      mesh.userData = { node };

      // Rings parameters
      const isInner = i < 3;
      const ringRadius = isInner ? 4.6 : 7.4;
      const countInRing = isInner ? 3 : 4;
      const idxInRing = isInner ? i : i - 3;
      const ringAngle = (idxInRing / countInRing) * Math.PI * 2 + (isInner ? 0 : 0.5);
      const ringY = isInner ? 0.6 : -0.5;

      // Spiral parameters (stretching along vertical height)
      const spiralT = i / (ORBIT_NODES.length - 1); // 0 to 1
      const spiralAngle = spiralT * Math.PI * 3.4;
      const spiralRadius = 4.2 + spiralT * 3.6;
      const spiralBaseY = (spiralT - 0.5) * 14;

      mesh.position.set(
        Math.cos(spiralAngle) * spiralRadius,
        spiralBaseY,
        Math.sin(spiralAngle) * spiralRadius
      );

      main3DGroup.add(mesh);
      cardStates.push({
        mesh,
        node,
        ringAngle,
        ringRadius,
        ringY,
        spiralT,
        spiralAngle,
        spiralRadius,
        spiralBaseY,
      });
    });

    // --- INTERACTION, DRAG & SCROLL-LINKED MOTION ---
    let isDragging = false;
    let previousPointerX = 0;
    let previousPointerY = 0;
    let targetRotationY = 0;
    let targetRotationX = 0;
    let currentRotationY = 0;
    let currentRotationX = 0;
    let velX = 0;
    let velY = 0;

    let targetScrollProgress = 0;
    let currentScrollProgress = 0;

    const onScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight > 0) {
        targetScrollProgress = window.scrollY / scrollHeight;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(-100, -100);

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      // Don't drag if clicking interactive links or buttons
      const target = e.target as HTMLElement | null;
      if (target && (target.closest("button") || target.closest("a") || target.closest(".k95-interactive"))) {
        return;
      }
      isDragging = true;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      previousPointerX = clientX;
      previousPointerY = clientY;
      velX = 0;
      velY = 0;
    };

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      setMousePos({ x: clientX, y: clientY });
      setShowPill(true);

      mouse.x = (clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(clientY / window.innerHeight) * 2 + 1;

      if (isDragging) {
        const deltaX = clientX - previousPointerX;
        const deltaY = clientY - previousPointerY;
        velX = deltaX * 0.004;
        velY = deltaY * 0.0025;
        targetRotationY += velX;
        targetRotationX += velY;
        previousPointerX = clientX;
        previousPointerY = clientY;
      }
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("mousemove", onPointerMove, { passive: true });
    window.addEventListener("mouseup", onPointerUp);
    window.addEventListener("touchstart", onPointerDown, { passive: true });
    window.addEventListener("touchmove", onPointerMove, { passive: true });
    window.addEventListener("touchend", onPointerUp);

    // Resize Handler
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    // --- ANIMATION RENDER LOOP ---
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth scroll interpolation
      currentScrollProgress += (targetScrollProgress - currentScrollProgress) * 0.06;

      // Inertia & auto-rotation
      if (!isDragging) {
        targetRotationY += 0.0012; // slow gentle ambient spin
        velX *= 0.94;
        velY *= 0.94;
        targetRotationY += velX;
        targetRotationX += velY;
      }

      // Constrain vertical pitch
      targetRotationX = Math.max(-0.35, Math.min(0.35, targetRotationX));

      currentRotationY += (targetRotationY - currentRotationY) * 0.08;
      currentRotationX += (targetRotationX - currentRotationX) * 0.08;

      // Rotate and position 3D universe linked to page scroll
      main3DGroup.rotation.x = currentRotationX;
      centerGroup.rotation.z = -elapsedTime * 0.25;
      centerGroup.rotation.y = elapsedTime * 0.12;

      // In Spiral Mode, page scroll drives the spiral vertically through the screen!
      const currentMode = modeRef.current;
      const scrollOffset = (currentScrollProgress - 0.15) * 16;
      const scrollRotation = currentScrollProgress * Math.PI * 2.2;

      main3DGroup.position.y = currentMode === "spiral" ? scrollOffset : -currentScrollProgress * 3;
      main3DGroup.rotation.y = currentRotationY + (currentMode === "spiral" ? scrollRotation : scrollRotation * 0.5);

      // Raycasting hover detection
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(cardStates.map((s) => s.mesh));

      let currentHovered: OrbitNodeItem | null = null;
      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        if (hitMesh.userData.node) {
          currentHovered = hitMesh.userData.node;
        }
      }
      setHoveredNode(currentHovered);

      // Calculate Target Position & BILLBOARD ORIENTATION for each card
      cardStates.forEach((state) => {
        let targetPos: THREE.Vector3;

        if (currentMode === "spiral") {
          const a = state.spiralAngle;
          const r = state.spiralRadius;
          const y = state.spiralBaseY;
          targetPos = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
        } else {
          const a = state.ringAngle;
          const r = state.ringRadius;
          const y = state.ringY + Math.sin(a * 2) * 0.4;
          targetPos = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
        }

        state.mesh.position.lerp(targetPos, 0.06);

        // =========================================================================
        // AUTO-BILLBOARD ORIENTATION (CRITICAL FIX: NEVER REVERSED OR MIRRORED TEXT)
        // =========================================================================
        // We ensure every single card's front side always faces the camera directly!
        state.mesh.quaternion.copy(camera.quaternion);

        // Hover scale & elevation
        const isHovered = currentHovered?.id === state.node.id;
        const targetScale = isHovered ? 1.18 : 1.0;
        state.mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.14);
      });

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
      window.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("touchmove", onPointerMove);
      window.removeEventListener("touchend", onPointerUp);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [isEn]);

  return (
    <>
      {/* Full-Page Fixed Persistent 3D WebGL Canvas Layer */}
      <div className="k95-persistent-canvas" ref={containerRef} aria-hidden="true" />

      {/* Floating 3D Mode Controller */}
      <div className="k95-floating-controls">
        <K95LayoutSwitch mode={layoutMode} onChange={handleLayoutChange} isEn={isEn} />
      </div>

      {/* Mouse-following info pill */}
      <ProjectLabelPill
        activeNode={hoveredNode}
        position={mousePos}
        visible={showPill}
        isEn={isEn}
      />
    </>
  );
}

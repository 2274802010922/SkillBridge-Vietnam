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
  canvas.width = 600;
  canvas.height = 380;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // Background with sleek studio dark glass styling
    const grad = ctx.createLinearGradient(0, 0, 600, 380);
    grad.addColorStop(0, "rgba(22, 16, 48, 0.95)");
    grad.addColorStop(1, "rgba(10, 8, 22, 0.98)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(0, 0, 600, 380, 24);
    ctx.fill();

    // Vibrant Glowing Border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Top Accent line with category color
    ctx.fillStyle = node.accentColor || "#14F195";
    ctx.fillRect(32, 24, 80, 5);

    // Index & Category
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "bold 20px monospace";
    ctx.fillText(`[${node.index}]`, 32, 68);

    ctx.fillStyle = node.accentColor || "#FFFFFF";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText((isEn ? node.categoryEn : node.categoryVi).toUpperCase(), 120, 68);

    // Title (Bold Crisp White)
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 32px sans-serif";
    ctx.fillText(node.name, 32, 130);

    // Subtitle (Wrapped & Legible)
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.font = "20px sans-serif";
    const subText = isEn ? node.subtitleEn : node.subtitleVi;
    const words = subText.split(" ");
    let line = "";
    let y = 185;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      if (metrics.width > 520 && n > 0) {
        ctx.fillText(line, 32, y);
        line = words[n] + " ";
        y += 30;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 32, y);

    // Bottom badge (Solana Verified)
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.beginPath();
    ctx.roundRect(32, 305, 240, 44, 12);
    ctx.fill();
    ctx.fillStyle = "#C7FB5B";
    ctx.font = "bold 16px monospace";
    ctx.fillText(`✓ VERIFIED DEVNET`, 48, 334);

    // Arrow icon top right
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(535, 58);
    ctx.lineTo(555, 38);
    ctx.moveTo(535, 38);
    ctx.lineTo(555, 38);
    ctx.lineTo(555, 58);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
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
    // Gentle linear fog for deep atmospheric feel without turning cards pitch black
    scene.fog = new THREE.Fog(0x07060b, 18, 55);

    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 13);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    // Dynamic Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.2);
    scene.add(ambientLight);

    const pointLightBlue = new THREE.PointLight(0x1500e1, 6, 50);
    pointLightBlue.position.set(8, 6, 8);
    scene.add(pointLightBlue);

    const pointLightPurple = new THREE.PointLight(0x7b2cbf, 4, 50);
    pointLightPurple.position.set(-8, -6, 6);
    scene.add(pointLightPurple);

    // --- SLEEK GLOWING GYROSCOPIC CORE ---
    const coreGroup = new THREE.Group();
    coreGroup.position.set(0, 0, -3);

    // Subtle luminous outer ring
    const ringGeo1 = new THREE.TorusGeometry(2.4, 0.04, 16, 64);
    const ringMat1 = new THREE.MeshBasicMaterial({ color: 0x1500e1, transparent: true, opacity: 0.6 });
    const ringMesh1 = new THREE.Mesh(ringGeo1, ringMat1);
    coreGroup.add(ringMesh1);

    const ringGeo2 = new THREE.TorusGeometry(1.6, 0.03, 16, 64);
    const ringMat2 = new THREE.MeshBasicMaterial({ color: 0xc7fb5b, transparent: true, opacity: 0.7 });
    const ringMesh2 = new THREE.Mesh(ringGeo2, ringMat2);
    ringMesh2.rotation.x = Math.PI / 3;
    coreGroup.add(ringMesh2);

    const sphereCoreGeo = new THREE.SphereGeometry(0.5, 32, 32);
    const sphereCoreMat = new THREE.MeshStandardMaterial({
      color: 0x1500e1,
      emissive: 0x2412b8,
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.8,
    });
    const sphereCore = new THREE.Mesh(sphereCoreGeo, sphereCoreMat);
    coreGroup.add(sphereCore);
    scene.add(coreGroup);

    // Ambient Stardust Particles in background
    const particleCount = 180;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let p = 0; p < particleCount * 3; p += 3) {
      particlePositions[p] = (Math.random() - 0.5) * 35;
      particlePositions[p + 1] = (Math.random() - 0.5) * 45;
      particlePositions[p + 2] = (Math.random() - 0.5) * 20 - 4;
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0xc7fb5b,
      size: 0.08,
      transparent: true,
      opacity: 0.5,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // --- 3D ORBIT CARDS ---
    const main3DGroup = new THREE.Group();
    scene.add(main3DGroup);

    const cardWidth = 3.0;
    const cardHeight = 1.9;
    const cardGeometry = new THREE.PlaneGeometry(cardWidth, cardHeight);

    interface CardMeshState {
      mesh: THREE.Mesh;
      node: OrbitNodeItem;
      ringAngle: number;
      ringRadius: number;
      ringY: number;
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
        roughness: 0.15,
        metalness: 0.1,
      });

      const mesh = new THREE.Mesh(cardGeometry, material);
      mesh.userData = { node };

      // Rings Mode: 2 concentric orbiting rings
      const isInner = i < 3;
      const ringRadius = isInner ? 4.8 : 7.6;
      const countInRing = isInner ? 3 : 4;
      const idxInRing = isInner ? i : i - 3;
      const ringAngle = (idxInRing / countInRing) * Math.PI * 2 + (isInner ? 0 : 0.6);
      const ringY = isInner ? 1.0 : -1.2;

      // Spiral Mode: elegant vertical spiral wrapping around the scroll space
      const spiralT = i / (ORBIT_NODES.length - 1); // 0 to 1
      const spiralAngle = spiralT * Math.PI * 2.8;
      const spiralRadius = 5.2 + (i % 2 === 0 ? 0.8 : -0.4);
      const spiralBaseY = (0.5 - spiralT) * 12; // spans from +6 to -6

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
        spiralAngle,
        spiralRadius,
        spiralBaseY,
      });
    });

    // --- INTERACTION & SCROLL-LINKED ENGINE ---
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
      const target = e.target as HTMLElement | null;
      if (target && (target.closest("button") || target.closest("a") || target.closest("input"))) {
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
        velX = deltaX * 0.0035;
        velY = deltaY * 0.002;
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

    // --- ANIMATION LOOP ---
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth scroll interpolation
      currentScrollProgress += (targetScrollProgress - currentScrollProgress) * 0.07;

      // Inertia & gentle ambient auto-spin
      if (!isDragging) {
        targetRotationY += 0.001;
        velX *= 0.94;
        velY *= 0.94;
        targetRotationY += velX;
        targetRotationX += velY;
      }

      // Constrain vertical pitch
      targetRotationX = Math.max(-0.25, Math.min(0.25, targetRotationX));

      currentRotationY += (targetRotationY - currentRotationY) * 0.08;
      currentRotationX += (targetRotationX - currentRotationX) * 0.08;

      // Gyroscope core motion
      coreGroup.rotation.y = elapsedTime * 0.25;
      coreGroup.rotation.x = Math.sin(elapsedTime * 0.3) * 0.2;
      ringMesh1.rotation.z = -elapsedTime * 0.4;
      ringMesh2.rotation.y = elapsedTime * 0.5;

      // Particles subtle drift
      particleSystem.rotation.y = elapsedTime * 0.02;

      // 3D group position and rotation linked directly to scroll progress
      const currentMode = modeRef.current;
      const scrollYOffset = (currentScrollProgress - 0.2) * 14;
      const scrollYRotation = currentScrollProgress * Math.PI * 2.0;

      main3DGroup.position.y = currentMode === "spiral" ? scrollYOffset : -currentScrollProgress * 2;
      main3DGroup.rotation.y = currentRotationY + (currentMode === "spiral" ? scrollYRotation : scrollYRotation * 0.4);
      main3DGroup.rotation.x = currentRotationX;

      // Raycasting hover check
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

      // Lerp card positions & apply 100% BILLBOARD ORIENTATION
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
          const y = state.ringY + Math.sin(a * 2) * 0.3;
          targetPos = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
        }

        state.mesh.position.lerp(targetPos, 0.07);

        // BILLBOARD: Cards always face camera directly, never reversed!
        state.mesh.quaternion.copy(camera.quaternion);

        // Hover scale
        const isHovered = currentHovered?.id === state.node.id;
        const targetScale = isHovered ? 1.15 : 1.0;
        state.mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.15);
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
      {/* Full-Page Persistent 3D WebGL Canvas */}
      <div className="k95-persistent-canvas" ref={containerRef} aria-hidden="true" />

      {/* Floating 3D Mode Controller */}
      <div className="k95-floating-controls">
        <K95LayoutSwitch mode={layoutMode} onChange={handleLayoutChange} isEn={isEn} />
      </div>

      {/* Tooltip Pill: ONLY displayed when user hovers on a 3D card */}
      <ProjectLabelPill
        activeNode={hoveredNode}
        position={mousePos}
        visible={showPill}
        isEn={isEn}
      />
    </>
  );
}

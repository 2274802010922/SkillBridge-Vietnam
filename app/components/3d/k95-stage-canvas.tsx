"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { ORBIT_NODES, type OrbitNodeItem } from "./orbit-card-data";
import { ProjectLabelPill } from "./project-label-pill";
import type { LayoutMode } from "../ui/k95-layout-switch";

interface K95StageCanvasProps {
  isEn?: boolean;
  layoutMode?: LayoutMode;
}

// Generate high-resolution crisp 2D canvas texture for each node card
function createCardTexture(node: OrbitNodeItem, isEn: boolean): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 380;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // Background with sleek midnight glass styling
    const grad = ctx.createLinearGradient(0, 0, 600, 380);
    grad.addColorStop(0, "rgba(10, 4, 48, 0.96)");
    grad.addColorStop(1, "rgba(4, 2, 28, 0.98)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(0, 0, 600, 380, 24);
    ctx.fill();

    // Vibrant Glowing Border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Top Accent line with category color
    ctx.fillStyle = node.accentColor || "#14F195";
    ctx.fillRect(32, 24, 80, 5);

    // Index & Category
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
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
    ctx.fillStyle = "#E2E8F0";
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
    ctx.fillText(`VERIFIED DEVNET`, 48, 334);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  return texture;
}

export function K95StageCanvas({ isEn = false, layoutMode = "rings" }: K95StageCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<OrbitNodeItem | null>(null);
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });
  const [showPill, setShowPill] = useState(false);

  const modeRef = useRef<LayoutMode>(layoutMode);
  modeRef.current = layoutMode;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- THREE.JS SCENE SETUP (K95 ROYAL COBALT BLUE THEME) ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a00d8);
    scene.fog = new THREE.Fog(0x0a00d8, 35, 95);

    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      120
    );
    camera.position.set(0, 0, 13.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    // --- K95 3D CURVED PERSPECTIVE WIREFRAME GRID (CARO GRID DOME) ---
    const gridRadius = 16.5;
    const gridHeight = 44;
    const gridSegmentsRadial = 32;
    const gridSegmentsHeight = 24;
    const gridCylinderGeo = new THREE.CylinderGeometry(
      gridRadius,
      gridRadius,
      gridHeight,
      gridSegmentsRadial,
      gridSegmentsHeight,
      true
    );
    const wireframeGeo = new THREE.WireframeGeometry(gridCylinderGeo);
    const gridLineMat = new THREE.LineBasicMaterial({
      color: 0x000078,
      transparent: true,
      opacity: 0.55,
      linewidth: 1,
    });
    const gridMesh = new THREE.LineSegments(wireframeGeo, gridLineMat);
    scene.add(gridMesh);

    // Dynamic Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.8);
    scene.add(ambientLight);

    const pointLightCobalt = new THREE.PointLight(0x1500e1, 7.5, 50);
    pointLightCobalt.position.set(8, 6, 8);
    scene.add(pointLightCobalt);

    const pointLightPurple = new THREE.PointLight(0x7b2cbf, 4.5, 50);
    pointLightPurple.position.set(-8, -6, 6);
    scene.add(pointLightPurple);

    const pointLightLime = new THREE.PointLight(0xc7fb5b, 3.5, 30);
    pointLightLime.position.set(0, 0, 5);
    scene.add(pointLightLime);

    // --- K95 3D KINETIC PARAMETRIC BLOOMING FLOWER ---
    const flowerGroup = new THREE.Group();
    flowerGroup.position.set(0, 0, -2.5);

    // 1. Center Pistil (Glowing Crystal Sphere)
    const pistilGeo = new THREE.SphereGeometry(0.72, 32, 32);
    const pistilMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xc7fb5b,
      emissiveIntensity: 0.9,
      roughness: 0.15,
      metalness: 0.9,
    });
    const pistilMesh = new THREE.Mesh(pistilGeo, pistilMat);
    flowerGroup.add(pistilMesh);

    // 2. Outer Layer Petals (8 Symmetrical Blooming Petals - Chrome White & Electric Lime)
    const outerPetalCount = 8;
    const outerPetalRadius = 3.45;

    for (let i = 0; i < outerPetalCount; i++) {
      const angle = (i / outerPetalCount) * Math.PI * 2;
      const isLime = i % 2 === 0;

      const pStart = new THREE.Vector3(0, 0, 0.12);
      const pMid1 = new THREE.Vector3(
        Math.cos(angle - 0.22) * (outerPetalRadius * 0.55),
        Math.sin(angle - 0.22) * (outerPetalRadius * 0.55),
        0.55
      );
      const pTip = new THREE.Vector3(
        Math.cos(angle) * outerPetalRadius,
        Math.sin(angle) * outerPetalRadius,
        0.12
      );
      const pMid2 = new THREE.Vector3(
        Math.cos(angle + 0.22) * (outerPetalRadius * 0.55),
        Math.sin(angle + 0.22) * (outerPetalRadius * 0.55),
        -0.45
      );

      const petalCurve = new THREE.CatmullRomCurve3([pStart, pMid1, pTip, pMid2, pStart]);
      const petalTubeGeo = new THREE.TubeGeometry(petalCurve, 40, 0.05, 8, true);

      const petalMat = new THREE.MeshStandardMaterial({
        color: isLime ? 0xc7fb5b : 0xffffff,
        emissive: isLime ? 0x82b814 : 0x666666,
        emissiveIntensity: 0.85,
        roughness: 0.2,
        metalness: 0.8,
      });

      const petalMesh = new THREE.Mesh(petalTubeGeo, petalMat);
      flowerGroup.add(petalMesh);
    }

    // 3. Inner Layer Petals (6 Offset Petals - Neon Purple #9945FF)
    const innerPetalCount = 6;
    const innerPetalRadius = 2.35;

    for (let j = 0; j < innerPetalCount; j++) {
      const angle = (j / innerPetalCount) * Math.PI * 2 + Math.PI / 6;

      const pStart = new THREE.Vector3(0, 0, 0.18);
      const pMid1 = new THREE.Vector3(
        Math.cos(angle - 0.25) * (innerPetalRadius * 0.5),
        Math.sin(angle - 0.25) * (innerPetalRadius * 0.5),
        0.45
      );
      const pTip = new THREE.Vector3(
        Math.cos(angle) * innerPetalRadius,
        Math.sin(angle) * innerPetalRadius,
        0.25
      );
      const pMid2 = new THREE.Vector3(
        Math.cos(angle + 0.25) * (innerPetalRadius * 0.5),
        Math.sin(angle + 0.25) * (innerPetalRadius * 0.5),
        -0.3
      );

      const innerCurve = new THREE.CatmullRomCurve3([pStart, pMid1, pTip, pMid2, pStart]);
      const innerTubeGeo = new THREE.TubeGeometry(innerCurve, 32, 0.042, 8, true);

      const innerMat = new THREE.MeshStandardMaterial({
        color: 0x9945ff,
        emissive: 0x721ae6,
        emissiveIntensity: 0.9,
        roughness: 0.2,
        metalness: 0.8,
      });

      const innerPetalMesh = new THREE.Mesh(innerTubeGeo, innerMat);
      flowerGroup.add(innerPetalMesh);
    }

    scene.add(flowerGroup);

    // Ambient Stardust Particles
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

    // --- K95 PERFECT 360° CYLINDRICAL CAROUSEL RING (EQUIDISTANT & CLEAN) ---
    const main3DGroup = new THREE.Group();
    scene.add(main3DGroup);

    const cardWidth = 3.0;
    const cardHeight = 1.9;
    const cardGeometry = new THREE.PlaneGeometry(cardWidth, cardHeight);

    interface CardMeshState {
      mesh: THREE.Mesh;
      node: OrbitNodeItem;
      index: number;
    }

    const cardStates: CardMeshState[] = [];
    const totalCards = ORBIT_NODES.length; // 7 cards

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

      main3DGroup.add(mesh);
      cardStates.push({
        mesh,
        node,
        index: i,
      });
    });

    // --- INTERACTION & SCROLL PHYSICS ENGINE ---
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

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", handleResize);

    // --- ANIMATION LOOP (K95 PERFECT CAROUSEL RING) ---
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth scroll interpolation
      currentScrollProgress += (targetScrollProgress - currentScrollProgress) * 0.07;

      // Inertia & continuous smooth carousel spin
      if (!isDragging) {
        targetRotationY += 0.002;
        velX *= 0.94;
        velY *= 0.94;
        targetRotationY += velX;
        targetRotationX += velY;
      }

      targetRotationX = Math.max(-0.25, Math.min(0.25, targetRotationX));

      currentRotationY += (targetRotationY - currentRotationY) * 0.08;
      currentRotationX += (targetRotationX - currentRotationX) * 0.08;

      // K95 3D Grid rotation & perspective tilt
      gridMesh.rotation.y = elapsedTime * 0.03 + currentRotationY * 0.35;
      gridMesh.rotation.x = currentRotationX * 0.3;
      gridMesh.position.y = (currentScrollProgress - 0.2) * 4;

      // K95 3D KINETIC FLOWER BLOOMING & ROTATION
      flowerGroup.rotation.z = -elapsedTime * 0.25;
      flowerGroup.rotation.y = Math.sin(elapsedTime * 0.35) * 0.4 + currentRotationY * 0.45;
      flowerGroup.rotation.x = Math.cos(elapsedTime * 0.25) * 0.2 + currentRotationX * 0.45;

      // Breathing kinetic pulse (Bloom cycle)
      const bloomScale = 1.0 + Math.sin(elapsedTime * 1.5) * 0.08;
      flowerGroup.scale.set(bloomScale, bloomScale, bloomScale);

      // Particles drift
      particleSystem.rotation.y = elapsedTime * 0.02;

      // Center the carousel in view
      main3DGroup.position.y = 0;
      main3DGroup.rotation.x = currentRotationX * 0.4;

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

      // --- K95 360° EQUIDISTANT CYLINDRICAL CAROUSEL MATH ---
      const currentMode = modeRef.current;
      const ringRadius = 7.4; // Perfectly scaled radius with spacious 3.6m gaps between cards

      cardStates.forEach((state) => {
        // Equidistant angular slot for each of the 7 cards
        const baseAngle = (state.index / totalCards) * Math.PI * 2;
        const angle = baseAngle + currentRotationY;

        const targetX = Math.cos(angle) * ringRadius;
        const targetZ = Math.sin(angle) * ringRadius;
        
        // In "rings" mode: cards form a clean horizontal 360° ring
        // In "spiral" mode: cards form a clean cascading helix
        const targetY = currentMode === "spiral" 
          ? ((state.index - (totalCards - 1) / 2) / (totalCards / 2)) * 2.2
          : 0;

        const targetPos = new THREE.Vector3(targetX, targetY, targetZ);
        state.mesh.position.lerp(targetPos, 0.08);

        // K95 Tangent Cylindrical Orientation (Cards face outwards in perspective)
        state.mesh.lookAt(0, targetY, 0);
        state.mesh.rotateY(Math.PI);

        // Dynamic depth scaling (front cards slightly larger & crisp)
        const isHovered = currentHovered?.id === state.node.id;
        const depthBonus = targetZ > 0 ? 1.06 : 0.92;
        const targetScale = isHovered ? 1.22 : depthBonus;
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

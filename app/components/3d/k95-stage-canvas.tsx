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

// Build the iconic K95 3D Pixel Chrome Rose Geometry
function createPixelRoseGroup(): THREE.Group {
  const roseGroup = new THREE.Group();

  const chromeMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.96,
    roughness: 0.1,
    emissive: 0x1a1a2e,
    emissiveIntensity: 0.35,
  });

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: 0.45,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.055,
    bevelThickness: 0.065,
  };

  const pw = 0.28; // pixel width unit

  // Helper to add extruded stepped pixel ribbons
  const addPixelPath = (points: [number, number][]) => {
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0] * pw, points[0][1] * pw);
    for (let i = 1; i < points.length; i++) {
      shape.lineTo(points[i][0] * pw, points[i][1] * pw);
    }
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.center();
    const mesh = new THREE.Mesh(geo, chromeMaterial);
    roseGroup.add(mesh);
  };

  // 1. Outer Rose Petal Contour (Stepped Pixel Rose Outline)
  addPixelPath([
    [-5, 7], [-3, 9], [3, 9], [5, 7], [7, 4], [7, 1], [5, -1], [3, -3],
    [0, -4], [-3, -3], [-5, -1], [-7, 1], [-7, 4], [-5, 7],
    [-4, 6], [-6, 3.5], [-6, 1.5], [-4.5, 0], [-2.5, -2], [0, -3], [2.5, -2],
    [4.5, 0], [6, 1.5], [6, 3.5], [4, 6], [2.5, 7.8], [-2.5, 7.8], [-4, 6]
  ]);

  // 2. Middle Petal Ribbon (Inner Stepped Ring 1)
  addPixelPath([
    [-3.5, 6], [0, 7], [3.5, 6], [4.5, 3.5], [3, 1], [0, 0], [-3, 1], [-4.5, 3.5], [-3.5, 6],
    [-2.5, 5], [-3.5, 3.5], [-2, 1.8], [0, 1], [2, 1.8], [3.5, 3.5], [2.5, 5], [0, 5.8], [-2.5, 5]
  ]);

  // 3. Inner Core Petal Spiral (Inner Stepped Ring 2)
  addPixelPath([
    [-1.8, 4.2], [0, 4.8], [1.8, 4.2], [2.2, 2.8], [0.8, 2], [-1.2, 2.2], [-1.8, 4.2],
    [-1, 3.5], [0, 4], [1, 3.5], [1.2, 2.8], [0.4, 2.6], [-0.6, 2.8], [-1, 3.5]
  ]);

  // 4. Rose Stem (Stepped Vertical Column)
  addPixelPath([
    [-0.5, -3.8], [0.5, -3.8], [0.5, -10], [-0.5, -10], [-0.5, -3.8]
  ]);

  // 5. Right Leaf (Stepped Pixel Leaf)
  addPixelPath([
    [0.5, -5.5], [2.5, -4.5], [5, -4.5], [6.5, -6], [4.5, -7.5], [2, -7.5], [0.5, -6.5],
    [0.5, -5.5],
    [1.5, -6], [2.5, -5.3], [4.5, -5.3], [5.5, -6.2], [4, -6.8], [2, -6.8], [1.5, -6]
  ]);

  // 6. Left Leaf (Stepped Pixel Leaf)
  addPixelPath([
    [-0.5, -6.8], [-2.5, -5.8], [-5, -5.8], [-6.5, -7.3], [-4.5, -8.8], [-2, -8.8], [-0.5, -7.8],
    [-0.5, -6.8],
    [-1.5, -7.3], [-2.5, -6.6], [-4.5, -6.6], [-5.5, -7.5], [-4, -8.1], [-2, -8.1], [-1.5, -7.3]
  ]);

  // Scale up by ~38% as requested for prominent, bold presentation
  roseGroup.scale.set(1.38, 1.38, 1.38);
  roseGroup.position.set(0, 0.5, -1.8);

  return roseGroup;
}

export function K95StageCanvas({ isEn = false, layoutMode = "spiral" }: K95StageCanvasProps) {
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
    scene.fog = new THREE.Fog(0x0a00d8, 20, 62);

    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 13.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    // --- K95 3D CURVED PERSPECTIVE WIREFRAME GRID (CARO GRID DOME) ---
    const gridRadius = 15.5;
    const gridHeight = 42;
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

    // --- STUDIO LIGHTING SYSTEM FOR LIQUID CHROME REFLECTIONS ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.8);
    scene.add(ambientLight);

    // Key Light (Intense Chrome Rim Shine)
    const keyLightWhite = new THREE.PointLight(0xffffff, 8.5, 50);
    keyLightWhite.position.set(6, 8, 10);
    scene.add(keyLightWhite);

    // Fill Light (Cobalt Blue Ambient Fill)
    const fillLightCobalt = new THREE.PointLight(0x1500e1, 7, 50);
    fillLightCobalt.position.set(-8, -6, 6);
    scene.add(fillLightCobalt);

    // Accent Light (Electric Lime Specular Highlight)
    const accentLightLime = new THREE.PointLight(0xc7fb5b, 3.5, 35);
    accentLightLime.position.set(0, -4, 6);
    scene.add(accentLightLime);

    // --- K95 3D PIXEL CHROME ROSE ---
    const pixelRose = createPixelRoseGroup();
    scene.add(pixelRose);

    // Ambient Stardust Particles
    const particleCount = 160;
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

    // --- 3D ORBIT CARDS (EXPANDED ORBITS FRAMING THE ROSE) ---
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

      // Rings Mode: Expanded concentric orbiting rings (Inner R=5.4, Outer R=8.2)
      const isInner = i < 3;
      const ringRadius = isInner ? 5.4 : 8.2;
      const countInRing = isInner ? 3 : 4;
      const idxInRing = isInner ? i : i - 3;
      const ringAngle = (idxInRing / countInRing) * Math.PI * 2 + (isInner ? 0 : 0.6);
      const ringY = isInner ? 1.2 : -1.4;

      // Spiral Mode: vertical spiral wrapping around the scroll space
      const spiralT = i / (ORBIT_NODES.length - 1);
      const spiralAngle = spiralT * Math.PI * 2.8;
      const spiralRadius = 5.8 + (i % 2 === 0 ? 1.0 : -0.5);
      const spiralBaseY = (0.5 - spiralT) * 13;

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

    // --- ANIMATION LOOP ---
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth scroll interpolation
      currentScrollProgress += (targetScrollProgress - currentScrollProgress) * 0.07;

      // Inertia & ambient auto-spin
      if (!isDragging) {
        targetRotationY += 0.0012;
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
      gridMesh.position.y = (currentScrollProgress - 0.2) * 6;

      // K95 3D PIXEL CHROME ROSE ROTATION & INERTIA
      pixelRose.rotation.y = elapsedTime * 0.28 + currentRotationY * 0.45;
      pixelRose.rotation.x = Math.sin(elapsedTime * 0.35) * 0.18 + currentRotationX * 0.4;
      pixelRose.rotation.z = Math.cos(elapsedTime * 0.25) * 0.08;

      // Particles drift
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

      // Lerp card positions & apply 100% AUTO-BILLBOARD
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
        state.mesh.quaternion.copy(camera.quaternion);

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

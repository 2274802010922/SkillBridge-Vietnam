"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { ORBIT_NODES, type OrbitNodeItem } from "./orbit-card-data";
import { ProjectLabelPill } from "./project-label-pill";
import { K95LayoutSwitch, type LayoutMode } from "../ui/k95-layout-switch";

interface K95StageCanvasProps {
  isEn?: boolean;
}

// Generate high-resolution 2D canvas texture for each node card
function createCardTexture(node: OrbitNodeItem, isEn: boolean): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 360;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 512, 360);
    grad.addColorStop(0, "rgba(22, 10, 48, 0.95)");
    grad.addColorStop(1, "rgba(10, 5, 26, 0.98)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(0, 0, 512, 360, 24);
    ctx.fill();

    // Border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
    ctx.lineWidth = 4;
    ctx.stroke();

    // Top Accent line
    ctx.fillStyle = node.accentColor || "#14F195";
    ctx.fillRect(28, 20, 80, 5);

    // Index & Tag
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "bold 20px monospace";
    ctx.fillText(`[${node.index}]`, 28, 62);

    ctx.fillStyle = node.accentColor || "#FFFFFF";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText((isEn ? node.categoryEn : node.categoryVi).toUpperCase(), 110, 62);

    // Title
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 32px sans-serif";
    ctx.fillText(node.name, 28, 120);

    // Subtitle
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.font = "20px sans-serif";
    const subText = isEn ? node.subtitleEn : node.subtitleVi;
    // Word wrap if long
    const words = subText.split(" ");
    let line = "";
    let y = 175;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      if (metrics.width > 450 && n > 0) {
        ctx.fillText(line, 28, y);
        line = words[n] + " ";
        y += 28;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, 28, y);

    // Bottom badge
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.beginPath();
    ctx.roundRect(28, 290, 220, 44, 12);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 16px monospace";
    ctx.fillText(`VERIFIED ON SOLANA`, 44, 318);

    // Arrow icon top right
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(460, 52);
    ctx.lineTo(476, 36);
    ctx.moveTo(460, 36);
    ctx.lineTo(476, 36);
    ctx.lineTo(476, 52);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  return texture;
}

export function K95StageCanvas({ isEn = false }: K95StageCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("rings");
  const [hoveredNode, setHoveredNode] = useState<OrbitNodeItem | null>(null);
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });
  const [showPill, setShowPill] = useState(false);

  const modeRef = useRef<LayoutMode>("rings");
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
    scene.fog = new THREE.FogExp2(0x0c0a18, 0.045);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 1.2, 14.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x1500e1, 3.5, 30);
    pointLight1.position.set(5, 8, 10);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x7b2cbf, 2.5, 30);
    pointLight2.position.set(-8, -4, 6);
    scene.add(pointLight2);

    // --- CENTER PROOF STAR / FLOWER ---
    const centerGroup = new THREE.Group();
    const petalGeo = new THREE.CylinderGeometry(0.12, 0.35, 2.2, 16);
    const petalMat = new THREE.MeshStandardMaterial({
      color: 0x1500e1,
      emissive: 0x3d24e8,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.6,
    });

    for (let p = 0; p < 10; p++) {
      const petal = new THREE.Mesh(petalGeo, petalMat);
      petal.rotation.z = (p * Math.PI * 2) / 10;
      petal.position.set(
        Math.sin((p * Math.PI * 2) / 10) * 0.9,
        Math.cos((p * Math.PI * 2) / 10) * 0.9,
        0
      );
      centerGroup.add(petal);
    }
    const coreGeo = new THREE.SphereGeometry(0.55, 32, 32);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xc7fb5b,
      emissive: 0xc7fb5b,
      emissiveIntensity: 0.6,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    centerGroup.add(coreMesh);
    scene.add(centerGroup);

    // --- ORBIT CARD MESHES ---
    const cardGroup = new THREE.Group();
    scene.add(cardGroup);

    const cardWidth = 2.4;
    const cardHeight = 1.68;
    const cardGeometry = new THREE.PlaneGeometry(cardWidth, cardHeight);

    interface CardMeshState {
      mesh: THREE.Mesh;
      node: OrbitNodeItem;
      ringsPos: THREE.Vector3;
      ringsRot: THREE.Euler;
      spiralPos: THREE.Vector3;
      spiralRot: THREE.Euler;
      baseScale: number;
    }

    const cardStates: CardMeshState[] = [];

    ORBIT_NODES.forEach((node, i) => {
      const texture = createCardTexture(node, isEn);
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        roughness: 0.3,
        metalness: 0.1,
      });

      const mesh = new THREE.Mesh(cardGeometry, material);
      mesh.userData = { node };

      // Calculate Rings Position
      const isInner = i < 3;
      const ringRadius = isInner ? 4.2 : 6.8;
      const countInRing = isInner ? 3 : 4;
      const idxInRing = isInner ? i : i - 3;
      const ringAngle = (idxInRing / countInRing) * Math.PI * 2 + (isInner ? 0 : 0.4);
      const ringY = isInner ? 0.4 : -0.3;

      const ringsPos = new THREE.Vector3(
        Math.cos(ringAngle) * ringRadius,
        ringY + Math.sin(ringAngle * 2) * 0.4,
        Math.sin(ringAngle) * ringRadius
      );
      const ringsRot = new THREE.Euler(
        0,
        -ringAngle - Math.PI / 2,
        (Math.sin(ringAngle) * 0.12)
      );

      // Calculate Spiral Position
      const spiralT = i / (ORBIT_NODES.length - 1); // 0 to 1
      const spiralAngle = spiralT * Math.PI * 3.2;
      const spiralRadius = 3.6 + spiralT * 3.4;
      const spiralY = (spiralT - 0.5) * 6.5;

      const spiralPos = new THREE.Vector3(
        Math.cos(spiralAngle) * spiralRadius,
        spiralY,
        Math.sin(spiralAngle) * spiralRadius
      );
      const spiralRot = new THREE.Euler(
        0.1,
        -spiralAngle - Math.PI / 2,
        0.05
      );

      mesh.position.copy(ringsPos);
      mesh.rotation.copy(ringsRot);

      cardGroup.add(mesh);
      cardStates.push({
        mesh,
        node,
        ringsPos,
        ringsRot,
        spiralPos,
        spiralRot,
        baseScale: 1,
      });
    });

    // --- INTERACTION & PHYSICS ---
    let isDragging = false;
    let previousPointerX = 0;
    let previousPointerY = 0;
    let targetRotationY = 0;
    let targetRotationX = 0;
    let currentRotationY = 0;
    let currentRotationX = 0;
    let velX = 0;
    let velY = 0;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(-100, -100);

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
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

      const rect = container.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      if (isDragging) {
        const deltaX = clientX - previousPointerX;
        const deltaY = clientY - previousPointerY;
        velX = deltaX * 0.005;
        velY = deltaY * 0.003;
        targetRotationY += velX;
        targetRotationX += velY;
        previousPointerX = clientX;
        previousPointerY = clientY;
      }
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      targetRotationY -= e.deltaY * 0.0012;
      targetRotationX -= e.deltaX * 0.0008;
    };

    const domEl = renderer.domElement;
    domEl.addEventListener("mousedown", onPointerDown);
    window.addEventListener("mousemove", onPointerMove, { passive: true });
    window.addEventListener("mouseup", onPointerUp);
    domEl.addEventListener("wheel", onWheel, { passive: true });
    domEl.addEventListener("touchstart", onPointerDown, { passive: true });
    domEl.addEventListener("touchmove", onPointerMove, { passive: true });
    domEl.addEventListener("touchend", onPointerUp);

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", handleResize);

    // --- ANIMATION RENDER LOOP ---
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Inertia & auto-spin
      if (!isDragging) {
        targetRotationY += 0.0018; // gentle automatic orbit rotation
        velX *= 0.93;
        velY *= 0.93;
        targetRotationY += velX;
        targetRotationX += velY;
      }

      // Constrain vertical pitch
      targetRotationX = Math.max(-0.4, Math.min(0.4, targetRotationX));

      currentRotationY += (targetRotationY - currentRotationY) * 0.08;
      currentRotationX += (targetRotationX - currentRotationX) * 0.08;

      cardGroup.rotation.y = currentRotationY;
      cardGroup.rotation.x = currentRotationX;
      centerGroup.rotation.z = -elapsedTime * 0.3;
      centerGroup.rotation.y = elapsedTime * 0.15;

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

      // Morphing positions between Rings & Spiral
      const currentMode = modeRef.current;
      const lerpSpeed = 0.06;

      cardStates.forEach((state) => {
        const targetPos = currentMode === "spiral" ? state.spiralPos : state.ringsPos;
        const targetRot = currentMode === "spiral" ? state.spiralRot : state.ringsRot;

        state.mesh.position.lerp(targetPos, lerpSpeed);
        state.mesh.rotation.x += (targetRot.x - state.mesh.rotation.x) * lerpSpeed;
        state.mesh.rotation.y += (targetRot.y - state.mesh.rotation.y) * lerpSpeed;
        state.mesh.rotation.z += (targetRot.z - state.mesh.rotation.z) * lerpSpeed;

        // Hover scale & elevation
        const isHovered = currentHovered?.id === state.node.id;
        const targetScale = isHovered ? 1.15 : 1.0;
        state.mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.12);
      });

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      domEl.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
      domEl.removeEventListener("wheel", onWheel);
      domEl.removeEventListener("touchstart", onPointerDown);
      domEl.removeEventListener("touchmove", onPointerMove);
      domEl.removeEventListener("touchend", onPointerUp);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [isEn]);

  return (
    <div className="k95-stage-wrapper" ref={containerRef}>
      <div className="k95-stage-controls">
        <K95LayoutSwitch mode={layoutMode} onChange={handleLayoutChange} isEn={isEn} />
      </div>
      <ProjectLabelPill
        activeNode={hoveredNode}
        position={mousePos}
        visible={showPill}
        isEn={isEn}
      />
    </div>
  );
}

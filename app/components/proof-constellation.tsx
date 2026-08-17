"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { useLanguage } from "./i18n";

const orbitItems = [
  { className: "node-solana", label: "SOLANA", detailKey: "home.visualOrbitSolana", media: "solana", asset: "/brands/solana-wordmark.png", fit: "contain", lane: "outer", phase: 0 },
  { className: "node-vlu", label: "VLU", detailKey: "home.visualOrbitVlu", media: "vlu", asset: "/brands/vlu-wordmark.jpg", fit: "contain", lane: "outer", phase: Math.PI / 2 },
  { className: "node-hackfest", label: "UNIHACKFEST", detailKey: "home.visualOrbitHackfest", media: "hackfest", asset: "/brands/unihackfest-wordmark.png", fit: "contain", lane: "outer", phase: Math.PI },
  { className: "node-corelia", label: "CORELIA", detailKey: "home.visualOrbitCorelia", media: "corelia", asset: "/brands/corelia-academy.png", fit: "cover", lane: "outer", phase: Math.PI * 1.5 },
  { className: "node-usdc", label: "USDC", detailKey: "home.visualOrbitUsdc", media: "usdc", asset: "/brands/usdc-symbol.png", fit: "contain", lane: "inner", phase: Math.PI / 6 },
  { className: "node-phantom", label: "PHANTOM", detailKey: "home.visualOrbitPhantom", media: "phantom", asset: "/brands/phantom.svg", fit: "contain", lane: "inner", phase: Math.PI * 5 / 6 },
  { className: "node-solflare", label: "SOLFLARE", detailKey: "home.visualOrbitSolflare", media: "solflare", asset: "/brands/solflare.svg", fit: "contain", lane: "inner", phase: Math.PI * 3 / 2 },
] as const;

export function ProofConstellation() {
  const { t } = useLanguage();
  const sceneRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;
    let isVisible = true;
    let isDocumentVisible = document.visibilityState === "visible";
    let isPointerPaused = false;

    const getCenter = (width: number, height: number) => ({
      x: width * (width <= 820 ? 0.5 : width <= 1080 ? 0.61 : 0.66),
      y: height * 0.49,
    });

    const renderNodes = (now: number) => {
      const rect = scene.getBoundingClientRect();
      const center = getCenter(rect.width, rect.height);
      const seconds = now / 1000;

      orbitItems.forEach((item, index) => {
        const node = nodeRefs.current[index];
        if (!node) return;
        const isOuter = item.lane === "outer";
        const speed = isOuter ? (Math.PI * 2) / 48 : (Math.PI * 2) / 36;
        const angle = item.phase + seconds * speed;
        const radiusX = Math.min(rect.width * (isOuter ? 0.235 : 0.165), isOuter ? 540 : 380);
        const radiusY = Math.min(rect.height * (isOuter ? 0.31 : 0.22), isOuter ? 270 : 205);
        const depth = (Math.sin(angle) + 1) / 2;
        const x = Math.cos(angle) * radiusX;
        const y = Math.sin(angle) * radiusY;
        const scale = 0.78 + depth * 0.27;
        const opacity = 0.54 + depth * 0.46;
        const blur = (1 - depth) * 0.5;

        node.style.transform = `translate(-50%, -50%) translate3d(${x}px, ${y}px, 0) scale(${scale}) rotate(${Math.sin(angle) * 4}deg)`;
        node.style.opacity = `${opacity}`;
        node.style.filter = `blur(${blur}px)`;
        node.style.zIndex = String(10 + Math.round(depth * 20));
        node.style.left = `${center.x}px`;
        node.style.top = `${center.y}px`;
      });
    };

    const tick = (now: number) => {
      if (!isVisible || !isDocumentVisible || isPointerPaused) return;
      renderNodes(now);
      animationFrame = window.requestAnimationFrame(tick);
    };

    const start = () => {
      window.cancelAnimationFrame(animationFrame);
      if (reducedMotion.matches) {
        renderNodes(0);
        return;
      }
      if (!isVisible || !isDocumentVisible || isPointerPaused) return;
      animationFrame = window.requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      start();
    }, { threshold: 0.05 });
    observer.observe(scene);

    const handleVisibility = () => {
      isDocumentVisible = document.visibilityState === "visible";
      start();
    };
    const handlePointerEnter = () => {
      isPointerPaused = true;
      start();
    };
    const handlePointerLeave = () => {
      isPointerPaused = false;
      start();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    scene.addEventListener("pointerenter", handlePointerEnter);
    scene.addEventListener("pointerleave", handlePointerLeave);
    start();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      scene.removeEventListener("pointerenter", handlePointerEnter);
      scene.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, []);

  return (
    <div className="proof-constellation" ref={sceneRef} role="region" aria-label={t("home.visualProofAria")}>
      <div className="constellation-grid" aria-hidden="true" />
      <div className="constellation-orbit constellation-orbit-large" aria-hidden="true" />
      <div className="constellation-orbit constellation-orbit-small" aria-hidden="true" />
      <div className="constellation-crosshair" aria-hidden="true" />

      <div className="constellation-center" aria-label={t("home.visualCenterAria")}>
        <svg className="constellation-flower" viewBox="0 0 240 240" role="img" aria-label={t("home.visualCenterAria")}>
          <defs>
            <linearGradient id="proof-flower-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.46" stopColor="#b7b1ff" />
              <stop offset="1" stopColor="#1500e1" />
            </linearGradient>
          </defs>
          <g className="constellation-flower-spin" fill="url(#proof-flower-gradient)" opacity=".96">
            {Array.from({ length: 10 }, (_, index) => (
              <ellipse key={index} cx="120" cy="54" rx="18" ry="55" transform={`rotate(${index * 36} 120 120)`} />
            ))}
          </g>
          <circle cx="120" cy="120" r="29" fill="#0c0a0c" />
          <circle cx="120" cy="120" r="10" fill="#c7fb5b" />
        </svg>
        <span>{t("home.visualCenterLabel")}</span>
        <strong>SB</strong>
      </div>

      {orbitItems.map((item, index) => (
        <div className={`constellation-node ${item.className}`} key={item.label} ref={(node) => { nodeRefs.current[index] = node; }} aria-label={`${item.label} — ${t(item.detailKey)}`}>
          <div className={`constellation-node-media media-${item.media}`} aria-hidden="true">
            <Image src={item.asset} alt="" fill sizes="48px" className={`constellation-node-image image-${item.fit}`} />
          </div>
          <div>
            <strong>{item.label}</strong>
            <small>{t(item.detailKey)}</small>
          </div>
        </div>
      ))}

      <span className="constellation-coordinate coordinate-top" aria-hidden="true">10.8231° N</span>
      <span className="constellation-coordinate coordinate-bottom" aria-hidden="true">106.6297° E</span>
    </div>
  );
}

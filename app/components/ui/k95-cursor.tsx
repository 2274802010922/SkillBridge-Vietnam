"use client";

import { useEffect, useRef, useState } from "react";

export function K95Cursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only enable on fine pointer devices (desktop mouse)
    if (typeof window === "undefined" || !window.matchMedia("(pointer: fine)").matches) {
      return;
    }

    let mouseX = -100;
    let mouseY = -100;
    let currentX = -100;
    let currentY = -100;
    let animFrameId: number;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!isVisible) setIsVisible(true);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.closest("[data-hover]") ||
          target.closest("a") ||
          target.closest("button") ||
          target.closest(".k95-interactive") ||
          target.tagName === "A" ||
          target.tagName === "BUTTON")
      ) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    const renderLoop = () => {
      const ease = 0.18;
      currentX += (mouseX - currentX) * ease;
      currentY += (mouseY - currentY) * ease;

      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`;
      }
      animFrameId = requestAnimationFrame(renderLoop);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseover", handleMouseOver, { passive: true });
    document.addEventListener("mouseleave", handleMouseLeave);
    animFrameId = requestAnimationFrame(renderLoop);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animFrameId);
    };
  }, [isVisible]);

  return (
    <div
      ref={cursorRef}
      className={`k95-custom-cursor ${isHovering ? "is-hovering" : ""} ${isVisible ? "is-visible" : ""}`}
      aria-hidden="true"
    />
  );
}

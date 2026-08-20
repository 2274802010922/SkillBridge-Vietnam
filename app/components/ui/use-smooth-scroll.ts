"use client";

import { useEffect } from "react";
import type Lenis from "lenis";

export function useSmoothScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let lenisInstance: Lenis | null = null;
    let animId: number;
    let cancelled = false;

    const initLenis = async () => {
      try {
        const Lenis = (await import("lenis")).default;
        if (cancelled) return;
        const lenis = new Lenis({
          duration: 1.1,
          easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          smoothWheel: true,
          wheelMultiplier: 0.9,
          touchMultiplier: 1.5,
        });
        lenisInstance = lenis;

        function raf(time: number) {
          lenis.raf(time);
          animId = requestAnimationFrame(raf);
        }

        animId = requestAnimationFrame(raf);
      } catch (err) {
        console.warn("Lenis smooth scroll not initialized:", err);
      }
    };

    initLenis();

    return () => {
      cancelled = true;
      if (animId) cancelAnimationFrame(animId);
      if (lenisInstance) lenisInstance.destroy();
    };
  }, []);
}

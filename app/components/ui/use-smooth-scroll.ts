"use client";

import { useEffect } from "react";

export function useSmoothScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let lenisInstance: any = null;
    let animId: number;

    const initLenis = async () => {
      try {
        const Lenis = (await import("lenis")).default;
        lenisInstance = new Lenis({
          duration: 1.1,
          easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
          smoothWheel: true,
          wheelMultiplier: 0.9,
          touchMultiplier: 1.5,
        });

        function raf(time: number) {
          lenisInstance.raf(time);
          animId = requestAnimationFrame(raf);
        }

        animId = requestAnimationFrame(raf);
      } catch (err) {
        console.warn("Lenis smooth scroll not initialized:", err);
      }
    };

    initLenis();

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (lenisInstance) lenisInstance.destroy();
    };
  }, []);
}

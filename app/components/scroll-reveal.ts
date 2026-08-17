"use client";

import { useEffect, type RefObject } from "react";

type RevealRoot = RefObject<HTMLElement | null>;

/**
 * Progressive enhancement for landing-page motion. Content is visible by
 * default, then becomes animated only after the browser has mounted the
 * observer. This keeps the page readable for crawlers and no-JS clients.
 */
export function useScrollReveal(rootRef: RevealRoot) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const elements = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (!elements.length) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    elements.forEach((element) => {
      element.classList.add("landing-reveal-observed");
      element.style.setProperty("--reveal-delay", `${element.dataset.revealDelay ?? 0}ms`);
    });

    const revealAll = () => elements.forEach((element) => element.classList.add("landing-reveal-visible"));
    if (reducedMotion.matches || !("IntersectionObserver" in window)) {
      revealAll();
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const element = entry.target as HTMLElement;
        element.classList.add("landing-reveal-visible");
        observer.unobserve(element);
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });

    elements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, [rootRef]);
}

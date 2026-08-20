"use client";

import { useEffect, useState } from "react";

interface BootLoaderProps {
  onComplete?: () => void;
}

export function K95BootLoader({ onComplete }: BootLoaderProps) {
  const [count, setCount] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    // Check if user already visited or prefers reduced motion
    const hasBooted = sessionStorage.getItem("skillbridge_booted");
    if (hasBooted) {
      const completionTimer = window.setTimeout(() => {
        setIsDone(true);
        onComplete?.();
      }, 0);
      return () => window.clearTimeout(completionTimer);
    }

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 12) + 6;
      if (progress >= 100) {
        progress = 100;
        setCount(100);
        clearInterval(interval);
        setTimeout(() => {
          setIsFading(true);
          setTimeout(() => {
            setIsDone(true);
            sessionStorage.setItem("skillbridge_booted", "true");
            onComplete?.();
          }, 850);
        }, 250);
      } else {
        setCount(progress);
      }
    }, 45);

    return () => clearInterval(interval);
  }, [onComplete]);

  if (isDone) return null;

  return (
    <div className={`k95-boot-loader ${isFading ? "is-fading" : ""}`} aria-hidden="true">
      <div className="k95-boot-loader__stack">
        <div className="k95-boot-loader__layer k95-boot-loader__layer--center">
          <div className="k95-boot-loader__logo">SB</div>
        </div>
        <div className="k95-boot-loader__counter">[{count}%]</div>
      </div>
      <div className="k95-boot-loader__patch" />
    </div>
  );
}

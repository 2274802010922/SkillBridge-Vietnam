"use client";

import React from "react";

interface KineticTextProps {
  text: string;
  className?: string;
  staggerMs?: number;
}

export function KineticText({ text, className = "", staggerMs = 30 }: KineticTextProps) {
  const chars = Array.from(text);

  return (
    <span className={`k95-kinetic-text ${className}`}>
      {chars.map((char, i) => (
        <span
          key={i}
          className="k95-kinetic-char"
          style={{ "--i": i, "--stagger": `${i * staggerMs}ms` } as React.CSSProperties}
        >
          <span className="char-top">{char === " " ? "\u00A0" : char}</span>
          <span className="char-bot" aria-hidden="true">
            {char === " " ? "\u00A0" : char}
          </span>
        </span>
      ))}
    </span>
  );
}

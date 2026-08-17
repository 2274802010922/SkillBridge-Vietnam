"use client";

import React from "react";

export type LayoutMode = "rings" | "spiral";

interface LayoutSwitchProps {
  mode: LayoutMode;
  onChange: (mode: LayoutMode) => void;
  isEn?: boolean;
}

export function K95LayoutSwitch({ mode, onChange, isEn = false }: LayoutSwitchProps) {
  return (
    <div className={`k95-layout-switch ${mode === "spiral" ? "is-spiral" : "is-rings"}`} role="group" aria-label="3D View Mode">
      <span className="k95-layout-switch__pill" aria-hidden="true" />
      <button
        type="button"
        className={`k95-layout-switch__btn ${mode === "rings" ? "is-active" : ""}`}
        onClick={() => onChange("rings")}
        data-hover
      >
        <span>{isEn ? "Rings" : "Quỹ đạo"}</span>
      </button>
      <button
        type="button"
        className={`k95-layout-switch__btn ${mode === "spiral" ? "is-active" : ""}`}
        onClick={() => onChange("spiral")}
        data-hover
      >
        <span>{isEn ? "Spiral" : "Xoắn ốc"}</span>
      </button>
    </div>
  );
}

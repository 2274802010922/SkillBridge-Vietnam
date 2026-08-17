"use client";

import React from "react";
import type { OrbitNodeItem } from "./orbit-card-data";

interface ProjectLabelPillProps {
  activeNode: OrbitNodeItem | null;
  position: { x: number; y: number };
  visible: boolean;
  isEn?: boolean;
}

export function ProjectLabelPill({ activeNode, position, visible, isEn = false }: ProjectLabelPillProps) {
  if (!activeNode) {
    return (
      <div
        className="k95-label-layer"
        style={{
          transform: `translate3d(${position.x + 18}px, ${position.y + 18}px, 0)`,
          opacity: visible ? 1 : 0,
          visibility: visible ? "visible" : "hidden",
        }}
      >
        <div className="k95-label-pill k95-label-pill--cue visible">
          <span className="k95-label-cue">KÉO / CUỘN ĐỂ KHÁM PHÁ</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="k95-label-layer"
      style={{
        transform: `translate3d(${position.x + 18}px, ${position.y + 18}px, 0)`,
        opacity: visible ? 1 : 0,
        visibility: visible ? "visible" : "hidden",
      }}
    >
      <div className="k95-label-pill k95-label-pill--project visible">
        <svg className="k95-label-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="k95-label-text">
          <span className="k95-label-title">{activeNode.name}</span>
          <span className="k95-label-category">{isEn ? activeNode.categoryEn : activeNode.categoryVi}</span>
          <small className="k95-label-sub">{isEn ? activeNode.subtitleEn : activeNode.subtitleVi}</small>
        </div>
      </div>
    </div>
  );
}

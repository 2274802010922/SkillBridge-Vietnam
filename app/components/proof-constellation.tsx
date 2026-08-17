"use client";

import { useLanguage } from "./i18n";

const orbitItems = [
  { className: "node-solana", label: "SOLANA", detailKey: "home.visualOrbitSolana", media: "solana" },
  { className: "node-vlu", label: "VLU", detailKey: "home.visualOrbitVlu", media: "vlu" },
  { className: "node-hackfest", label: "UNIHACKFEST", detailKey: "home.visualOrbitHackfest", media: "hackfest" },
  { className: "node-evidence", label: "EVIDENCE", detailKey: "home.visualOrbitEvidence", media: "evidence" },
  { className: "node-credential", label: "CREDENTIAL", detailKey: "home.visualOrbitCredential", media: "credential" },
  { className: "node-usdc", label: "USDC", detailKey: "home.visualOrbitUsdc", media: "usdc" },
] as const;

export function ProofConstellation() {
  const { t } = useLanguage();

  return (
    <div className="proof-constellation" aria-label={t("home.visualProofAria")}>
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

      {orbitItems.map((item) => (
        <div className={`constellation-node ${item.className}`} key={item.label}>
          <div className={`constellation-node-media media-${item.media}`} aria-hidden="true">
            <span>{item.media === "solana" ? "≋" : item.media === "vlu" ? "V" : item.media === "hackfest" ? "01" : item.media === "evidence" ? "⌁" : item.media === "credential" ? "✓" : "$"}</span>
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

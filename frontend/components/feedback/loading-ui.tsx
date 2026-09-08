"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useLanguage } from "../../i18n/i18n";

export type SkeletonVariant =
  | "dashboard"
  | "list"
  | "detail"
  | "review"
  | "profile"
  | "finance";

function SkeletonLine({ width = "100%" }: { width?: string }) {
  return <span className="skeleton-block skeleton-line" style={{ width }} />;
}

function ListRows({ count = 3 }: { count?: number }) {
  return <div className="skeleton-list">{Array.from({ length: count }, (_, index) =>
    <div className="skeleton-row" key={index}>
      <span className="skeleton-block skeleton-icon" />
      <div><SkeletonLine width="72%" /><SkeletonLine width="46%" /></div>
      <span className="skeleton-block skeleton-action" />
    </div>
  )}</div>;
}

export function ContentSkeleton({
  variant = "list",
  delayed = false,
}: {
  variant?: SkeletonVariant;
  delayed?: boolean;
}) {
  const { locale } = useLanguage();
  const [visible, setVisible] = useState(!delayed);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!delayed) return;
    const showTimer = window.setTimeout(() => setVisible(true), 200);
    const slowTimer = window.setTimeout(() => setSlow(true), 5_000);
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(slowTimer);
    };
  }, [delayed]);

  return (
    <section
      aria-busy="true"
      aria-live="polite"
      className={`content-skeleton skeleton-${variant} ${visible ? "is-visible" : ""}`}
      role="status"
    >
      <span className="sr-only">
        {locale === "vi" ? "Đang tải nội dung." : "Loading content."}
      </span>
      <div aria-hidden="true" className="skeleton-canvas">
        <header className="skeleton-heading">
          <div><SkeletonLine width="112px" /><SkeletonLine width="min(480px, 82%)" /><SkeletonLine width="min(620px, 94%)" /></div>
          <span className="skeleton-block skeleton-metric" />
        </header>
        {variant === "dashboard" && <>
          <div className="skeleton-block skeleton-feature" />
          <div className="skeleton-steps">{Array.from({ length: 4 }, (_, index) => <span className="skeleton-block" key={index} />)}</div>
          <div className="skeleton-grid"><div className="skeleton-card"><ListRows count={2} /></div><div className="skeleton-card"><ListRows count={2} /></div></div>
        </>}
        {variant === "review" && <div className="skeleton-split skeleton-review">
          <div className="skeleton-card"><ListRows count={3} /></div>
          <div className="skeleton-card"><SkeletonLine width="38%" /><SkeletonLine /><SkeletonLine width="88%" /><div className="skeleton-score-grid">{Array.from({ length: 4 }, (_, index) => <span className="skeleton-block" key={index} />)}</div></div>
        </div>}
        {variant === "profile" && <>
          <div className="skeleton-card skeleton-profile-head"><span className="skeleton-block skeleton-avatar" /><div><SkeletonLine width="210px" /><SkeletonLine width="280px" /></div></div>
          <div className="skeleton-grid"><div className="skeleton-card"><ListRows count={2} /></div><div className="skeleton-card"><ListRows count={2} /></div></div>
        </>}
        {variant === "finance" && <>
          <div className="skeleton-steps">{Array.from({ length: 4 }, (_, index) => <span className="skeleton-block" key={index} />)}</div>
          <div className="skeleton-grid"><div className="skeleton-card"><ListRows count={3} /></div><div className="skeleton-card"><ListRows count={3} /></div></div>
        </>}
        {variant === "detail" && <div className="skeleton-split"><div className="skeleton-card"><SkeletonLine /><SkeletonLine /><SkeletonLine width="76%" /><ListRows count={3} /></div><div className="skeleton-card"><ListRows count={3} /></div></div>}
        {variant === "list" && <div className="skeleton-card"><div className="skeleton-toolbar"><SkeletonLine width="180px" /><span className="skeleton-block skeleton-action" /></div><ListRows count={4} /></div>}
      </div>
      {slow && <p className="loading-slow-note">
        {locale === "vi"
          ? "Việc tải đang lâu hơn dự kiến. Bạn vẫn có thể chờ hoặc thử tải lại trang."
          : "This is taking longer than expected. You can keep waiting or reload the page."}
      </p>}
    </section>
  );
}

function variantForPath(pathname: string): SkeletonVariant {
  if (pathname === "/app") return "dashboard";
  if (pathname.includes("/reviews")) return "review";
  if (pathname.includes("/profile") || pathname.includes("/passport")) return "profile";
  if (pathname.includes("/cashout") || pathname.includes("/payments") || pathname.includes("/payouts") || pathname.includes("/invoices") || pathname.includes("/escrow")) return "finance";
  if (/\/app\/challenges\/[^/]+/.test(pathname)) return "detail";
  return "list";
}

export function WorkspaceRouteSkeleton() {
  const pathname = usePathname();
  return <div id="workspace-main" tabIndex={-1}><ContentSkeleton delayed variant={variantForPath(pathname)} /></div>;
}

export function InlineLoading({ label }: { label: string }) {
  return <span aria-live="polite" className="inline-loading" role="status">
    <span aria-hidden="true" className="loading-spinner" />
    {label}
  </span>;
}

export function LoadFailure({ detail }: { detail?: string }) {
  const { locale } = useLanguage();
  return <section className="app-panel load-failure">
    <h2>{locale === "vi" ? "Chưa tải được dữ liệu" : "Data could not be loaded"}</h2>
    <p role="alert">{detail ?? (locale === "vi"
      ? "Kết nối có thể đang gián đoạn. Dữ liệu chưa tải không được tính là dữ liệu trống."
      : "The connection may be interrupted. Unloaded data is not treated as empty data.")}</p>
    <button className="button button-dark" onClick={() => window.location.reload()} type="button">
      {locale === "vi" ? "Thử lại" : "Try again"}
    </button>
  </section>;
}

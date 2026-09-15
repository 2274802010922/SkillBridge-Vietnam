import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({ title, kicker, children }: { title: string; kicker: string; children: ReactNode }) {
  return (
    <main className="legal-page">
      <header className="auth-header page-shell">
        <Link className="wordmark" href="/" aria-label="SkillBridge Vietnam">
          <span className="wordmark-mark" aria-hidden="true">S</span><span>SkillBridge</span><small>VIETNAM</small>
        </Link>
        <Link className="text-link" href="/auth">Kết nối ví →</Link>
      </header>
      <article className="legal-document page-shell">
        <div className="eyebrow"><span /> {kicker}</div>
        <h1>{title}</h1>
        <p className="legal-updated">Phiên bản pilot · cập nhật ngày 11/08/2026</p>
        {children}
      </article>
    </main>
  );
}

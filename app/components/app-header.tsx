"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LanguageSwitcher, useLanguage } from "./i18n";

const workspaceLinks = [
  ["overview", "/app", "nav.overview"],
  ["challenges", "/app/challenges", "nav.challenges"],
  ["submissions", "/app/submissions", "nav.submissions"],
  ["reviews", "/app/reviews", "nav.reviews"],
  ["opportunities", "/app/opportunities", "nav.opportunities"],
  ["passport", "/app/passport", "nav.passport"],
  ["invoices", "/app/invoices", "nav.invoices"],
  ["payouts", "/app/payouts", "nav.payouts"],
  ["talent", "/app/talent", "nav.talent"],
  ["contracts", "/app/contracts", "nav.contracts"],
  ["audit", "/app/audit", "nav.audit"],
] as const;

type WorkspaceId = (typeof workspaceLinks)[number][0];

function isCurrentWorkspacePath(pathname: string, href: string) {
  return href === "/app" ? pathname === href : pathname.startsWith(href);
}

export function AppHeader({ walletAddress }: { walletAddress: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);

  useEffect(() => {
    if (!workspaceMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setWorkspaceMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [workspaceMenuOpen]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return (
    <header className="app-topbar page-shell">
      <Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>SkillBridge</span><small>VIETNAM</small></Link>
      <div className="topbar-actions">
        <button
          aria-controls="mobile-workspace-navigation"
          aria-expanded={workspaceMenuOpen}
          aria-label={t("shell.workspace")}
          className="mobile-workspace-trigger"
          onClick={() => setWorkspaceMenuOpen((open) => !open)}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          <span>{t("shell.workspace")}</span>
        </button>
        <div className="wallet-pill"><span className="wallet-status-dot" /><span className="wallet-address">{walletAddress.slice(0, 5)}…{walletAddress.slice(-5)}</span><button onClick={logout}>{t("common.logout")}</button></div>
        <LanguageSwitcher />
      </div>
      {workspaceMenuOpen && <nav aria-label={t("shell.workspace")} className="mobile-workspace-navigation" id="mobile-workspace-navigation">
        {workspaceLinks.map(([id, href, key]) => {
          const current = isCurrentWorkspacePath(pathname, href);
          return <Link aria-current={current ? "page" : undefined} className={current ? "active" : ""} href={href} key={id} onClick={() => setWorkspaceMenuOpen(false)}>{t(key)}</Link>;
        })}
      </nav>}
    </header>
  );
}

export function AppSidebar({ active }: { active: WorkspaceId }) {
  const { t } = useLanguage();
  return (
    <aside className="app-sidebar">
      <span className="sidebar-label">{t("shell.workspace")}</span>
      {workspaceLinks.map(([id, href, key]) => <Link aria-current={active === id ? "page" : undefined} className={active === id ? "active" : ""} href={href} key={id}>{t(key)}</Link>)}
      <div className="sidebar-foot"><span>{t("shell.network")}</span><strong>{t("shell.devnet")}</strong></div>
    </aside>
  );
}

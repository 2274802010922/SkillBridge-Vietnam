"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LanguageSwitcher, useLanguage } from "./i18n";

export function AppHeader({ walletAddress }: { walletAddress: string }) {
  const router = useRouter();
  const { t } = useLanguage();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return (
    <header className="app-topbar page-shell">
      <Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>SkillBridge</span><small>VIETNAM</small></Link>
      <div className="topbar-actions">
        <LanguageSwitcher />
        <div className="wallet-pill"><span className="wallet-status-dot" />{walletAddress.slice(0, 5)}…{walletAddress.slice(-5)}<button onClick={logout}>{t("common.logout")}</button></div>
      </div>
    </header>
  );
}

export function AppSidebar({ active }: { active: "overview" | "challenges" | "submissions" | "reviews" | "opportunities" | "passport" | "audit" }) {
  const { t } = useLanguage();
  const links = [
    ["overview", "/app", "nav.overview"],
    ["challenges", "/app/challenges", "nav.challenges"],
    ["submissions", "/app/submissions", "nav.submissions"],
    ["reviews", "/app/reviews", "nav.reviews"],
    ["opportunities", "/app/opportunities", "nav.opportunities"],
    ["passport", "/app/passport", "nav.passport"],
    ["audit", "/app/audit", "nav.audit"],
  ] as const;
  return (
    <aside className="app-sidebar">
      <span className="sidebar-label">{t("shell.workspace")}</span>
      {links.map(([id, href, key]) => <Link className={active === id ? "active" : ""} href={href} key={id}>{t(key)}</Link>)}
      <div className="sidebar-foot"><span>{t("shell.network")}</span><strong>{t("shell.devnet")}</strong></div>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LanguageSwitcher, useLanguage, type MessageKey } from "./i18n";

export type WorkspaceId = "overview" | "challenges" | "submissions" | "reviews" | "opportunities" | "passport" | "invoices" | "payouts" | "talent" | "contracts" | "audit" | "payments" | "cashout";
type Membership = { role: string; organization_kind: string };
export type WorkspaceRole = "student" | "business" | "university";
type NavItem = [WorkspaceId, string, MessageKey];

const primaryNavigation: Record<WorkspaceRole, NavItem[]> = {
  student: [["overview", "/app", "nav.overview"], ["challenges", "/app/challenges", "nav.challenges"], ["submissions", "/app/submissions", "nav.submissions"], ["passport", "/app/passport", "nav.passport"], ["cashout", "/app/cashout", "nav.cashout"]],
  business: [["overview", "/app", "nav.overview"], ["challenges", "/app/challenges", "nav.challenges"], ["reviews", "/app/reviews", "nav.reviews"], ["payouts", "/app/payouts", "nav.payouts"], ["talent", "/app/talent", "nav.talent"], ["contracts", "/app/contracts", "nav.contracts"]],
  university: [["overview", "/app", "nav.overview"], ["reviews", "/app/reviews", "nav.reviews"], ["submissions", "/app/submissions", "nav.submissions"], ["passport", "/app/passport", "nav.passport"], ["audit", "/app/audit", "nav.audit"]],
};

const allNavigation: NavItem[] = [["overview", "/app", "nav.overview"], ["challenges", "/app/challenges", "nav.challenges"], ["submissions", "/app/submissions", "nav.submissions"], ["reviews", "/app/reviews", "nav.reviews"], ["opportunities", "/app/opportunities", "nav.opportunities"], ["passport", "/app/passport", "nav.passport"], ["invoices", "/app/invoices", "nav.invoices"], ["payouts", "/app/payouts", "nav.payouts"], ["talent", "/app/talent", "nav.talent"], ["contracts", "/app/contracts", "nav.contracts"], ["payments", "/app/payments", "nav.payments"], ["cashout", "/app/cashout", "nav.cashout"], ["audit", "/app/audit", "nav.audit"]];
const roleOrder: WorkspaceRole[] = ["student", "business", "university"];
const roleLabels: Record<WorkspaceRole, MessageKey> = { student: "role.student", business: "role.business", university: "role.university" };

function inferRoles(memberships: Membership[]): WorkspaceRole[] {
  const roles = new Set<WorkspaceRole>(["student"]);
  if (memberships.some((item) => item.organization_kind === "business" && ["business_admin", "challenge_manager", "reviewer", "credential_issuer"].includes(item.role))) roles.add("business");
  if (memberships.some((item) => item.organization_kind === "university" && ["university_admin", "reviewer", "credential_issuer"].includes(item.role))) roles.add("university");
  return roleOrder.filter((role) => roles.has(role));
}

function isCurrentWorkspacePath(pathname: string, href: string) { return href === "/app" ? pathname === href : pathname.startsWith(href); }

function useWorkspaceNavigation() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [role, setRoleState] = useState<WorkspaceRole>(() => {
    if (typeof window === "undefined") return "student";
    const stored = window.localStorage.getItem("skillbridge-role") as WorkspaceRole | null;
    return stored && roleOrder.includes(stored) ? stored : "student";
  });
  useEffect(() => {
    let active = true;
    const stored = window.localStorage.getItem("skillbridge-role") as WorkspaceRole | null;
    fetch("/api/organizations", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<{ organizations: Membership[] }> : { organizations: [] }).then((data) => {
      if (!active) return;
      setMemberships(data.organizations ?? []);
      const available = inferRoles(data.organizations ?? []);
      if (!available.includes(stored ?? "student")) setRoleState(available[0] ?? "student");
    }).catch(() => { /* Keep the student navigation available during a slow/offline request. */ });
    const onRoleChange = (event: Event) => { const next = (event as CustomEvent<WorkspaceRole>).detail; if (roleOrder.includes(next)) setRoleState(next); };
    window.addEventListener("skillbridge-role-change", onRoleChange);
    return () => { active = false; window.removeEventListener("skillbridge-role-change", onRoleChange); };
  }, []);
  const roles = useMemo(() => inferRoles(memberships), [memberships]);
  function setRole(next: WorkspaceRole) { setRoleState(next); window.localStorage.setItem("skillbridge-role", next); window.dispatchEvent(new CustomEvent<WorkspaceRole>("skillbridge-role-change", { detail: next })); }
  return { role, roles, setRole };
}

function RoleSwitcher({ role, roles, setRole }: { role: WorkspaceRole; roles: WorkspaceRole[]; setRole: (role: WorkspaceRole) => void }) {
  const { t } = useLanguage();
  if (roles.length <= 1) return <span className="role-context-badge">{t(roleLabels[role])}</span>;
  return (
    <label className="role-switcher">
      <span className="role-switcher-label">{t("shell.viewAs")}</span>
      <select aria-label={t("shell.viewAs")} value={role} onChange={(event) => setRole(event.target.value as WorkspaceRole)}>
        {roles.map((item) => <option value={item} key={item}>{t(roleLabels[item])}</option>)}
      </select>
    </label>
  );
}

function NavigationLinks({ items, active, t, onNavigate }: { items: NavItem[]; active: WorkspaceId; t: (key: MessageKey) => string; onNavigate?: () => void }) {
  return <>{items.map(([id, href, key]) => <Link aria-current={active === id ? "page" : undefined} className={active === id ? "active" : ""} href={href} key={id} onClick={onNavigate}>{t(key)}</Link>)}</>;
}

type WalletAssets = { assets: Array<{ symbol: string; display: string }>; explorerUrl: string };

function WalletSummary({ walletAddress, onLogout }: { walletAddress: string; onLogout: () => void }) {
  const { t, locale } = useLanguage();
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<WalletAssets | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open || assets) return;
    let active = true;
    fetch("/api/wallet/assets", { cache: "no-store" }).then(async (response) => {
      const data = await response.json() as WalletAssets & { error?: string };
      if (!response.ok) throw new Error(data.error || "Không thể đọc số dư ví.");
      return data;
    }).then((data) => { if (active) setAssets(data); }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Không thể đọc số dư ví."); });
    return () => { active = false; };
  }, [assets, open]);
  return <div className="wallet-summary"><button type="button" className="wallet-pill wallet-summary-trigger" aria-expanded={open} onClick={() => setOpen((value) => !value)}><span className="wallet-status-dot" /><span className="wallet-address">{walletAddress.slice(0, 5)}…{walletAddress.slice(-5)}</span><span aria-hidden="true">⌄</span></button>{open && <div className="wallet-summary-menu"><div><span>{locale === "vi" ? "VÍ ĐANG KẾT NỐI" : "CONNECTED WALLET"}</span><strong>{walletAddress.slice(0, 10)}…{walletAddress.slice(-8)}</strong></div><p>{locale === "vi" ? "Số dư trên Solana Devnet" : "Balances on Solana Devnet"}</p>{assets ? <dl>{assets.assets.map((asset) => <div key={asset.symbol}><dt>{asset.symbol}</dt><dd>{asset.display}</dd></div>)}</dl> : <p className="wallet-summary-loading">{error || t("common.loading")}</p>}{assets && <a className="chain-proof-link" target="_blank" rel="noreferrer" href={assets.explorerUrl}>{locale === "vi" ? "Mở Solana Explorer" : "Open Solana Explorer"}</a>}<button type="button" className="wallet-summary-logout" onClick={onLogout}>{t("common.logout")}</button></div>}</div>;
}

export function AppHeader({ walletAddress }: { walletAddress: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
  const { role, roles, setRole } = useWorkspaceNavigation();
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const primary = primaryNavigation[role];
  const secondary = allNavigation.filter(([id]) => !primary.some(([primaryId]) => primaryId === id));

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
        <RoleSwitcher role={role} roles={roles} setRole={setRole} />
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
        <WalletSummary walletAddress={walletAddress} onLogout={() => void logout()} />
        <LanguageSwitcher />
      </div>
      {workspaceMenuOpen && <nav aria-label={t("shell.workspace")} className="mobile-workspace-navigation" id="mobile-workspace-navigation">
        <div className="mobile-nav-heading"><span>{t("shell.primaryActions")}</span><strong>{t(roleLabels[role])}</strong></div>
        <NavigationLinks active={allNavigation.find(([, href]) => isCurrentWorkspacePath(pathname, href))?.[0] ?? "overview"} items={primary} t={t} onNavigate={() => setWorkspaceMenuOpen(false)} />
        <details className="mobile-nav-advanced"><summary>{t("shell.advancedTools")}</summary><NavigationLinks active={allNavigation.find(([, href]) => isCurrentWorkspacePath(pathname, href))?.[0] ?? "overview"} items={secondary} t={t} onNavigate={() => setWorkspaceMenuOpen(false)} /></details>
      </nav>}
    </header>
  );
}

export function AppSidebar({ active }: { active: WorkspaceId }) {
  const { t } = useLanguage();
  const { role } = useWorkspaceNavigation();
  const primary = primaryNavigation[role];
  const secondary = allNavigation.filter(([id]) => !primary.some(([primaryId]) => primaryId === id));
  return (
    <aside className="app-sidebar">
      <div className="sidebar-context"><span className="sidebar-label">{t("shell.workspace")}</span><strong>{t(roleLabels[role])}</strong></div>
      <span className="sidebar-section-label">{t("shell.primaryActions")}</span>
      <NavigationLinks active={active} items={primary} t={t} />
      <details className="sidebar-advanced"><summary>{t("shell.advancedTools")}</summary><NavigationLinks active={active} items={secondary} t={t} /></details>
      <div className="sidebar-foot"><span>{t("shell.network")}</span><strong>{t("shell.devnet")}</strong><small>{t("shell.devnetHint")}</small></div>
    </aside>
  );
}

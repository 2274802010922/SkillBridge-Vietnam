"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LanguageSwitcher, useLanguage, type MessageKey } from "../../i18n/i18n";
import { ProfileAvatar } from '../../features/profile/wallet-profile-view';
import { InlineLoading } from "../feedback/loading-ui";
import { getWallets } from "@wallet-standard/app";
import { endWalletSession } from "../wallet/wallet-session";

export type WorkspaceId = "overview" | "challenges" | "submissions" | "reviews" | "opportunities" | "passport" | "invoices" | "payouts" | "talent" | "contracts" | "audit" | "payments" | "cashout" | "profile" | "escrow";
type Membership = { role: string; organization_kind: string };
export type WorkspaceRole = "student" | "business" | "university";
type NavItem = [WorkspaceId, string, MessageKey];

const primaryNavigation: Record<WorkspaceRole, NavItem[]> = {
  student: [["overview", "/app", "nav.overview"], ["challenges", "/app/challenges", "nav.challenges"], ["submissions", "/app/submissions", "nav.submissions"], ["passport", "/app/passport", "nav.passport"], ["cashout", "/app/cashout", "nav.cashout"]],
  business: [["overview", "/app", "nav.overview"], ["challenges", "/app/challenges", "nav.challenges"], ["reviews", "/app/reviews", "nav.reviews"], ["payouts", "/app/payouts", "nav.payouts"], ["talent", "/app/talent", "nav.talent"], ["contracts", "/app/contracts", "nav.contracts"]],
  university: [["overview", "/app", "nav.overview"], ["reviews", "/app/reviews", "nav.reviews"], ["submissions", "/app/submissions", "nav.submissions"], ["passport", "/app/passport", "nav.passport"], ["audit", "/app/audit", "nav.audit"]],
};

const allNavigation: NavItem[] = [["escrow", "/app/escrow", "nav.escrow"],["profile", "/app/profile", "nav.profile"],["overview", "/app", "nav.overview"], ["challenges", "/app/challenges", "nav.challenges"], ["submissions", "/app/submissions", "nav.submissions"], ["reviews", "/app/reviews", "nav.reviews"], ["opportunities", "/app/opportunities", "nav.opportunities"], ["passport", "/app/passport", "nav.passport"], ["invoices", "/app/invoices", "nav.invoices"], ["payouts", "/app/payouts", "nav.payouts"], ["talent", "/app/talent", "nav.talent"], ["contracts", "/app/contracts", "nav.contracts"], ["payments", "/app/payments", "nav.payments"], ["cashout", "/app/cashout", "nav.cashout"], ["audit", "/app/audit", "nav.audit"]];
const roleOrder: WorkspaceRole[] = ["student", "business", "university"];
const roleLabels: Record<WorkspaceRole, MessageKey> = { student: "role.student", business: "role.business", university: "role.university" };

function inferRoles(memberships: Membership[]): WorkspaceRole[] {
  const roles = new Set<WorkspaceRole>(["student"]);
  if (memberships.some((item) => item.organization_kind === "business" && ["business_admin", "challenge_manager", "reviewer", "credential_issuer"].includes(item.role))) roles.add("business");
  if (memberships.some((item) => item.organization_kind === "university" && ["university_admin", "reviewer", "credential_issuer"].includes(item.role))) roles.add("university");
  return roleOrder.filter((role) => roles.has(role));
}

function isCurrentWorkspacePath(pathname: string, href: string) { return href === "/app" ? pathname === href : pathname.startsWith(href); }

export function useWorkspaceNavigation() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [role, setRoleState] = useState<WorkspaceRole>("student");
  useEffect(() => {
    let active = true;
    const stored = window.localStorage.getItem("skillbridge-role") as WorkspaceRole | null;
    fetch("/api/organizations", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<{ organizations: Membership[] }> : { organizations: [] }).then((data) => {
      if (!active) return;
      setMemberships(data.organizations ?? []);
      const available = inferRoles(data.organizations ?? []);
      setRoleState(stored && available.includes(stored) ? stored : available[0] ?? "student");
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
  return <>{items.map(([id, href, key]) => <Link aria-current={active === id ? "page" : undefined} className={active === id ? "active" : ""} href={href} key={id} onClick={onNavigate}><span className="nav-item-marker" aria-hidden="true" />{t(key)}</Link>)}</>;
}

type WalletAssets = { assets: Array<{ symbol: string; display: string }>; explorerUrl: string };

function WalletSummary({ walletAddress, onLogout }: { walletAddress: string; onLogout: () => Promise<void> }) {
  const { t, locale } = useLanguage();
  const [open, setOpen] = useState(false);
  const walletContainer = useRef<HTMLDivElement>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!walletContainer.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        walletContainer.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const [identity, setIdentity] = useState<{displayName:string;avatar:string}|null>(null);
  useEffect(() => {
    let active = true;
    const load = () => fetch("/api/profile", { cache: "no-store" }).then(r => r.ok ? r.json() as Promise<{profile:{displayName:string;avatar:string}}> : null).then(d => { if(active) setIdentity(d?.profile || null); }).catch(() => {});
    void load();
    window.addEventListener("skillbridge-profile-change", load);
    return () => { active=false; window.removeEventListener("skillbridge-profile-change", load); };
  }, [walletAddress]);
  const [assets, setAssets] = useState<WalletAssets | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  useEffect(() => {
    if (!open) return;
    let active = true;
    fetch("/api/wallet/assets", { cache: "no-store" }).then(async (response) => {
      const data = await response.json() as WalletAssets & { error?: string };
      if (!response.ok) throw new Error(data.error || "Không thể đọc số dư ví.");
      return data;
    }).then((data) => { if (active) { setAssets(data); setUpdatedAt(new Date()); } }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Không thể đọc số dư ví."); }).finally(() => { if (active) setRefreshing(false); });
    return () => { active = false; };
  }, [open, refresh]);
  const [disconnecting,setDisconnecting]=useState(false);
  const [disconnectError,setDisconnectError]=useState(false);
  async function disconnect(){if(disconnecting)return;setDisconnecting(true);setDisconnectError(false);try{await onLogout();}catch{setDisconnectError(true);}finally{setDisconnecting(false);}}
  const loadingAssets = !assets && !error;
  return <div className="wallet-summary" ref={walletContainer}><button type="button" className="wallet-pill wallet-summary-trigger" aria-label={(locale === "vi" ? "Tài khoản: " : "Account: ") + (identity?.displayName || walletAddress)} aria-expanded={open} onClick={() => setOpen((value) => !value)}><ProfileAvatar avatar={identity?.avatar || ""} name={identity?.displayName || walletAddress}/><span className="wallet-status-dot" /><span className="wallet-profile-name">{identity?.displayName || walletAddress.slice(0, 5)}</span><span className="wallet-address">{walletAddress.slice(0, 5)}…{walletAddress.slice(-5)}</span><span aria-hidden="true">⌄</span></button>{open && <div className="wallet-summary-menu"><div><span>{locale === "vi" ? "VÍ ĐANG KẾT NỐI" : "CONNECTED WALLET"}</span><strong>{walletAddress.slice(0, 10)}…{walletAddress.slice(-8)}</strong></div><div className="wallet-menu-actions"><Link className="profile-menu-link" href="/app/profile">{locale === "vi" ? "Hồ sơ của tôi" : "My profile"}</Link><button aria-busy={refreshing || loadingAssets} className="wallet-refresh" disabled={refreshing || loadingAssets} type="button" onClick={() => { setError(null); setRefreshing(true); setRefresh(value => value + 1); }}>{refreshing ? (locale === "vi" ? "Đang làm mới…" : "Refreshing…") : (locale === "vi" ? "Làm mới số dư" : "Refresh balances")}</button></div><p>{locale === "vi" ? "Số dư trên Solana Devnet" : "Balances on Solana Devnet"}</p>{assets ? <dl aria-busy={refreshing}>{assets.assets.map((asset) => <div key={asset.symbol}><dt>{asset.symbol}</dt><dd>{asset.display}</dd></div>)}</dl> : error ? <p className="wallet-summary-loading" role="alert">{error}</p> : <InlineLoading label={t("common.loading")} />}{updatedAt && <small>{locale === "vi" ? "Cập nhật lúc" : "Updated at"} {updatedAt.toLocaleTimeString(locale === "vi" ? "vi-VN" : "en-US", { hour: "2-digit", minute: "2-digit" })}</small>}{assets && <a className="chain-proof-link" target="_blank" rel="noreferrer" href={assets.explorerUrl}>{locale === "vi" ? "Mở Solana Explorer" : "Open Solana Explorer"}</a>}{disconnectError&&<p role="alert">{t("wallet.disconnectError")}</p>}<button type="button" className="wallet-summary-logout" disabled={disconnecting} aria-busy={disconnecting} onClick={()=>void disconnect()}>{t(disconnecting?"wallet.disconnecting":"common.logout")}</button></div>}</div>;
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
    await endWalletSession(walletAddress,()=>fetch("/api/auth/logout", { method: "POST",signal:AbortSignal.timeout(10000) }),()=>getWallets().get());
    router.push("/");
    router.refresh();
  }
  return (
    <header className="app-topbar page-shell">
      <a className="workspace-skip-link" href="#workspace-main">{t("home.skipContent")}</a>
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
        <WalletSummary walletAddress={walletAddress} onLogout={logout} />
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

export function AppSidebar({ active }: { active?: WorkspaceId }) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const { role } = useWorkspaceNavigation();
  const current = active ?? allNavigation.find(([, href]) => isCurrentWorkspacePath(pathname, href))?.[0] ?? "overview";
  const primary = primaryNavigation[role];
  const secondary = allNavigation.filter(([id]) => !primary.some(([primaryId]) => primaryId === id));
  return (
    <aside className="app-sidebar">
      <div className="sidebar-context"><span className="sidebar-label">{t("shell.workspace")}</span><strong>{t(roleLabels[role])}</strong></div>
      <span className="sidebar-section-label">{t("shell.primaryActions")}</span>
      <NavigationLinks active={current} items={primary} t={t} />
      <details className="sidebar-advanced" key={`${role}-${current}`} open={secondary.some(([id]) => id === current) || undefined}><summary>{t("shell.advancedTools")}</summary><NavigationLinks active={current} items={secondary} t={t} /></details>
      <div className="sidebar-foot"><span>{t("shell.network")}</span><strong>{t("shell.devnet")}</strong><small>{t("shell.devnetHint")}</small></div>
    </aside>
  );
}

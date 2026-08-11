"use client";

import Link from "next/link";

export function AppHeader({ walletAddress }: { walletAddress: string }) {
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); window.location.assign("/"); }
  return <header className="app-topbar page-shell"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>SkillBridge</span><small>VIETNAM</small></Link><div className="wallet-pill"><span className="wallet-status-dot" />{walletAddress.slice(0, 5)}…{walletAddress.slice(-5)}<button onClick={logout}>Đăng xuất</button></div></header>;
}

export function AppSidebar({ active }: { active: "overview" | "challenges" | "submissions" | "reviews" | "opportunities" | "passport" | "audit" }) {
  const links = [["overview", "/app", "Tổng quan"], ["challenges", "/app/challenges", "Challenges"], ["submissions", "/app/submissions", "Bài nộp"], ["reviews", "/app/reviews", "Đánh giá"], ["opportunities", "/app/opportunities", "Cơ hội"], ["passport", "/app/passport", "Skill Passport"], ["audit", "/app/audit", "Audit"]] as const;
  return <aside className="app-sidebar"><span className="sidebar-label">WORKSPACE</span>{links.map(([id, href, label]) => <Link className={active === id ? "active" : ""} href={href} key={id}>{label}</Link>)}<div className="sidebar-foot"><span>NETWORK</span><strong>Solana Devnet</strong></div></aside>;
}

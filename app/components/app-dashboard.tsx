"use client";

import { useState } from "react";
import Link from "next/link";

type Membership = {
  id: string;
  role: string;
  organization_id: string;
  organization_name: string;
  organization_kind: string;
  verification_status: string;
};

type DashboardUser = { id: string; walletAddress: string; displayName: string | null; profileKind: string };

function shortWallet(address: string) { return `${address.slice(0, 5)}…${address.slice(-5)}`; }

export function AppDashboard({ initialUser, initialMemberships }: { initialUser: DashboardUser; initialMemberships: Membership[] }) {
  const [user, setUser] = useState(initialUser);
  const [memberships, setMemberships] = useState(initialMemberships);
  const [name, setName] = useState(initialUser.displayName ?? "");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationKind, setOrganizationKind] = useState<"business" | "university">("business");
  const adminMemberships = memberships.filter((item) => item.role === "business_admin" || item.role === "university_admin");
  const [inviteOrganizationId, setInviteOrganizationId] = useState(adminMemberships[0]?.organization_id ?? "");
  const [inviteRole, setInviteRole] = useState("challenge_manager");
  const [targetWallet, setTargetWallet] = useState("");
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveProfile() {
    setBusy(true); setNotice(null);
    const response = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: name, profileKind: "student" }) });
    const data = await response.json() as { user?: DashboardUser; error?: string };
    if (response.ok && data.user) { setUser(data.user); setNotice("Đã lưu hồ sơ."); } else setNotice(data.error ?? "Không thể lưu hồ sơ.");
    setBusy(false);
  }

  async function createOrganization() {
    setBusy(true); setNotice(null);
    const response = await fetch("/api/organizations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: organizationName, kind: organizationKind }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) { setNotice(data.error ?? "Không thể tạo tổ chức."); setBusy(false); return; }
    const refreshed = await fetch("/api/organizations", { cache: "no-store" }).then((item) => item.json()) as { organizations: Membership[] };
    setMemberships(refreshed.organizations);
    const createdAdmin = refreshed.organizations.find((item) => item.role.endsWith("_admin"));
    if (createdAdmin) setInviteOrganizationId(createdAdmin.organization_id);
    setOrganizationName(""); setNotice("Đã tạo tổ chức và gán quyền quản trị."); setBusy(false);
  }

  async function createInvitation() {
    setBusy(true); setNotice(null); setJoinUrl(null);
    const response = await fetch("/api/invitations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId: inviteOrganizationId, role: inviteRole, targetWallet: targetWallet || undefined }) });
    const data = await response.json() as { invitation?: { joinUrl: string }; error?: string };
    if (response.ok && data.invitation) { setJoinUrl(data.invitation.joinUrl); setNotice("Đã tạo link mời có thời hạn 7 ngày."); }
    else setNotice(data.error ?? "Không thể tạo lời mời.");
    setBusy(false);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/");
  }

  return (
    <main className="product-app">
      <header className="app-topbar page-shell">
        <Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>SkillBridge</span><small>VIETNAM</small></Link>
        <div className="wallet-pill"><span className="wallet-status-dot" />{shortWallet(user.walletAddress)}<button onClick={logout}>Đăng xuất</button></div>
      </header>
      <div className="app-layout page-shell">
        <aside className="app-sidebar">
          <span className="sidebar-label">WORKSPACE</span>
          <a className="active" href="/app">Tổng quan</a><a href="/app/challenges">Challenges</a><a href="/app/submissions">Bài nộp</a><a href="/app/reviews">Đánh giá</a><a href="/app/opportunities">Cơ hội</a><a href="/app/passport">Skill Passport</a>
          <div className="sidebar-foot"><span>NETWORK</span><strong>Solana Devnet</strong></div>
        </aside>
        <section className="app-content">
          <div className="app-welcome"><div><span>WELCOME BACK</span><h1>{user.displayName || "Hoàn thiện danh tính của bạn"}</h1><p>Vai trò và quyền hạn được lấy từ server, không còn role switcher ở sản phẩm thật.</p></div><div className="identity-card"><small>PRIMARY WALLET</small><code>{user.walletAddress}</code><b>✓ Signature verified</b></div></div>
          {!user.displayName && <section className="app-panel onboarding-panel"><div><span>STEP 1</span><h2>Tạo hồ sơ người dùng</h2><p>Tên này xuất hiện trong challenge và quy trình review; địa chỉ ví vẫn là danh tính đăng nhập.</p></div><div className="inline-form"><input aria-label="Tên hiển thị" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Nguyễn Minh Anh" /><button className="button button-primary" disabled={busy} onClick={saveProfile}>Lưu hồ sơ</button></div></section>}
          <div className="dashboard-grid">
            <section className="app-panel"><span className="panel-kicker">ORGANIZATIONS</span><h2>Tổ chức của bạn</h2>{memberships.length ? <div className="membership-list">{memberships.map((item) => <article key={item.id}><div><strong>{item.organization_name}</strong><small>{item.organization_kind} · {item.verification_status}</small></div><b>{item.role.replaceAll("_", " ")}</b></article>)}</div> : <p>Ví này chưa thuộc doanh nghiệp hoặc nhà trường nào. Bạn vẫn có thể sử dụng role Sinh viên.</p>}</section>
            <section className="app-panel"><span className="panel-kicker">CREATE ORGANIZATION</span><h2>Tạo workspace thật</h2><div className="stack-form"><input aria-label="Tên tổ chức" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder="Tên doanh nghiệp hoặc trường" /><select value={organizationKind} onChange={(event) => setOrganizationKind(event.target.value as "business" | "university")}><option value="business">Doanh nghiệp</option><option value="university">Nhà trường</option></select><button className="button button-dark" disabled={busy} onClick={createOrganization}>Tạo tổ chức</button></div></section>
          </div>
          {adminMemberships.length > 0 && <section className="app-panel invitation-panel"><div><span className="panel-kicker">SECURE INVITATION</span><h2>Mời thành viên bằng role cụ thể</h2><p>Role được ghi vào database sau khi ví đích nhận lời mời. Bỏ trống ví đích để tạo link dùng một lần.</p></div><div className="stack-form"><select aria-label="Tổ chức gửi lời mời" value={inviteOrganizationId} onChange={(event) => { const id = event.target.value; setInviteOrganizationId(id); const organization = adminMemberships.find((item) => item.organization_id === id); setInviteRole(organization?.organization_kind === "university" ? "reviewer" : "challenge_manager"); }}><option value="">Chọn tổ chức</option>{adminMemberships.map((item) => <option value={item.organization_id} key={item.id}>{item.organization_name}</option>)}</select><select aria-label="Role được mời" value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>{adminMemberships.find((item) => item.organization_id === inviteOrganizationId)?.organization_kind === "university" ? <><option value="reviewer">Reviewer</option><option value="credential_issuer">Credential issuer</option><option value="university_admin">University admin</option></> : <><option value="challenge_manager">Challenge manager</option><option value="business_admin">Business admin</option></>}</select><input aria-label="Ví đích tùy chọn" value={targetWallet} onChange={(event) => setTargetWallet(event.target.value)} placeholder="Ví đích (không bắt buộc)" /><button className="button button-dark" disabled={busy || !inviteOrganizationId} onClick={createInvitation}>Tạo link mời</button>{joinUrl && <div className="join-url"><code>{joinUrl}</code><button onClick={() => navigator.clipboard.writeText(joinUrl)}>Sao chép</button></div>}</div></section>}
          {notice && <p className="app-notice" role="status">{notice}</p>}
          <section className="app-panel next-build"><span className="panel-kicker">PRODUCT STATUS</span><h2>End-to-end workflow active</h2><p>Challenge, evidence, AI + human review, credential Devnet, opportunity gate và audit trail đã nằm trong cùng workspace.</p></section>
        </section>
      </div>
    </main>
  );
}

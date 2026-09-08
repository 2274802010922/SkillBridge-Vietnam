"use client";

import { useState } from "react";
import Link from "next/link";
import { useWorkspaceNavigation } from "../../components/layout/app-header";
import { translateStatus, useLanguage, type MessageKey } from "../../i18n/i18n";

type Membership = {
  id: string;
  role: string;
  organization_id: string;
  organization_name: string;
  organization_kind: string;
  verification_status: string;
};

type DashboardUser = { id: string; walletAddress: string; displayName: string | null; profileKind: string };

export function AppDashboard({ initialUser, initialMemberships }: { initialUser: DashboardUser; initialMemberships: Membership[] }) {
  const { t } = useLanguage();
  const { role } = useWorkspaceNavigation();
  const [user, setUser] = useState(initialUser);
  const [memberships, setMemberships] = useState(initialMemberships);
  const [name, setName] = useState(initialUser.displayName ?? "");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationKind, setOrganizationKind] = useState<"business" | "university">("business");
  const adminMemberships = memberships.filter((item) => item.role === "business_admin" || item.role === "university_admin");
  const isBusiness = memberships.some((item) => item.organization_kind === "business" && ["business_admin", "challenge_manager", "reviewer", "credential_issuer"].includes(item.role));
  const isUniversity = memberships.some((item) => item.organization_kind === "university" && ["university_admin", "reviewer", "credential_issuer"].includes(item.role));
  const primaryRole = isBusiness ? "business" : isUniversity ? "university" : "student";
  const [inviteOrganizationId, setInviteOrganizationId] = useState(adminMemberships[0]?.organization_id ?? "");
  const [inviteRole, setInviteRole] = useState("challenge_manager");
  const [targetWallet, setTargetWallet] = useState("");
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const roleLabel = (role: string) => {
    const roleKeys: Record<string, MessageKey> = { business_admin: "dashboard.role.businessAdmin", university_admin: "dashboard.role.universityAdmin", challenge_manager: "dashboard.role.challengeManager", reviewer: "dashboard.role.reviewer", credential_issuer: "dashboard.role.credentialIssuer", student: "dashboard.role.student" };
    return roleKeys[role] ? t(roleKeys[role]) : role.replaceAll("_", " ");
  };
  const kindLabel = (kind: string) => kind === "business" ? t("dashboard.kind.business") : kind === "university" ? t("dashboard.kind.university") : t("dashboard.kind.personal");

  async function saveProfile() {
    setBusy(true); setNotice(null);
    const response = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: name, profileKind: primaryRole }) });
    const data = await response.json() as { user?: DashboardUser; error?: string };
    if (response.ok && data.user) { setUser(data.user); setNotice(t("dashboard.savedProfile")); } else setNotice(data.error ?? t("dashboard.saveProfileError"));
    setBusy(false);
  }

  async function createOrganization() {
    setBusy(true); setNotice(null);
    const response = await fetch("/api/organizations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: organizationName, kind: organizationKind }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) { setNotice(data.error ?? t("dashboard.createOrganizationError")); setBusy(false); return; }
    const refreshed = await fetch("/api/organizations", { cache: "no-store" }).then((item) => item.json()) as { organizations: Membership[] };
    setMemberships(refreshed.organizations);
    const createdAdmin = refreshed.organizations.find((item) => item.role.endsWith("_admin"));
    if (createdAdmin) setInviteOrganizationId(createdAdmin.organization_id);
    setOrganizationName(""); setNotice(t("dashboard.createdOrganization")); setBusy(false);
  }

  async function createInvitation() {
    setBusy(true); setNotice(null); setJoinUrl(null);
    const response = await fetch("/api/invitations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId: inviteOrganizationId, role: inviteRole, targetWallet: targetWallet || undefined }) });
    const data = await response.json() as { invitation?: { joinUrl: string }; error?: string };
    if (response.ok && data.invitation) { setJoinUrl(data.invitation.joinUrl); setNotice(t("dashboard.createdInvite")); } else setNotice(data.error ?? t("dashboard.createInviteError"));
    setBusy(false);
  }

  return (
    <section className="app-content" id="workspace-main" tabIndex={-1}>
          <div className="app-welcome"><div><span>{t("dashboard.welcome")}</span><h1>{user.displayName || t("dashboard.completeIdentity")}</h1><p>{t("dashboard.simpleIntro")}</p></div><div className="identity-card"><small>{t("dashboard.primaryWallet")}</small><code>{user.walletAddress}</code><b>{t("dashboard.signatureVerified")}</b></div></div>
          <section className="next-action-panel">
            <div className="next-action-copy"><span className="panel-kicker">{t("dashboard.nextActionKicker")}</span><h2>{!user.displayName ? t("dashboard.nextProfileTitle") : role === "business" ? t("dashboard.nextBusinessTitle") : role === "university" ? t("dashboard.nextUniversityTitle") : t("dashboard.nextStudentTitle")}</h2><p>{!user.displayName ? t("dashboard.nextProfileDescription") : role === "business" ? t("dashboard.nextBusinessDescription") : role === "university" ? t("dashboard.nextUniversityDescription") : t("dashboard.nextStudentDescription")}</p></div>
            <Link className="button button-primary" href={!user.displayName ? "#profile" : role === "business" ? "/app/challenges" : role === "university" ? "/app/reviews" : "/app/challenges"}>{!user.displayName ? t("dashboard.nextProfileCta") : role === "business" ? t("dashboard.nextBusinessCta") : role === "university" ? t("dashboard.nextUniversityCta") : t("dashboard.nextStudentCta")}</Link>
          </section>
          <section className="journey-summary" aria-label={t("dashboard.journeyLabel")}>
            {["dashboard.journeyChallenge", "dashboard.journeySubmit", "dashboard.journeyReview", "dashboard.journeyProof"].map((key, index) => <div key={key}><span>{index + 1}</span><strong>{t(key as MessageKey)}</strong></div>)}
          </section>
          {!user.displayName && <section className="app-panel onboarding-panel" id="profile"><div><span>{t("dashboard.step1")}</span><h2>{t("dashboard.createProfile")}</h2><p>{t("dashboard.profileDescription")}</p></div><div className="inline-form"><input aria-label={t("dashboard.displayName")} value={name} onChange={(event) => setName(event.target.value)} placeholder={t("dashboard.displayNamePlaceholder")} /><button className="button button-primary" disabled={busy || !name.trim()} onClick={saveProfile}>{t("dashboard.saveProfile")}</button></div></section>}
          <div className="dashboard-grid">
            <section className="app-panel"><span className="panel-kicker">{t("dashboard.organizations")}</span><h2>{t("dashboard.yourOrganizations")}</h2>{memberships.length ? <div className="membership-list">{memberships.map((item) => <article key={item.id}><div><strong>{item.organization_name}</strong><small>{kindLabel(item.organization_kind)} · {translateStatus(t, item.verification_status)}</small></div><b>{roleLabel(item.role)}</b></article>)}</div> : <p>{t("dashboard.noOrganization")}</p>}</section>
            <section className="app-panel"><span className="panel-kicker">{t("dashboard.createOrganization")}</span><h2>{t("dashboard.createWorkspace")}</h2><div className="stack-form"><input aria-label={t("dashboard.organizationName")} value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder={t("dashboard.organizationName")} /><select value={organizationKind} onChange={(event) => setOrganizationKind(event.target.value as "business" | "university")}><option value="business">{t("dashboard.business")}</option><option value="university">{t("dashboard.university")}</option></select><button className="button button-dark" disabled={busy || !organizationName.trim()} onClick={createOrganization}>{t("dashboard.create")}</button></div></section>
          </div>
          {adminMemberships.length > 0 && <section className="app-panel invitation-panel"><div><span className="panel-kicker">{t("dashboard.secureInvitation")}</span><h2>{t("dashboard.inviteMember")}</h2><p>{t("dashboard.inviteDescription")}</p></div><div className="stack-form"><select aria-label={t("dashboard.selectOrganization")} value={inviteOrganizationId} onChange={(event) => { const id = event.target.value; setInviteOrganizationId(id); const organization = adminMemberships.find((item) => item.organization_id === id); setInviteRole(organization?.organization_kind === "university" ? "reviewer" : "challenge_manager"); }}><option value="">{t("dashboard.selectOrganization")}</option>{adminMemberships.map((item) => <option value={item.organization_id} key={item.id}>{item.organization_name}</option>)}</select><select aria-label={t("dashboard.invitedRole")} value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>{adminMemberships.find((item) => item.organization_id === inviteOrganizationId)?.organization_kind === "university" ? <><option value="reviewer">{t("dashboard.role.reviewer")}</option><option value="credential_issuer">{t("dashboard.role.credentialIssuer")}</option><option value="university_admin">{t("dashboard.role.universityAdmin")}</option></> : <><option value="challenge_manager">{t("dashboard.role.challengeManager")}</option><option value="reviewer">{t("dashboard.role.reviewer")}</option><option value="credential_issuer">{t("dashboard.role.credentialIssuer")}</option><option value="business_admin">{t("dashboard.role.businessAdmin")}</option></>}</select><input aria-label={t("dashboard.targetWallet")} value={targetWallet} onChange={(event) => setTargetWallet(event.target.value)} placeholder={t("dashboard.targetWallet")} /><button className="button button-dark" disabled={busy || !inviteOrganizationId} onClick={createInvitation}>{t("dashboard.createInvite")}</button>{joinUrl && <div className="join-url"><code>{joinUrl}</code><button onClick={() => navigator.clipboard.writeText(joinUrl)}>{t("dashboard.copyInvite")}</button></div>}</div></section>}
          {notice && <p className="app-notice" role="status">{notice}</p>}
          <section className="app-panel next-build"><span className="panel-kicker">{t("dashboard.productStatus")}</span><h2>{t("dashboard.workflowActive")}</h2><p>{t("dashboard.workflowDescription")}</p><details className="technical-details"><summary>{t("dashboard.technicalDetails")}</summary><p>{t("dashboard.technicalDetailsDescription")}</p></details></section>
    </section>
  );
}

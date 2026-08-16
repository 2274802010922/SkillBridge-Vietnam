"use client";

import { useEffect, useMemo, useState } from "react";
import { translateStatus, useLanguage } from "./i18n";

type Membership = {
  id: string;
  role: string;
  organization_id: string;
  organization_name: string;
  organization_kind: string;
};
type University = { id: string; name: string; verification_status: string };
type Challenge = {
  id: string;
  organization_id: string;
  organization_name: string;
  title: string;
  brief: string;
  skills_json: string;
  reward: string;
  reward_type: "usdc" | "badge";
  reward_metadata_json: string;
  reward_slots: number;
  minimum_score: string;
  reward_amount_usdc: string | null;
  reward_amount_atomic: string | null;
  reward_mint: string | null;
  access_type: "public" | "invite_only";
  status: string;
  can_manage: number;
  participation_id: string | null;
  participation_state: string | null;
};

export function ChallengesWorkspace({ memberships, universities }: { memberships: Membership[]; universities: University[] }) {
  const { t } = useLanguage();
  const businessMemberships = memberships.filter((item) =>
    item.organization_kind === "business" && ["business_admin", "challenge_manager"].includes(item.role));
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [organizationId, setOrganizationId] = useState(businessMemberships[0]?.organization_id ?? "");
  const [reviewerOrganizationId, setReviewerOrganizationId] = useState(universities[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [skills, setSkills] = useState("");
  const [reward, setReward] = useState("");
  const [rewardType, setRewardType] = useState<"" | "usdc" | "badge">("");
  const [badgeName, setBadgeName] = useState("");
  const [badgeDescription, setBadgeDescription] = useState("");
  const [rewardSlots, setRewardSlots] = useState("1");
  const [minimumScore, setMinimumScore] = useState("0");
  const [rewardAmountUsdc, setRewardAmountUsdc] = useState("");
  const [accessType, setAccessType] = useState<"" | "public" | "invite_only">("");
  const [targetWallet, setTargetWallet] = useState("");
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const managed = useMemo(() => challenges.filter((item) => item.can_manage), [challenges]);

  async function load() {
    const response = await fetch("/api/challenges", { cache: "no-store" });
    if (response.ok) setChallenges(((await response.json()) as { challenges: Challenge[] }).challenges);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/challenges", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ challenges: Challenge[] }> : { challenges: [] })
      .then((data) => { if (active) setChallenges(data.challenges); });
    return () => { active = false; };
  }, []);

  async function create() {
    setBusy(true);
    setNotice(null);
    const response = await fetch("/api/challenges", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organizationId,
        reviewerOrganizationId,
        title,
        brief,
        skills: skills.split(","),
        reward,
        rewardType: rewardType || undefined,
        badgeName: badgeName || undefined,
        badgeDescription: badgeDescription || undefined,
        rewardSlots: Number(rewardSlots) || 1,
        minimumScore,
        rewardAmountUsdc: rewardAmountUsdc || undefined,
        accessType,
      }),
    });
    const data = await response.json() as { error?: string };
    setNotice(response.ok ? t("challenge.created") : data.error ?? t("challenge.actionError"));
    if (response.ok) {
      setTitle("");
      setBrief("");
      setRewardAmountUsdc("");
      setRewardType(""); setBadgeName(""); setBadgeDescription(""); setRewardSlots("1"); setMinimumScore("0"); setSkills(""); setReward(""); setAccessType("");
      await load();
    }
    setBusy(false);
  }

  async function publish(id: string) {
    setBusy(true);
    const response = await fetch(`/api/challenges/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "publish" }),
    });
    const data = await response.json() as { error?: string };
    setNotice(response.ok ? t("challenge.published") : data.error ?? t("challenge.actionError"));
    await load();
    setBusy(false);
  }

  async function invite(id: string) {
    setBusy(true);
    setJoinUrl(null);
    const response = await fetch(`/api/challenges/${id}/invite`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetWallet: targetWallet || undefined }),
    });
    const data = await response.json() as { invitation?: { joinUrl: string }; error?: string };
    if (response.ok && data.invitation) {
      setJoinUrl(data.invitation.joinUrl);
      setNotice(t("challenge.invited"));
    } else {
      setNotice(data.error ?? t("challenge.actionError"));
    }
    setBusy(false);
  }

  async function updateAccess(id: string, nextAccessType: "public" | "invite_only") {
    setBusy(true);
    setNotice(null);
    const response = await fetch(`/api/challenges/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "set_access", accessType: nextAccessType }),
    });
    const data = await response.json() as { error?: string };
    setNotice(response.ok ? t("challenge.accessUpdated") : data.error ?? t("challenge.actionError"));
    if (response.ok) await load();
    setBusy(false);
  }

  async function join(id: string) {
    setBusy(true);
    setNotice(null);
    const response = await fetch(`/api/challenges/${id}/join`, { method: "POST" });
    const data = await response.json() as { error?: string };
    setNotice(response.ok ? t("challenge.joined") : data.error ?? t("challenge.actionError"));
    if (response.ok) await load();
    setBusy(false);
  }

  return <div className="workspace-product-content">
    <div className="app-welcome">
      <div>
        <span>{t("challenge.kicker")}</span>
        <h1>{t("challenge.title")}</h1>
        <p>{t("challenge.description")}</p>
      </div>
      <div className="identity-card">
          <small>{t("challenge.liveRecords")}</small>
        <strong className="metric-number">{challenges.length}</strong>
          <b>{managed.length} {t("challenge.managed")}</b>
      </div>
    </div>

    {businessMemberships.length > 0 && <section className="app-panel challenge-builder">
      <div>
        <span className="panel-kicker">{t("challenge.new")}</span>
        <h2>{t("challenge.createBrief")}</h2>
        <p>{t("challenge.createDescription")}</p>
      </div>
      <div className="stack-form">
        <select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>
          {businessMemberships.map((item) => <option value={item.organization_id} key={item.id}>{item.organization_name}</option>)}
        </select>
        <select value={reviewerOrganizationId} onChange={(event) => setReviewerOrganizationId(event.target.value)}>
          <option value="">{t("challenge.selectReviewer")}</option>
          {universities.map((item) => <option value={item.id} key={item.id}>{item.name} · {translateStatus(t, item.verification_status)}</option>)}
        </select>
        <select aria-label="Chế độ tham gia" value={accessType} onChange={(event) => setAccessType(event.target.value as "" | "public" | "invite_only")}>
          <option value="">{t("challenge.selectAccess")}</option>
          <option value="public">{t("challenge.publicOption")}</option>
          <option value="invite_only">{t("challenge.inviteOption")}</option>
        </select>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("challenge.titlePlaceholder")} />
        <textarea value={brief} onChange={(event) => setBrief(event.target.value)} placeholder={t("challenge.briefPlaceholder")} />
        <input value={skills} onChange={(event) => setSkills(event.target.value)} placeholder={t("challenge.skillsPlaceholder")} />
        <input value={reward} onChange={(event) => setReward(event.target.value)} placeholder={t("challenge.rewardPlaceholder")} />
        <select aria-label={t("challenge.rewardType")} value={rewardType} onChange={(event) => { setRewardType(event.target.value as "" | "usdc" | "badge"); if (event.target.value === "badge") setRewardAmountUsdc(""); }}>
          <option value="">{t("challenge.selectRewardType")}</option>
          <option value="usdc">{t("challenge.rewardUsdc")}</option>
          <option value="badge">{t("challenge.rewardBadge")}</option>
        </select>
        {rewardType === "usdc" && <div className="invoice-form-grid"><label>{t("challenge.rewardAmount")}<input aria-label={t("challenge.rewardAmount")} inputMode="decimal" value={rewardAmountUsdc} onChange={(event) => setRewardAmountUsdc(event.target.value)} placeholder={t("challenge.rewardAmountPlaceholder")} /></label><label>{t("challenge.rewardSlots")}<input type="number" min="1" max="100" value={rewardSlots} onChange={(event) => setRewardSlots(event.target.value)} /></label></div>}
        {rewardType === "badge" && <><input value={badgeName} onChange={(event) => setBadgeName(event.target.value)} placeholder={t("challenge.badgeName")} /><textarea value={badgeDescription} onChange={(event) => setBadgeDescription(event.target.value)} placeholder={t("challenge.badgeDescription")} /><label>{t("challenge.rewardSlots")}<input type="number" min="1" max="100" value={rewardSlots} onChange={(event) => setRewardSlots(event.target.value)} /></label></>}
        <label>{t("challenge.minimumScore")}<input type="number" min="0" max="100" value={minimumScore} onChange={(event) => setMinimumScore(event.target.value)} /></label>
        <button className="button button-primary" disabled={busy || !organizationId || !reviewerOrganizationId || !accessType || !rewardType} onClick={create}>{t("challenge.create")}</button>
      </div>
    </section>}

    <section className="challenge-list">
      {challenges.map((item) => <article className="challenge-card" key={item.id}>
        <div className="entity-top">
          <span>{item.organization_name}</span>
          <b>{translateStatus(t, item.status)} · {item.access_type === "public" ? t("challenge.public") : t("challenge.inviteOnly")}</b>
        </div>
        <h2>{item.title}</h2>
        <p>{item.brief}</p>
        <div className="entity-tags">{JSON.parse(item.skills_json).map((skill: string) => <span key={skill}>{skill}</span>)}</div>
          <dl>
          <div><dt>{t("challenge.reward")}</dt><dd>{item.reward}</dd></div>
          <div><dt>{t("challenge.rewardType")}</dt><dd>{item.reward_type === "usdc" ? `${item.reward_amount_usdc ?? "0"} USDC` : `${t("challenge.rewardBadge")}: ${(() => { try { return (JSON.parse(item.reward_metadata_json) as { name?: string }).name ?? item.reward; } catch { return item.reward; } })()}`}</dd></div>
          <div><dt>{t("challenge.studentState")}</dt><dd>{translateStatus(t, item.participation_state ?? "not_joined")}</dd></div>
        </dl>

        {item.can_manage ? <div className="challenge-actions">
          {item.status !== "closed" && <select aria-label={`Chế độ tham gia ${item.title}`} value={item.access_type} disabled={busy} onChange={(event) => updateAccess(item.id, event.target.value as "public" | "invite_only")}>
            <option value="public">{t("challenge.managerPublic")}</option>
            <option value="invite_only">{t("challenge.managerInviteOnly")}</option>
          </select>}
          {item.status === "draft"
            ? <button className="button button-primary" disabled={busy} onClick={() => publish(item.id)}>{t("challenge.publish")}</button>
            : item.access_type === "invite_only"
              ? <><input value={targetWallet} onChange={(event) => setTargetWallet(event.target.value)} placeholder={t("challenge.targetWallet")} /><button className="button button-dark" disabled={busy} onClick={() => invite(item.id)}>{t("challenge.createInvitation")}</button></>
              : <p className="app-notice">{t("challenge.publicOpen")}</p>}
        </div> : item.participation_id
          ? <div className="challenge-actions"><a className="button button-dark" href="/app/submissions">{t("challenge.openSubmission")}</a></div>
          : item.status === "published" && item.access_type === "public"
            ? <div className="challenge-actions"><button className="button button-primary" disabled={busy} onClick={() => join(item.id)}>{t("challenge.join")}</button></div>
            : null}
      </article>)}
    </section>

    {joinUrl && <div className="join-url sticky-result"><code>{joinUrl}</code><button onClick={() => navigator.clipboard.writeText(joinUrl)}>{t("challenge.copyInvite")}</button></div>}
    {notice && <p className="app-notice" role="status">{notice}</p>}
  </div>;
}

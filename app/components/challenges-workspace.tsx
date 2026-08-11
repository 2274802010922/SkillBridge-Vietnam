"use client";

import { useEffect, useMemo, useState } from "react";

type Membership = { id: string; role: string; organization_id: string; organization_name: string; organization_kind: string };
type University = { id: string; name: string; verification_status: string };
type Challenge = { id: string; organization_id: string; organization_name: string; title: string; brief: string; skills_json: string; reward: string; status: string; can_manage: number; participation_id: string | null; participation_state: string | null };

export function ChallengesWorkspace({ memberships, universities }: { memberships: Membership[]; universities: University[] }) {
  const businessMemberships = memberships.filter((item) => item.organization_kind === "business" && ["business_admin", "challenge_manager"].includes(item.role));
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [organizationId, setOrganizationId] = useState(businessMemberships[0]?.organization_id ?? "");
  const [reviewerOrganizationId, setReviewerOrganizationId] = useState(universities[0]?.id ?? "");
  const [title, setTitle] = useState(""); const [brief, setBrief] = useState(""); const [skills, setSkills] = useState("Research, Strategy"); const [reward, setReward] = useState("Fast-track interview");
  const [targetWallet, setTargetWallet] = useState(""); const [joinUrl, setJoinUrl] = useState<string | null>(null); const [notice, setNotice] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const managed = useMemo(() => challenges.filter((item) => item.can_manage), [challenges]);

  async function load() { const response = await fetch("/api/challenges", { cache: "no-store" }); if (response.ok) setChallenges(((await response.json()) as { challenges: Challenge[] }).challenges); }
  useEffect(() => {
    let active = true;
    fetch("/api/challenges", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ challenges: Challenge[] }> : { challenges: [] })
      .then((data) => { if (active) setChallenges(data.challenges); });
    return () => { active = false; };
  }, []);
  async function create() { setBusy(true); setNotice(null); const response = await fetch("/api/challenges", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, reviewerOrganizationId, title, brief, skills: skills.split(","), reward }) }); const data = await response.json() as { error?: string }; setNotice(response.ok ? "Đã tạo challenge draft." : data.error ?? "Không thể tạo challenge."); if (response.ok) { setTitle(""); setBrief(""); await load(); } setBusy(false); }
  async function publish(id: string) { setBusy(true); const response = await fetch(`/api/challenges/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "publish" }) }); const data = await response.json() as { error?: string }; setNotice(response.ok ? "Challenge đã được publish." : data.error ?? "Không thể publish."); await load(); setBusy(false); }
  async function invite(id: string) { setBusy(true); setJoinUrl(null); const response = await fetch(`/api/challenges/${id}/invite`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ targetWallet: targetWallet || undefined }) }); const data = await response.json() as { invitation?: { joinUrl: string }; error?: string }; if (response.ok && data.invitation) { setJoinUrl(data.invitation.joinUrl); setNotice("Đã tạo link mời sinh viên."); } else setNotice(data.error ?? "Không thể tạo lời mời."); setBusy(false); }

  return <div className="workspace-product-content"><div className="app-welcome"><div><span>CHALLENGE PIPELINE</span><h1>Brief thật, quyền thật.</h1><p>Doanh nghiệp tạo challenge; sinh viên chỉ tham gia bằng invitation có thời hạn.</p></div><div className="identity-card"><small>LIVE RECORDS</small><strong className="metric-number">{challenges.length}</strong><b>{managed.length} challenge có thể quản lý</b></div></div>
    {businessMemberships.length > 0 && <section className="app-panel challenge-builder"><div><span className="panel-kicker">NEW CHALLENGE</span><h2>Tạo business brief</h2><p>Rubric v1 được khóa theo bốn tiêu chí để AI và reviewer dùng cùng chuẩn.</p></div><div className="stack-form"><select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}>{businessMemberships.map((item) => <option value={item.organization_id} key={item.id}>{item.organization_name}</option>)}</select><select value={reviewerOrganizationId} onChange={(e) => setReviewerOrganizationId(e.target.value)}><option value="">Chọn nhà trường review</option>{universities.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.verification_status}</option>)}</select><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tên challenge" /><textarea value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Mô tả bài toán, đối tượng và kết quả mong đợi…" /><input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Skills, cách nhau bằng dấu phẩy" /><input value={reward} onChange={(e) => setReward(e.target.value)} placeholder="Cơ hội sau challenge" /><button className="button button-primary" disabled={busy || !organizationId || !reviewerOrganizationId} onClick={create}>Tạo challenge</button></div></section>}
    <section className="challenge-list">{challenges.map((item) => <article className="challenge-card" key={item.id}><div className="entity-top"><span>{item.organization_name}</span><b>{item.status}</b></div><h2>{item.title}</h2><p>{item.brief}</p><div className="entity-tags">{JSON.parse(item.skills_json).map((skill: string) => <span key={skill}>{skill}</span>)}</div><dl><div><dt>REWARD</dt><dd>{item.reward}</dd></div><div><dt>STUDENT STATE</dt><dd>{item.participation_state ?? "not joined"}</dd></div></dl>{item.can_manage ? <div className="challenge-actions">{item.status === "draft" ? <button className="button button-primary" disabled={busy} onClick={() => publish(item.id)}>Publish</button> : <><input value={targetWallet} onChange={(e) => setTargetWallet(e.target.value)} placeholder="Khóa cho ví sinh viên (tùy chọn)" /><button className="button button-dark" disabled={busy} onClick={() => invite(item.id)}>Tạo invitation</button></>}</div> : null}</article>)}</section>
    {joinUrl && <div className="join-url sticky-result"><code>{joinUrl}</code><button onClick={() => navigator.clipboard.writeText(joinUrl)}>Sao chép</button></div>}{notice && <p className="app-notice" role="status">{notice}</p>}</div>;
}

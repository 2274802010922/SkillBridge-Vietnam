"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { translateStatus, useLanguage } from "./i18n";
import { WalletPaymentButton } from "./wallet-payment-button";
import { WalletTermsSignature } from "./wallet-terms-signature";

type Membership = { id: string; role: string; organization_id: string; organization_name: string; organization_kind: string };
type University = { id: string; name: string; verification_status: string };
type Challenge = {
  id: string; organization_id: string; organization_name: string; title: string; brief: string; skills_json: string;
  reward: string; reward_type: "usdc" | "sol" | "badge"; reward_asset: "usdc" | "sol" | null;
  reward_metadata_json: string; reward_slots: number; minimum_score: string; reward_amount_usdc: string | null;
  reward_amount_atomic: string | null; reward_mint: string | null; access_type: "public" | "invite_only"; status: string; can_manage: number;
  participation_id: string | null; participation_state: string | null; funding_status: string | null;
  fund_id: string | null; fund_asset: "usdc" | "sol" | null; fund_required_display: string | null;
  fund_required_atomic: string | null; fund_funded_atomic: string | null; fund_disbursed_atomic: string | null;
  fund_refunded_atomic: string | null; fund_vault_wallet: string | null; fund_reference_key: string | null;
  fund_status: "awaiting_payment" | "funded" | "refunded" | null; fund_funding_tx: string | null;
  fund_submitted_tx: string | null; fund_verification_state: "awaiting_signature" | "checking" | "pending_finalization" | "failed" | "verified" | null;
  fund_verification_error_code: string | null; fund_verification_checked_at: string | null;
  fund_terms_version: string | null; fund_terms_hash: string | null; fund_terms_signature: string | null;
  fund_terms_signer_wallet: string | null; fund_terms_accepted_at: string | null; fund_locked_at: string | null; fund_refund_policy_state: string | null;
};

function shortWallet(value: string | null) { return value ? `${value.slice(0, 8)}…${value.slice(-6)}` : "—"; }
function parseSkills(value: string) { try { return JSON.parse(value) as string[]; } catch { return []; } }
function badgeName(item: Challenge) { try { return (JSON.parse(item.reward_metadata_json) as { name?: string }).name || item.reward; } catch { return item.reward; } }

export function ChallengesWorkspace({ memberships, universities }: { memberships: Membership[]; universities: University[] }) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const vi = locale === "vi";
  const copy = vi ? {
    fundingTitle: "Quỹ thưởng Devnet", prepare: "Chuẩn bị nạp quỹ", pay: "Nạp quỹ bằng ví", verify: "Đã ký — xác minh quỹ", funded: "Đã nạp và xác minh", awaiting: "Đang chờ nạp", needsFunding: "Cần nạp quỹ trước khi công bố", vault: "Ví Reward Vault", total: "Tổng quỹ", perWinner: "mỗi người nhận", openWallet: "Mở bằng Solana Pay", refund: "Hoàn quỹ chưa giải ngân", close: "Đóng challenge", refunded: "Đã hoàn quỹ", sol: "SOL Devnet", usdc: "USDC", badgeBond: "Ký quỹ SOL hoàn lại", rewardAmount: "Giá trị mỗi người nhận", fundingHint: "Ví doanh nghiệp ký giao dịch Devnet. Chỉ khi on-chain xác nhận đủ quỹ, challenge mới công bố được.", fundingCreated: "Yêu cầu nạp quỹ đã sẵn sàng.", fundingVerified: "Quỹ đã được xác minh on-chain. Bạn có thể công bố challenge.", refundDone: "Đã hoàn quỹ từ Reward Vault.", publishFirst: "Công bố sau khi quỹ đã được xác minh.", solOption: "Phần thưởng SOL Devnet", manualVerify: "Tôi đã nạp — xác minh giao dịch", manualPlaceholder: "Dán transaction signature từ Solana Explorer", manualHelp: "Bạn không cần private key hoặc seed phrase. Nếu đã nạp rồi, không nạp lại.", manualSubmit: "Xác minh signature", pending: "Đã nhận signature, đang chờ finalized", checking: "Đang kiểm tra transaction…", failed: "Chưa xác minh được — kiểm tra lại signature", retry: "Kiểm tra lại quỹ", viewTransaction: "Xem transaction trên Explorer", pendingNotice: "Giao dịch đã có trên chain nhưng chưa finalized. Hãy bấm kiểm tra lại sau ít giây.",
  } : {
    fundingTitle: "Devnet reward vault", prepare: "Prepare funding", pay: "Fund with wallet", verify: "Signed — verify funding", funded: "Funded and verified", awaiting: "Awaiting funding", needsFunding: "Funding is required before publishing", vault: "Reward Vault wallet", total: "Total vault", perWinner: "per winner", openWallet: "Open with Solana Pay", refund: "Refund undistributed balance", close: "Close challenge", refunded: "Funds refunded", sol: "Devnet SOL", usdc: "USDC", badgeBond: "Refundable SOL bond", rewardAmount: "Value per winner", fundingHint: "The business wallet signs a Devnet payment. The challenge can only publish after the on-chain vault is verified.", fundingCreated: "Funding request is ready.", fundingVerified: "Funds are verified on-chain. You can now publish the challenge.", refundDone: "Funds returned from the Reward Vault.", publishFirst: "Publish after funding is verified.", solOption: "Devnet SOL reward", manualVerify: "I already funded — verify transaction", manualPlaceholder: "Paste the transaction signature from Solana Explorer", manualHelp: "You do not need a private key or seed phrase. If you already funded, do not pay again.", manualSubmit: "Verify signature", pending: "Signature received; waiting for finalization", checking: "Checking transaction…", failed: "Not verified yet — check the signature", retry: "Check funding again", viewTransaction: "View transaction in Explorer", pendingNotice: "The transaction is on-chain but not finalized yet. Check again in a few seconds.",
  };
  const businessMemberships = memberships.filter((item) => item.organization_kind === "business" && ["business_admin", "challenge_manager"].includes(item.role));
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [organizationId, setOrganizationId] = useState(businessMemberships[0]?.organization_id ?? "");
  const [reviewerOrganizationId, setReviewerOrganizationId] = useState(universities[0]?.id ?? "");
  const [title, setTitle] = useState(""); const [brief, setBrief] = useState(""); const [skills, setSkills] = useState(""); const [reward, setReward] = useState("");
  const [rewardType, setRewardType] = useState<"" | "usdc" | "sol" | "badge">(""); const [badgeNameValue, setBadgeNameValue] = useState(""); const [badgeDescription, setBadgeDescription] = useState("");
  const [rewardSlots, setRewardSlots] = useState("1"); const [minimumScore, setMinimumScore] = useState("0"); const [rewardAmount, setRewardAmount] = useState("");
  const [accessType, setAccessType] = useState<"" | "public" | "invite_only">(""); const [targetWallet, setTargetWallet] = useState(""); const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [formStep, setFormStep] = useState<1 | 2 | 3>(1);
  const [fundingSignatures, setFundingSignatures] = useState<Record<string, string>>({});
  const [manualFundingOpen, setManualFundingOpen] = useState<Record<string, boolean>>({});
  const managed = useMemo(() => challenges.filter((item) => item.can_manage), [challenges]);

  async function load() {
    const response = await fetch("/api/challenges", { cache: "no-store" });
    if (response.ok) {
      const next = ((await response.json()) as { challenges: Challenge[] }).challenges;
      setChallenges(next);
      setFundingSignatures((current) => {
        const merged = { ...current };
        for (const item of next) if (item.fund_submitted_tx && !merged[item.id]) merged[item.id] = item.fund_submitted_tx;
        return merged;
      });
    }
  }
  useEffect(() => {
    let active = true;
    fetch("/api/challenges", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ challenges: Challenge[] }> : { challenges: [] })
      .then((data) => { if (active) setChallenges(data.challenges); });
    return () => { active = false; };
  }, []);

  async function create() {
    setBusy(true); setNotice(null);
    const response = await fetch("/api/challenges", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, reviewerOrganizationId, title, brief, skills: skills.split(","), reward, rewardType: rewardType || undefined, badgeName: badgeNameValue || undefined, badgeDescription: badgeDescription || undefined, rewardSlots: Number(rewardSlots) || 1, minimumScore, rewardAmountUsdc: rewardAmount || undefined, accessType }) });
    const data = await response.json() as { error?: string };
    setNotice(response.ok ? t("challenge.created") : data.error ?? t("challenge.actionError"));
    if (response.ok) { setTitle(""); setBrief(""); setRewardAmount(""); setRewardType(""); setBadgeNameValue(""); setBadgeDescription(""); setRewardSlots("1"); setMinimumScore("0"); setSkills(""); setReward(""); setAccessType(""); setFormStep(1); await load(); }
    setBusy(false);
  }
  function nextFormStep() {
    if (formStep === 1 && (!organizationId || !reviewerOrganizationId)) { setNotice(t("challenge.stepOneRequired")); return; }
    if (formStep === 2 && (title.trim().length < 5 || brief.trim().length < 40 || !skills.split(",").some((item) => item.trim()))) { setNotice(t("challenge.stepTwoRequired")); return; }
    setNotice(null); setFormStep((current) => current === 3 ? 3 : (current + 1) as 1 | 2 | 3);
  }
  async function publish(id: string) { setBusy(true); const response = await fetch(`/api/challenges/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "publish" }) }); const data = await response.json() as { error?: string }; setNotice(response.ok ? t("challenge.published") : data.error ?? t("challenge.actionError")); await load(); setBusy(false); }
  async function close(id: string) { if (!window.confirm(vi ? "Đóng challenge này? Người mới sẽ không thể tham gia." : "Close this challenge? New students will no longer be able to join.")) return; setBusy(true); const response = await fetch(`/api/challenges/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "close" }) }); const data = await response.json() as { error?: string }; setNotice(response.ok ? (vi ? "Challenge đã đóng." : "Challenge closed.") : data.error ?? t("challenge.actionError")); await load(); setBusy(false); }
  async function updateAccess(id: string, nextAccessType: "public" | "invite_only") { setBusy(true); const response = await fetch(`/api/challenges/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "set_access", accessType: nextAccessType }) }); const data = await response.json() as { error?: string }; setNotice(response.ok ? t("challenge.accessUpdated") : data.error ?? t("challenge.actionError")); if (response.ok) await load(); setBusy(false); }
  async function invite(id: string) { setBusy(true); setJoinUrl(null); const response = await fetch(`/api/challenges/${id}/invite`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ targetWallet: targetWallet || undefined }) }); const data = await response.json() as { invitation?: { joinUrl: string }; error?: string }; if (response.ok && data.invitation) { setJoinUrl(data.invitation.joinUrl); setNotice(t("challenge.invited")); } else setNotice(data.error ?? t("challenge.actionError")); setBusy(false); }
  async function join(id: string) { setBusy(true); const response = await fetch(`/api/challenges/${id}/join`, { method: "POST" }); const data = await response.json() as { error?: string }; setNotice(response.ok ? t("challenge.joined") : data.error ?? t("challenge.actionError")); if (response.ok) { await load(); window.setTimeout(() => router.push("/app/submissions"), 450); } setBusy(false); }
  async function prepareFunding(id: string) { setBusy(true); const response = await fetch(`/api/challenges/${id}/funding`, { method: "POST" }); const data = await response.json() as { error?: string }; setNotice(response.ok ? copy.fundingCreated : data.error ?? t("challenge.actionError")); if (response.ok) await load(); setBusy(false); }
  async function verifyFunding(id: string, signature: string, mode: "automatic" | "manual" = "automatic"): Promise<{ status: "funded" | "pending" }> {
    setFundingSignatures((current) => ({ ...current, [id]: signature }));
    setBusy(true);
    try {
      const response = await fetch(`/api/challenges/${id}/funding/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ signature, mode }) });
      const data = await response.json() as { error?: string; code?: string };
      if (response.status === 202 && data.code === "NOT_FINALIZED") {
        setNotice(copy.pendingNotice);
        await load();
        return { status: "pending" };
      }
      if (!response.ok) {
        const message = data.error ?? t("challenge.actionError");
        setNotice(message);
        throw new Error(message);
      }
      setNotice(copy.fundingVerified);
      await load();
      return { status: "funded" };
    } finally { setBusy(false); }
  }
  async function refund(id: string) { if (!window.confirm(vi ? "Hoàn toàn bộ số dư chưa giải ngân về ví đã nạp quỹ?" : "Return all undistributed funds to the funding wallet?")) return; setBusy(true); const response = await fetch(`/api/challenges/${id}/refund`, { method: "POST" }); const data = await response.json() as { error?: string }; setNotice(response.ok ? copy.refundDone : data.error ?? t("challenge.actionError")); if (response.ok) await load(); setBusy(false); }

  return <div className="workspace-product-content">
    <div className="app-welcome"><div><span>{t("challenge.kicker")}</span><h1>{t("challenge.title")}</h1><p>{t("challenge.description")}</p></div><div className="identity-card"><small>{t("challenge.liveRecords")}</small><strong className="metric-number">{challenges.length}</strong><b>{managed.length} {t("challenge.managed")}</b></div></div>
    {businessMemberships.length > 0 && <section className="app-panel challenge-builder challenge-wizard"><div><span className="panel-kicker">{t("challenge.new")}</span><h2>{t("challenge.createBrief")}</h2><p>{t("challenge.createDescription")}</p><ol className="wizard-steps" aria-label={t("challenge.wizardProgress")}>{[t("challenge.stepBasics"), t("challenge.stepBrief"), t("challenge.stepReward")].map((label, index) => <li className={formStep === index + 1 ? "active" : formStep > index + 1 ? "complete" : ""} key={label}><span>{formStep > index + 1 ? "✓" : index + 1}</span><strong>{label}</strong></li>)}</ol><p className="wizard-helper">{formStep === 1 ? t("challenge.stepOneHelper") : formStep === 2 ? t("challenge.stepTwoHelper") : copy.fundingHint}</p></div>
      <div className="stack-form">
        {formStep === 1 && <><label>{t("challenge.organizationLabel")}<select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>{businessMemberships.map((item) => <option value={item.organization_id} key={item.id}>{item.organization_name}</option>)}</select></label><label>{t("challenge.reviewerLabel")}<select value={reviewerOrganizationId} onChange={(event) => setReviewerOrganizationId(event.target.value)}><option value="">{t("challenge.selectReviewer")}</option>{universities.map((item) => <option value={item.id} key={item.id}>{item.name} · {translateStatus(t, item.verification_status)}</option>)}</select></label></>}
        {formStep === 2 && <><label>{t("challenge.titleLabel")}<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("challenge.titlePlaceholder")} /></label><label>{t("challenge.briefLabel")}<textarea value={brief} onChange={(event) => setBrief(event.target.value)} placeholder={t("challenge.briefPlaceholder")} /></label><label>{t("challenge.skillsLabel")}<input value={skills} onChange={(event) => setSkills(event.target.value)} placeholder={t("challenge.skillsPlaceholder")} /></label><label>{t("challenge.outcomeLabel")}<input value={reward} onChange={(event) => setReward(event.target.value)} placeholder={t("challenge.rewardPlaceholder")} /></label></>}
        {formStep === 3 && <><label>{t("challenge.accessLabel")}<select value={accessType} onChange={(event) => setAccessType(event.target.value as "" | "public" | "invite_only")}><option value="">{t("challenge.selectAccess")}</option><option value="public">{t("challenge.publicOption")}</option><option value="invite_only">{t("challenge.inviteOption")}</option></select></label><label>{t("challenge.rewardType")}<select value={rewardType} onChange={(event) => { const type = event.target.value as "" | "usdc" | "sol" | "badge"; setRewardType(type); if (type === "badge") setRewardAmount(""); }}><option value="">{t("challenge.selectRewardType")}</option><option value="usdc">{t("challenge.rewardUsdc")}</option><option value="sol">{copy.solOption}</option><option value="badge">{t("challenge.rewardBadge")}</option></select></label>
          {(rewardType === "usdc" || rewardType === "sol") && <div className="invoice-form-grid"><label>{copy.rewardAmount} ({rewardType === "sol" ? copy.sol : copy.usdc})<input inputMode="decimal" value={rewardAmount} onChange={(event) => setRewardAmount(event.target.value)} placeholder="10" /></label><label>{t("challenge.rewardSlots")}<input type="number" min="1" max="100" value={rewardSlots} onChange={(event) => setRewardSlots(event.target.value)} /></label></div>}
          {rewardType === "badge" && <><label>{t("challenge.badgeName")}<input value={badgeNameValue} onChange={(event) => setBadgeNameValue(event.target.value)} placeholder={t("challenge.badgeName")} /></label><label>{t("challenge.badgeDescription")}<textarea value={badgeDescription} onChange={(event) => setBadgeDescription(event.target.value)} placeholder={t("challenge.badgeDescription")} /></label><label>{t("challenge.rewardSlots")}<input type="number" min="1" max="100" value={rewardSlots} onChange={(event) => setRewardSlots(event.target.value)} /></label><p className="field-hint">{copy.badgeBond}: {copy.sol} ({vi ? "chỉ hoàn khi chưa giải ngân" : "refundable before a payout"}).</p></>}
          <label>{t("challenge.minimumScore")}<input type="number" min="0" max="100" value={minimumScore} onChange={(event) => setMinimumScore(event.target.value)} /></label></>}
        <div className="wizard-actions">{formStep > 1 && <button className="button button-secondary" type="button" disabled={busy} onClick={() => setFormStep((current) => (current - 1) as 1 | 2 | 3)}>{t("common.back")}</button>}{formStep < 3 ? <button className="button button-primary" type="button" disabled={busy} onClick={nextFormStep}>{t("common.continue")}</button> : <button className="button button-primary" type="button" disabled={busy || !organizationId || !reviewerOrganizationId || !accessType || !rewardType} onClick={() => void create()}>{t("challenge.create")}</button>}</div>
      </div></section>}
    <section className="challenge-list">{challenges.map((item) => <article className="challenge-card" key={item.id}>
      <div className="entity-top"><span>{item.organization_name}</span><b>{translateStatus(t, item.status)} · {item.access_type === "public" ? t("challenge.public") : t("challenge.inviteOnly")}</b></div><h2>{item.title}</h2><p>{item.brief}</p><div className="entity-tags">{parseSkills(item.skills_json).map((skill) => <span key={skill}>{skill}</span>)}</div>
      <dl><div><dt>{t("challenge.reward")}</dt><dd>{item.reward}</dd></div><div><dt>{t("challenge.rewardType")}</dt><dd>{item.reward_type === "badge" ? `${t("challenge.rewardBadge")}: ${badgeName(item)}` : `${item.reward_amount_usdc ?? "0"} ${item.reward_type === "sol" ? copy.sol : copy.usdc} · ${item.reward_slots} ${copy.perWinner}`}</dd></div><div><dt>{t("challenge.studentState")}</dt><dd>{translateStatus(t, item.participation_state ?? "not_joined")}</dd></div></dl>
      {item.can_manage ? <div className="challenge-actions challenge-manager-actions">
        {item.status !== "closed" && <select aria-label={`Chế độ tham gia ${item.title}`} value={item.access_type} disabled={busy} onChange={(event) => void updateAccess(item.id, event.target.value as "public" | "invite_only")}><option value="public">{t("challenge.managerPublic")}</option><option value="invite_only">{t("challenge.managerInviteOnly")}</option></select>}
        <section className={`reward-funding ${item.fund_status ?? "not_started"}`} aria-label={copy.fundingTitle}><div className="funding-heading"><div><span className="panel-kicker">{copy.fundingTitle}</span><strong>{item.fund_status === "funded" ? copy.funded : item.fund_status === "refunded" ? copy.refunded : item.fund_status === "awaiting_payment" ? copy.awaiting : copy.needsFunding}</strong></div>{item.fund_required_display && <b>{item.fund_required_display} {item.fund_asset === "sol" ? copy.sol : copy.usdc}</b>}</div>
          {item.fund_status === "awaiting_payment" && <><p>{copy.fundingHint}</p><dl className="vault-ledger"><div><dt>{copy.total}</dt><dd>{item.fund_required_display} {item.fund_asset === "sol" ? copy.sol : copy.usdc}</dd></div><div><dt>{copy.vault}</dt><dd title={item.fund_vault_wallet || ""}>{shortWallet(item.fund_vault_wallet)}</dd></div></dl><WalletPaymentButton fundingChallengeId={item.id} onSubmitted={(signature) => verifyFunding(item.id, signature)} label={copy.pay} /><a className="chain-proof-link" href={`solana:${item.fund_vault_wallet}?amount=${item.fund_required_display}&reference=${item.fund_reference_key}${item.fund_asset === "usdc" ? `&spl-token=${item.reward_mint || "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"}` : ""}`}><span aria-hidden="true">↗</span>{copy.openWallet}</a><div className="funding-recovery"><button className="button button-secondary" type="button" disabled={busy} onClick={() => setManualFundingOpen((current) => ({ ...current, [item.id]: !current[item.id] }))}>{manualFundingOpen[item.id] ? copy.retry : copy.manualVerify}</button>{item.fund_verification_state === "pending_finalization" && <p className="funding-pending" role="status" aria-live="polite">{copy.pending} {item.fund_submitted_tx && <><code className="funding-signature">{item.fund_submitted_tx}</code><a target="_blank" rel="noreferrer" href={`https://explorer.solana.com/tx/${item.fund_submitted_tx}?cluster=devnet`}>{copy.viewTransaction}</a></>}</p>}{item.fund_verification_state === "checking" && <p className="funding-pending" role="status" aria-live="polite">{copy.checking}</p>}{item.fund_verification_state === "failed" && <p className="demo-error" role="alert">{copy.failed}{item.fund_verification_error_code ? ` (${item.fund_verification_error_code})` : ""}</p>}{(manualFundingOpen[item.id] || Boolean(item.fund_submitted_tx)) && <div className="funding-signature-form"><label htmlFor={`funding-signature-${item.id}`}>{copy.manualVerify}</label><input id={`funding-signature-${item.id}`} value={fundingSignatures[item.id] ?? ""} onChange={(event) => setFundingSignatures((current) => ({ ...current, [item.id]: event.target.value }))} placeholder={copy.manualPlaceholder} aria-describedby={`funding-help-${item.id}`} /><small id={`funding-help-${item.id}`}>{copy.manualHelp}</small><button className="button button-primary" type="button" disabled={busy || !(fundingSignatures[item.id] ?? "").trim()} onClick={() => void verifyFunding(item.id, fundingSignatures[item.id] ?? "", "manual")}>{copy.manualSubmit}</button></div>}</div></>}
          {item.fund_status === "funded" && <><p>{copy.fundingHint}</p><dl className="vault-ledger"><div><dt>{copy.total}</dt><dd>{item.fund_required_display} {item.fund_asset === "sol" ? copy.sol : copy.usdc}</dd></div><div><dt>{copy.vault}</dt><dd title={item.fund_vault_wallet || ""}>{shortWallet(item.fund_vault_wallet)}</dd></div></dl>{item.fund_funding_tx && <div className="funding-proof"><code className="funding-signature">{item.fund_funding_tx}</code><a className="chain-proof-link" target="_blank" rel="noreferrer" href={`https://explorer.solana.com/tx/${item.fund_funding_tx}?cluster=devnet`}>{copy.viewTransaction}</a></div>}{item.status === "draft" && !item.fund_terms_signature && <WalletTermsSignature challengeId={item.id} onAccepted={load} />}{item.status === "draft" && item.fund_terms_signature && <p className="terms-confirmation-success" role="status">✓ {t("challenge.termsAccepted")}{item.fund_terms_hash ? ` · ${item.fund_terms_hash.slice(0, 14)}…` : ""}</p>}</>}
          {!item.fund_status && <button className="button button-secondary" type="button" disabled={busy || item.status !== "draft"} onClick={() => void prepareFunding(item.id)}>{copy.prepare}</button>}
        </section>
        {item.status === "draft" && <button className="button button-primary" type="button" disabled={busy || item.fund_status !== "funded" || !item.fund_terms_signature} title={item.fund_status !== "funded" ? copy.publishFirst : !item.fund_terms_signature ? t("challenge.termsTitle") : undefined} onClick={() => void publish(item.id)}>{t("challenge.publish")}</button>}
        {item.status === "published" && item.access_type === "invite_only" && <><input value={targetWallet} onChange={(event) => setTargetWallet(event.target.value)} placeholder={t("challenge.targetWallet")} /><button className="button button-dark" type="button" disabled={busy} onClick={() => void invite(item.id)}>{t("challenge.createInvitation")}</button></>}
        {item.status === "published" && item.access_type === "public" && <p className="app-notice">{t("challenge.publicOpen")}</p>}
        {item.status === "published" && <button className="button button-secondary" type="button" disabled={busy} onClick={() => void close(item.id)}>{copy.close}</button>}
        {item.fund_status === "funded" && (item.status === "draft" || item.status === "closed") && <button className="button button-text" type="button" disabled={busy} onClick={() => void refund(item.id)}>{copy.refund}</button>}
      </div> : item.participation_id ? <div className="challenge-actions"><a className="button button-dark" href="/app/submissions">{t("challenge.openSubmission")}</a></div> : item.status === "published" && item.access_type === "public" ? <div className="challenge-actions"><button className="button button-primary" type="button" disabled={busy} onClick={() => void join(item.id)}>{t("challenge.join")}</button></div> : null}
    </article>)}</section>
    {joinUrl && <div className="join-url sticky-result"><code>{joinUrl}</code><button type="button" onClick={() => void navigator.clipboard.writeText(joinUrl)}>{t("challenge.copyInvite")}</button></div>}{notice && <p className="app-notice" role="status">{notice}</p>}
  </div>;
}

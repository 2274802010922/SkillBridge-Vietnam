"use client";

import Link from "next/link";
import { AcceptChallenge } from "./accept-challenge";
import { AcceptInvitation } from "./accept-invitation";
import { LanguageSwitcher, useLanguage } from "../../i18n/i18n";
import { parseChallengeContent } from "../../../shared/validation/challenge-content";

type ChallengeInvite = { title: string; brief: string; content_json: string | null; reward: string; organization_name: string };

export function ChallengeInviteCopy({ token, row, valid, signedIn }: { token: string; row: ChallengeInvite | null; valid: boolean; signedIn: boolean }) {
  const { t } = useLanguage();
  const content = row ? parseChallengeContent(row.content_json, row.brief) : null;
  return <main className="auth-page"><header className="auth-header page-shell"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>SkillBridge</span></Link><div className="topbar-actions"><LanguageSwitcher /><Link className="text-link" href="/">{t("common.home")}</Link></div></header><section className="join-card"><span>{t("invite.challengeKicker")}</span><h1>{valid && row ? row.title : t("invite.invalidChallenge")}</h1>{valid && row && content && <><p><strong>{row.organization_name}</strong></p><div className="invite-challenge-summary"><p>{content.summary}</p>{content.context && <section><strong>{t("challenge.contextLabel")}</strong><p>{content.context}</p></section>}{content.objectives.length > 0 && <section><strong>{t("challenge.objectivesLabel")}</strong><ul>{content.objectives.map((item) => <li key={item}>{item}</li>)}</ul></section>}{content.deliverables.length > 0 && <section><strong>{t("challenge.deliverablesLabel")}</strong><ul>{content.deliverables.map((item) => <li key={item}>{item}</li>)}</ul></section>}</div><div className="invite-reward"><small>{t("invite.opportunity")}</small><strong>{row.reward}</strong></div>{signedIn ? <AcceptChallenge token={token} /> : <Link className="button button-primary" href={`/auth?returnTo=${encodeURIComponent(`/challenge/${token}`)}`}>{t("invite.loginChallenge")}</Link>}</>}</section></main>;
}

export function OrganizationInviteCopy({ token, signedIn }: { token: string; signedIn: boolean }) {
  const { t } = useLanguage();
  const returnTo = `/join/${encodeURIComponent(token)}`;
  return <main className="auth-page"><header className="auth-header page-shell"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>SkillBridge</span></Link><div className="topbar-actions"><LanguageSwitcher /><Link className="text-link" href="/">{t("common.home")}</Link></div></header><section className="join-card"><span>{t("invite.organizationKicker")}</span><h1>{t("invite.organizationTitle")}</h1><p>{t("invite.organizationDescription")}</p>{signedIn ? <AcceptInvitation token={token} /> : <Link className="button button-primary" href={`/auth?returnTo=${encodeURIComponent(returnTo)}`}>{t("invite.loginContinue")}</Link>}</section></main>;
}

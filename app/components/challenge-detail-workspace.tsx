"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { parseChallengeContent, type ChallengeContent } from "../../lib/challenge-content";
import { translateStatus, useLanguage } from "./i18n";

type ChallengeDetail = {
  id: string;
  title: string;
  brief: string;
  content_json: string | null;
  skills_json: string;
  reward: string;
  reward_type: "usdc" | "sol" | "badge";
  reward_metadata_json: string;
  reward_slots: number;
  minimum_score: string;
  reward_amount_usdc: string | null;
  access_type: "public" | "invite_only";
  status: string;
  organization_name: string;
  reviewer_organization_name: string | null;
  review_mode: "self" | "independent" | null;
  closes_at: string | null;
  published_at: string | null;
};

function parseSkills(value: string) { try { return JSON.parse(value) as string[]; } catch { return []; } }
function badgeName(value: ChallengeDetail) { try { return (JSON.parse(value.reward_metadata_json) as { name?: string }).name || value.reward; } catch { return value.reward; } }
function formatDate(value: string | null, locale: string) { if (!value) return "—"; try { return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", { dateStyle: "medium" }).format(new Date(value)); } catch { return value; } }

function ContentSection({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return <section className="challenge-detail-section"><h2>{title}</h2>{items.length > 0 ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="challenge-detail-empty">{empty}</p>}</section>;
}

export function ChallengeDetailWorkspace({ challengeId }: { challengeId: string }) {
  const { t, locale } = useLanguage();
  const [challenge, setChallenge] = useState<ChallengeDetail | null>(null);
  const [content, setContent] = useState<ChallengeContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/challenges/${challengeId}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { challenge?: ChallengeDetail; error?: string };
        if (!response.ok || !data.challenge) throw new Error(data.error || t("challenge.detailLoadError"));
        if (active) { setChallenge(data.challenge); setContent(parseChallengeContent(data.challenge.content_json, data.challenge.brief)); }
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : t("challenge.detailLoadError")); });
    return () => { active = false; };
  }, [challengeId, t]);

  if (error) return <div id="workspace-main" tabIndex={-1} className="workspace-product-content"><p className="app-notice" role="alert">{error}</p><Link className="button button-secondary" href="/app/challenges">{t("challenge.detailBack")}</Link></div>;
  if (!challenge || !content) return <div id="workspace-main" tabIndex={-1} className="workspace-product-content"><p className="app-notice">{t("challenge.detailLoading")}</p></div>;

  const skills = parseSkills(challenge.skills_json);
  const reward = challenge.reward_type === "badge"
    ? `${t("challenge.rewardBadge")}: ${badgeName(challenge)}`
    : `${challenge.reward_amount_usdc || "0"} ${challenge.reward_type === "sol" ? t("challenge.detailSol") : "USDC"}`;

  return <div id="workspace-main" tabIndex={-1} className="workspace-product-content challenge-detail-page">
    <Link className="challenge-back-link" href="/app/challenges">← {t("challenge.detailBack")}</Link>
    <div className="app-welcome challenge-detail-heading"><div><span>{t("challenge.detailKicker")}</span><h1>{challenge.title}</h1><p>{content.summary}</p></div><div className="identity-card"><small>{t("challenge.detailStatus")}</small><strong>{translateStatus(t, challenge.status)}</strong><b>{challenge.access_type === "public" ? t("challenge.public") : t("challenge.inviteOnly")}</b></div></div>
    <div className="challenge-detail-layout">
      <article className="app-panel challenge-detail-content"><div className="entity-top"><span>{challenge.organization_name}</span><b>{challenge.review_mode === "self" ? t("challenge.reviewInternal") : t("challenge.reviewIndependentLabel")}</b></div><div className={`challenge-review-provenance ${challenge.review_mode === "self" ? "internal" : "independent"}`}><span>{t("challenge.detailReviewer")}</span><strong>{challenge.reviewer_organization_name || challenge.organization_name}</strong></div><section className="challenge-detail-section challenge-detail-overview"><h2>{t("challenge.detailOverview")}</h2><p>{content.context || content.summary}</p></section><ContentSection title={t("challenge.detailObjectives")} items={content.objectives} empty={t("challenge.detailNoItems")} /><ContentSection title={t("challenge.detailDeliverables")} items={content.deliverables} empty={t("challenge.detailNoItems")} /><ContentSection title={t("challenge.detailConstraints")} items={content.constraints} empty={t("challenge.detailNoItems")} /></article>
      <aside className="challenge-detail-sidebar"><section className="app-panel challenge-fact-card"><span className="panel-kicker">{t("challenge.detailFacts")}</span><dl><div><dt>{t("challenge.detailReward")}</dt><dd>{reward}</dd></div><div><dt>{t("challenge.rewardSlots")}</dt><dd>{challenge.reward_slots}</dd></div><div><dt>{t("challenge.minimumScore")}</dt><dd>{challenge.minimum_score}/100</dd></div><div><dt>{t("challenge.timelineLabel")}</dt><dd>{content.timeline || t("challenge.notSpecified")}</dd></div><div><dt>{t("challenge.detailCloses")}</dt><dd>{formatDate(challenge.closes_at, locale)}</dd></div></dl></section><section className="app-panel challenge-fact-card"><span className="panel-kicker">{t("challenge.skillsLabel")}</span><div className="entity-tags">{skills.map((skill) => <span key={skill}>{skill}</span>)}</div></section></aside>
    </div>
  </div>;
}

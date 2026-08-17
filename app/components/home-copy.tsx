"use client";

import { useRef } from "react";
import { LanguageSwitcher, useLanguage } from "./i18n";
import { ProofConstellation } from "./proof-constellation";
import { useScrollReveal } from "./scroll-reveal";

const proofSignals = [
  ["01", "home.humanReview", "home.aiOptional"],
  ["02", "home.networkEvidence", "home.evidenceLinked"],
  ["03", "home.solanaProofTitle", "home.metricCredentials"],
  ["04", "home.networkPayout", "home.metricPayouts"],
] as const;

const problems = [
  ["01", "home.roleStudent", "home.problemStudent"],
  ["02", "home.roleBusiness", "home.problemBusiness"],
  ["03", "home.roleUniversity", "home.problemUniversity"],
] as const;

const flowNodes = [
  ["01", "home.networkEvidence", "home.evidenceLinked"],
  ["02", "home.networkAssessment", "home.aiOptional"],
  ["03", "home.networkApproval", "home.humanApproved"],
  ["04", "home.networkCredential", "home.metricCredentials"],
  ["05", "home.networkPayout", "home.metricPayouts"],
] as const;

const capabilityGroups = [
  ["01", "home.featureChallenges", "home.featureChallengesDescription", "home.featureEvidence", "home.featureEvidenceDescription"],
  ["02", "home.featureAssessment", "home.featureAssessmentDescription", "home.featureCredential", "home.featureCredentialDescription"],
  ["03", "home.featureTalent", "home.featureTalentDescription", "home.featurePayments", "home.featurePaymentsDescription"],
] as const;

const roles = [
  ["01", "home.roleStudent", "home.roleStudentDescription", "home.start", "/auth"],
  ["02", "home.roleBusiness", "home.roleBusinessDescription", "home.navProduct", "/auth"],
  ["03", "home.roleUniversity", "home.roleUniversityDescription", "home.trustArchitecture", "#trust"],
] as const;

export function HomeCopy() {
  const { t } = useLanguage();
  const landingRef = useRef<HTMLElement>(null);
  useScrollReveal(landingRef);

  return (
    <main className="landing-home" id="top" ref={landingRef}>
      <a className="landing-skip-link" href="#landing-content">
        {t("home.skipContent")}
      </a>
      <div className="landing-hero-wrap">
      <header className="site-header landing-header page-shell">
        <a className="wordmark" href="#top" aria-label="SkillBridge Vietnam">
          <span className="wordmark-mark" aria-hidden="true">S</span>
          <span>SkillBridge</span>
          <small>VIETNAM</small>
        </a>
        <nav aria-label={t("home.navHow")}>
          <a href="#product">{t("home.navProduct")}</a>
          <a href="#flow">{t("home.navFlow")}</a>
          <a href="#roles">{t("home.navRoles")}</a>
          <a href="#trust">{t("home.navHow")}</a>
        </nav>
        <div className="topbar-actions">
          <a className="header-cta" href="/auth">{t("home.login")}</a>
          <LanguageSwitcher />
        </div>
      </header>

      <section className="landing-hero landing-hero-immersive" id="landing-content" tabIndex={-1}>
        <div className="landing-hero-scene"><ProofConstellation /></div>
        <div className="page-shell landing-hero-inner">
          <div className="landing-hero-copy" data-reveal="hero-copy">
            <div className="eyebrow"><span /> {t("home.eyebrow")}</div>
            <h1 data-reveal="title" data-reveal-delay="70">{t("home.heroTitle")}</h1>
            <p>{t("home.heroDescription")}</p>
            <div className="landing-hero-actions">
              <a className="button button-primary" href="/auth">{t("home.start")}</a>
              <a className="text-link" href="#flow">{t("home.navFlow")} <span aria-hidden="true">↓</span></a>
            </div>
            <p className="landing-network-note"><span aria-hidden="true" /> {t("home.networkLive")}</p>
          </div>
          <div className="landing-hero-proof-note" data-reveal="hero-note" data-reveal-delay="140">
            <span>{t("home.cardProof")}</span>
            <strong>{t("home.cardVerified")}</strong>
            <small>{t("home.humanApproved")} · {t("home.evidenceLinked")}</small>
          </div>
          <div className="landing-hero-meta" data-reveal="meta" data-reveal-delay="260" aria-hidden="true">
            <span>SKILLBRIDGE / VIETNAM</span><span>SOLANA DEVNET</span><span>PROOF-TO-PAYOUT</span><span>SCROLL ↓</span>
          </div>
        </div>
      </section>
      </div>

      <section className="landing-signal-band" aria-label={t("home.trustArchitecture")}>
        <div className="page-shell landing-signal-grid">
          {proofSignals.map(([number, titleKey, detailKey]) => (
            <div className="landing-signal" data-reveal="signal" data-reveal-delay={`${Number(number) * 55}`} key={number}><span>{number}</span><div><strong>{t(titleKey)}</strong><small>{t(detailKey)}</small></div></div>
          ))}
        </div>
        <div className="landing-signal-marquee" aria-hidden="true">
          <div>
            <span>{t("home.humanApproved")}</span><i>+</i><span>{t("home.evidenceLinked")}</span><i>+</i><span>{t("home.solanaProofTitle")}</span><i>+</i><span>{t("home.networkPayout")}</span><i>+</i>
            <span>{t("home.humanApproved")}</span><i>+</i><span>{t("home.evidenceLinked")}</span><i>+</i><span>{t("home.solanaProofTitle")}</span><i>+</i><span>{t("home.networkPayout")}</span><i>+</i>
          </div>
        </div>
      </section>

      <section className="landing-editorial page-shell" id="product">
        <div className="landing-section-heading" data-reveal="heading">
          <div><div className="eyebrow"><span /> {t("home.problemEyebrow")}</div><h2 data-reveal="title" data-reveal-delay="70">{t("home.problemTitle")}</h2></div>
          <p>{t("home.problemDescription")}</p>
        </div>
        <div className="landing-problem-list">
          {problems.map(([number, roleKey, problemKey]) => (
            <article data-reveal="card" data-reveal-delay={`${Number(number) * 70}`} key={number}><span>{number}</span><h3>{t(roleKey)}</h3><p>{t(problemKey)}</p></article>
          ))}
        </div>
      </section>

      <section className="landing-flow-section" id="flow">
        <div className="page-shell landing-flow-layout">
          <div className="landing-flow-copy" data-reveal="heading">
            <div className="eyebrow"><span /> {t("home.flowEyebrow")}</div>
            <h2 data-reveal="title" data-reveal-delay="70">{t("home.flowTitle")}</h2>
            <p>{t("home.flowDescription")}</p>
            <div className="landing-flow-guardrails"><span>{t("home.noPii")}</span><span>{t("home.aiOptional")}</span></div>
          </div>
          <ol className="landing-flow-rail">
            {flowNodes.map(([number, titleKey, detailKey]) => (
              <li data-reveal="flow" data-reveal-delay={`${Number(number) * 70}`} key={number}><span>{number}</span><div><strong>{t(titleKey)}</strong><small>{t(detailKey)}</small></div></li>
            ))}
          </ol>
        </div>
      </section>

      <section className="landing-capabilities page-shell">
        <div className="landing-section-heading" data-reveal="heading">
          <div><div className="eyebrow"><span /> {t("home.featuresEyebrow")}</div><h2 data-reveal="title" data-reveal-delay="70">{t("home.featuresTitle")}</h2></div>
          <p>{t("home.featuresDescription")}</p>
        </div>
        <div className="landing-capability-grid" data-reveal="panel" data-reveal-delay="130">
          {capabilityGroups.map(([number, titleKey, descriptionKey, supportingTitleKey, supportingDescriptionKey]) => (
            <article data-reveal="card" data-reveal-delay={`${Number(number) * 80}`} key={number}>
              <span className="landing-capability-index">{number}</span>
              <div className="landing-capability-primary"><h3>{t(titleKey)}</h3><p>{t(descriptionKey)}</p></div>
              <div className="landing-capability-support"><strong>{t(supportingTitleKey)}</strong><p>{t(supportingDescriptionKey)}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-roles page-shell" id="roles">
        <div className="landing-roles-intro" data-reveal="heading"><div className="eyebrow"><span /> {t("home.rolesEyebrow")}</div><h2 data-reveal="title" data-reveal-delay="70">{t("home.rolesTitle")}</h2></div>
        <div className="landing-role-list">
          {roles.map(([number, titleKey, descriptionKey, actionKey, href]) => (
            <article data-reveal="card" data-reveal-delay={`${Number(number) * 75}`} key={number}><span>{number}</span><div><h3>{t(titleKey)}</h3><p>{t(descriptionKey)}</p></div><a href={href} aria-label={`${t(actionKey)} — ${t(titleKey)}`}>↗</a></article>
          ))}
        </div>
      </section>

      <section className="landing-trust" id="trust">
        <div className="page-shell">
          <div className="landing-section-heading" data-reveal="heading"><div><div className="eyebrow"><span /> {t("home.trustEyebrow")}</div><h2 data-reveal="title" data-reveal-delay="70">{t("home.trustTitle")}</h2></div><p>{t("home.trustDescription")}</p></div>
          <div className="landing-trust-grid">
            <article data-reveal="card" data-reveal-delay="70"><span>AI</span><h3>{t("home.assessmentContract")}</h3><p>{t("home.assessmentDescription")}</p><small>{t("home.aiOptional")}</small></article>
            <article data-reveal="card" data-reveal-delay="140"><span>H</span><h3>{t("home.humanReview")}</h3><p>{t("home.humanDescription")}</p><small>{t("home.auditAppeal")}</small></article>
            <article data-reveal="card" data-reveal-delay="210"><span>S</span><h3>{t("home.solanaProofTitle")}</h3><p>{t("home.solanaDescription")}</p><small>{t("home.noPii")}</small></article>
            <article className="landing-trust-outcome" data-reveal="card" data-reveal-delay="280"><span>↗</span><h3>{t("home.accessTitle")}</h3><p>{t("home.accessDescription")}</p><small>{t("home.verifyLoop")}</small></article>
          </div>
        </div>
      </section>

      <section className="landing-pilot page-shell" id="pilot">
        <div data-reveal="heading"><div className="eyebrow"><span /> {t("home.pilotEyebrow")}</div><h2 data-reveal="title" data-reveal-delay="70">{t("home.pilotTitle")}</h2></div>
        <div data-reveal="copy" data-reveal-delay="140"><p>{t("home.pilotDescription")}</p><a className="button button-dark" href="mailto:pilot@skillbridge.vn">{t("home.designPartner")}</a></div>
      </section>

      <footer className="site-footer landing-footer page-shell"><div className="wordmark"><span className="wordmark-mark">S</span><span>SkillBridge</span></div><p>{t("home.footerTagline")} <a href="/privacy">{t("home.data")}</a> · <a href="/terms">{t("home.terms")}</a> · <a href="/risk">{t("home.risk")}</a></p><span>{t("home.builtFor")}</span></footer>
    </main>
  );
}

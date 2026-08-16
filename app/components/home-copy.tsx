"use client";

import { LanguageSwitcher, useLanguage } from "./i18n";

const flowNodes = [
  ["01", "home.networkEvidence", "FILE HASHED"],
  ["02", "home.networkAssessment", "AI OPTIONAL"],
  ["03", "home.networkApproval", "HUMAN DECISION"],
  ["04", "home.networkCredential", "DEVNET PROOF"],
  ["05", "home.networkPayout", "DIRECT SETTLEMENT"],
] as const;

const featureCards = [
  ["01", "home.featureChallenges", "home.featureChallengesDescription"],
  ["02", "home.featureEvidence", "home.featureEvidenceDescription"],
  ["03", "home.featureAssessment", "home.featureAssessmentDescription"],
  ["04", "home.featureCredential", "home.featureCredentialDescription"],
  ["05", "home.featureTalent", "home.featureTalentDescription"],
  ["06", "home.featurePayments", "home.featurePaymentsDescription"],
] as const;

const problems = [
  ["01", "home.problemStudent"],
  ["02", "home.problemBusiness"],
  ["03", "home.problemUniversity"],
] as const;

export function HomeCopy() {
  const { t } = useLanguage();

  return (
    <main>
      <header className="site-header page-shell">
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
          <a href="#pilot">{t("home.navPilot")}</a>
        </nav>
        <div className="topbar-actions">
          <a className="header-cta" href="/auth">{t("home.login")}</a>
          <LanguageSwitcher />
        </div>
      </header>

      <section className="hero page-shell" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span /> {t("home.eyebrow")}</div>
          <h1>{t("home.heroTitle")}</h1>
          <p className="hero-lede">{t("home.heroDescription")}</p>
          <div className="hero-actions">
            <a className="button button-primary" href="/auth">{t("home.start")}</a>
            <a className="text-link" href="#trust">{t("home.trustArchitecture")}</a>
          </div>
          <div className="hero-proof" aria-label={t("home.trustArchitecture")}>
            <span>{t("home.aiEvidence")}</span>
            <span>{t("home.humanLoop")}</span>
            <span>{t("home.solanaProof")}</span>
          </div>
        </div>
        <div className="hero-object" aria-label={t("home.heroTitle")}>
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="proof-card proof-card-main">
            <div className="card-kicker">{t("home.cardProof")}</div>
            <div className="score-ring"><strong>✓</strong><span>{t("home.cardVerified")}</span></div>
            <h2>{t("home.cardScore")}</h2>
            <p>{t("home.cardChallenge")}</p>
            <div className="proof-meta"><span>{t("home.humanApproved")}</span><span>{t("home.evidenceLinked")}</span></div>
          </div>
          <div className="proof-card proof-card-mini top"><span className="mini-icon">01</span><div><strong>{t("home.cardBuild")}</strong><small>{t("home.build")}</small></div></div>
          <div className="proof-card proof-card-mini bottom"><span className="mini-icon accent">02</span><div><strong>{t("home.cardUnlock")}</strong><small>{t("home.unlock")}</small></div></div>
        </div>
      </section>

      <section className="trust-strip">
        <div className="page-shell trust-steps">
          {[["01", t("home.learnLabel"), t("home.learn")], ["02", t("home.buildLabel"), t("home.buildStep")], ["03", t("home.proveLabel"), t("home.prove")], ["04", t("home.unlockLabel"), t("home.unlockStep")]].map(([number, label, detail]) => (
            <div className="trust-step" key={number}><span>{number}</span><div><strong>{label}</strong><small>{detail}</small></div></div>
          ))}
        </div>
      </section>

      <section className="problem-section page-shell" id="product">
        <div className="section-heading">
          <div><div className="eyebrow"><span /> {t("home.problemEyebrow")}</div><h2>{t("home.problemTitle")}</h2></div>
          <p>{t("home.problemDescription")}</p>
        </div>
        <div className="problem-grid">
          {problems.map(([number, key]) => <article className="problem-card" key={number}><span className="problem-index">{number}</span><p>{t(key)}</p></article>)}
        </div>
      </section>

      <section className="proof-network-section page-shell" id="flow">
        <div className="network-heading">
          <div><div className="eyebrow"><span /> {t("home.flowEyebrow")}</div><h2>{t("home.flowTitle")}</h2></div>
          <p>{t("home.flowDescription")}</p>
        </div>
        <div className="network-console">
          <div className="network-console-top"><span className="network-live"><i />{t("home.networkLive")}</span><span className="network-console-id">SKILLBRIDGE / PRODUCT FLOW</span></div>
          <div className="network-flow" aria-label={t("home.flowTitle")}>
            {flowNodes.map(([number, key, value], index) => <div className="network-node" key={number}><span>{number}</span><div><small>{t(key)}</small><strong>{value}</strong></div>{index < flowNodes.length - 1 && <b aria-hidden="true">→</b>}</div>)}
          </div>
          <div className="network-console-foot"><span>{t("home.noPii")}</span><span>{t("home.evidenceLinked")}</span><span>{t("home.aiOptional")}</span></div>
        </div>
        <div className="network-metrics"><div><strong>READY</strong><span>{t("home.metricChallenges")}</span></div><div><strong>DEVNET</strong><span>{t("home.metricCredentials")}</span></div><div><strong>HASHED</strong><span>{t("home.metricProofs")}</span></div><div><strong>DIRECT</strong><span>{t("home.metricPayouts")}</span></div></div>
      </section>

      <section className="product-features-section page-shell">
        <div className="section-heading">
          <div><div className="eyebrow"><span /> {t("home.featuresEyebrow")}</div><h2>{t("home.featuresTitle")}</h2></div>
          <p>{t("home.featuresDescription")}</p>
        </div>
        <div className="feature-grid">
          {featureCards.map(([number, titleKey, descriptionKey]) => <article className="feature-card" key={number}><span className="feature-index">{number}</span><h3>{t(titleKey)}</h3><p>{t(descriptionKey)}</p></article>)}
        </div>
      </section>

      <section className="roles-section page-shell" id="roles">
        <div className="section-heading"><div><div className="eyebrow"><span /> {t("home.rolesEyebrow")}</div><h2>{t("home.rolesTitle")}</h2></div></div>
        <div className="role-grid"><article><span className="role-index">01</span><h3>{t("home.roleStudent")}</h3><p>{t("home.roleStudentDescription")}</p><a className="text-link" href="/auth">{t("home.start")}</a></article><article><span className="role-index">02</span><h3>{t("home.roleBusiness")}</h3><p>{t("home.roleBusinessDescription")}</p><a className="text-link" href="/auth">{t("home.navProduct")}</a></article><article><span className="role-index">03</span><h3>{t("home.roleUniversity")}</h3><p>{t("home.roleUniversityDescription")}</p><a className="text-link" href="#trust">{t("home.trustArchitecture")}</a></article></div>
      </section>

      <section className="trust-architecture" id="trust">
        <div className="page-shell">
          <div className="section-heading light"><div><div className="eyebrow"><span /> {t("home.trustEyebrow")}</div><h2>{t("home.trustTitle")}</h2></div><p>{t("home.trustDescription")}</p></div>
          <div className="architecture-grid"><article><span>AI</span><h3>{t("home.assessmentContract")}</h3><p>{t("home.assessmentDescription")}</p><small>{t("home.aiOptional")}</small></article><article><span>H</span><h3>{t("home.humanReview")}</h3><p>{t("home.humanDescription")}</p><small>{t("home.auditAppeal")}</small></article><article><span>S</span><h3>{t("home.solanaProofTitle")}</h3><p>{t("home.solanaDescription")}</p><small>{t("home.noPii")}</small></article><article className="architecture-outcome"><span>↗</span><h3>{t("home.accessTitle")}</h3><p>{t("home.accessDescription")}</p><small>{t("home.verifyLoop")}</small></article></div>
        </div>
      </section>

      <section className="pilot-section page-shell" id="pilot"><div className="pilot-card"><div><div className="eyebrow"><span /> {t("home.pilotEyebrow")}</div><h2>{t("home.pilotTitle")}</h2></div><div className="pilot-copy"><p>{t("home.pilotDescription")}</p><a className="button button-dark" href="mailto:pilot@skillbridge.vn">{t("home.designPartner")}</a></div></div></section>

      <footer className="site-footer page-shell"><div className="wordmark"><span className="wordmark-mark">S</span><span>SkillBridge</span></div><p>{t("home.footerTagline")} <a href="/privacy">{t("home.data")}</a> · <a href="/terms">{t("home.terms")}</a> · <a href="/risk">{t("home.risk")}</a></p><span>{t("home.builtFor")}</span></footer>
    </main>
  );
}

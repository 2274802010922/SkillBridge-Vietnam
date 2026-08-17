"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { LanguageSwitcher, useLanguage } from "./i18n";
import { K95StageCanvas } from "./3d/k95-stage-canvas";
import { K95Cursor } from "./ui/k95-cursor";
import { K95BootLoader } from "./ui/k95-boot-loader";
import { KineticText } from "./ui/kinetic-text";
import { useSmoothScroll } from "./ui/use-smooth-scroll";
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
  const { t, locale } = useLanguage();
  const isEn = locale === "en";
  const landingRef = useRef<HTMLElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useScrollReveal(landingRef);
  useSmoothScroll();

  return (
    <>
      <K95BootLoader />
      <K95Cursor />

      <main className="landing-home k95-landing" id="top" ref={landingRef}>
        <a className="landing-skip-link" href="#landing-content">
          {t("home.skipContent")}
        </a>

        {/* K95 TOPBAR / NAVBAR */}
        <div className="landing-hero-wrap">
          <header className="site-header landing-header page-shell k95-header">
            <Link className="wordmark k95-wordmark" href="#top" aria-label="SkillBridge Vietnam" data-hover>
              <span className="wordmark-mark k95-logo-badge" aria-hidden="true">SB</span>
              <span className="k95-brand-title">SkillBridge</span>
              <small className="k95-brand-sub">VIETNAM</small>
            </Link>

            <nav className="k95-desktop-nav" aria-label={t("home.navHow")}>
              <a href="#product" className="k95-nav-link" data-hover>
                <KineticText text={t("home.navProduct")} />
              </a>
              <a href="#flow" className="k95-nav-link" data-hover>
                <KineticText text={t("home.navFlow")} />
              </a>
              <a href="#roles" className="k95-nav-link" data-hover>
                <KineticText text={t("home.navRoles")} />
              </a>
              <a href="#trust" className="k95-nav-link" data-hover>
                <KineticText text={t("home.navHow")} />
              </a>
            </nav>

            <div className="topbar-actions k95-actions">
              <Link className="header-cta k95-pill-cta" href="/auth" data-hover>
                <KineticText text={t("home.login")} />
              </Link>
              <LanguageSwitcher />

              {/* Mobile Menu Trigger */}
              <button
                type="button"
                className={`k95-mobile-menu-btn ${mobileMenuOpen ? "is-open" : ""}`}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle navigation"
                data-hover
              >
                <span className="k95-menu-icon" aria-hidden="true" />
                <span>{mobileMenuOpen ? (isEn ? "CLOSE" : "ĐÓNG") : "MENU"}</span>
              </button>
            </div>
          </header>

          {/* FULLSCREEN FROSTED MOBILE MENU */}
          {mobileMenuOpen && (
            <div className="k95-mobile-overlay" onClick={() => setMobileMenuOpen(false)}>
              <nav className="k95-mobile-nav" onClick={(e) => e.stopPropagation()}>
                <a href="#product" className="k95-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                  {t("home.navProduct")}
                </a>
                <a href="#flow" className="k95-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                  {t("home.navFlow")}
                </a>
                <a href="#roles" className="k95-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                  {t("home.navRoles")}
                </a>
                <a href="#trust" className="k95-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                  {t("home.navHow")}
                </a>
                <Link href="/auth" className="k95-mobile-link k95-mobile-cta" onClick={() => setMobileMenuOpen(false)}>
                  {t("home.login")} ↗
                </Link>
              </nav>
            </div>
          )}

          {/* K95 HERO SECTION WITH 3D WEBGL STAGE */}
          <section className="landing-hero landing-hero-immersive k95-hero" id="landing-content" tabIndex={-1}>
            {/* 3D WebGL Orbit Canvas */}
            <div className="landing-hero-scene k95-hero-scene">
              <K95StageCanvas isEn={isEn} />
            </div>

            <div className="page-shell landing-hero-inner k95-hero-inner">
              <div className="landing-hero-copy k95-hero-copy" data-reveal="hero-copy">
                <div className="eyebrow k95-eyebrow">
                  <span className="k95-pulse-dot" /> {t("home.eyebrow")}
                </div>
                <h1 className="k95-hero-heading" data-reveal-title>
                  {t("home.heroTitle")}
                </h1>
                <p className="k95-hero-lead">{t("home.heroDescription")}</p>

                <div className="landing-hero-actions k95-hero-actions">
                  <Link className="button button-primary k95-btn-primary" href="/auth" data-hover>
                    <KineticText text={t("home.start")} />
                  </Link>
                  <a className="text-link k95-link-secondary" href="#flow" data-hover>
                    <span>{t("home.navFlow")}</span> <span aria-hidden="true">↓</span>
                  </a>
                </div>

                <p className="landing-network-note k95-network-live">
                  <span className="k95-live-indicator" aria-hidden="true" />
                  {t("home.networkLive")}
                </p>
              </div>

              <div className="landing-hero-proof-note k95-proof-badge" data-reveal="hero-note" data-reveal-delay="140">
                <span>{t("home.cardProof")}</span>
                <strong>{t("home.cardVerified")}</strong>
                <small>{t("home.humanApproved")} · {t("home.evidenceLinked")}</small>
              </div>

              <div className="landing-hero-meta k95-meta-bar" data-reveal="meta" data-reveal-delay="260" aria-hidden="true">
                <span>SKILLBRIDGE / VIETNAM</span>
                <span>SOLANA DEVNET</span>
                <span>PROOF-TO-PAYOUT</span>
                <span>DRAG & SCROLL 3D ↓</span>
              </div>
            </div>
          </section>
        </div>

        {/* K95 SIGNAL BAND MARQUEE */}
        <section className="landing-signal-band k95-signal-band" aria-label={t("home.trustArchitecture")}>
          <div className="page-shell landing-signal-grid k95-signal-grid">
            {proofSignals.map(([number, titleKey, detailKey]) => (
              <div className="landing-signal k95-signal-card" data-reveal="signal" data-reveal-delay={`${Number(number) * 55}`} key={number} data-hover>
                <span className="k95-signal-index">[{number}]</span>
                <div>
                  <strong>{t(titleKey)}</strong>
                  <small>{t(detailKey)}</small>
                </div>
              </div>
            ))}
          </div>

          <div className="landing-signal-marquee k95-marquee" aria-hidden="true">
            <div className="k95-marquee-content">
              <span>{t("home.humanApproved")}</span><i>+</i>
              <span>{t("home.evidenceLinked")}</span><i>+</i>
              <span>{t("home.solanaProofTitle")}</span><i>+</i>
              <span>{t("home.networkPayout")}</span><i>+</i>
              <span>{t("home.humanApproved")}</span><i>+</i>
              <span>{t("home.evidenceLinked")}</span><i>+</i>
              <span>{t("home.solanaProofTitle")}</span><i>+</i>
              <span>{t("home.networkPayout")}</span><i>+</i>
            </div>
          </div>
        </section>

        {/* EDITORIAL / PROBLEM SECTION */}
        <section className="landing-editorial page-shell k95-editorial" id="product">
          <div className="landing-section-heading k95-section-heading" data-reveal="heading">
            <div>
              <div className="eyebrow k95-eyebrow"><span /> {t("home.problemEyebrow")}</div>
              <h2 data-reveal-title className="k95-section-title">{t("home.problemTitle")}</h2>
            </div>
            <p className="k95-section-desc">{t("home.problemDescription")}</p>
          </div>

          <div className="landing-problem-list k95-problem-grid">
            {problems.map(([number, roleKey, problemKey]) => (
              <article className="k95-card" data-reveal="card" data-reveal-delay={`${Number(number) * 70}`} key={number} data-hover>
                <span className="k95-card-num">[{number}]</span>
                <h3>{t(roleKey)}</h3>
                <p>{t(problemKey)}</p>
              </article>
            ))}
          </div>
        </section>

        {/* 5-STEP PROOF-TO-PAYOUT FLOW */}
        <section className="landing-flow-section k95-flow-section" id="flow">
          <div className="page-shell landing-flow-layout k95-flow-layout">
            <div className="landing-flow-copy k95-flow-copy" data-reveal="heading">
              <div className="eyebrow k95-eyebrow"><span /> {t("home.flowEyebrow")}</div>
              <h2 data-reveal-title className="k95-section-title">{t("home.flowTitle")}</h2>
              <p className="k95-section-desc">{t("home.flowDescription")}</p>
              <div className="landing-flow-guardrails k95-guardrails">
                <span>{t("home.noPii")}</span>
                <span>{t("home.aiOptional")}</span>
              </div>
            </div>

            <ol className="landing-flow-rail k95-flow-rail">
              {flowNodes.map(([number, titleKey, detailKey]) => (
                <li className="k95-flow-step" data-reveal="flow" data-reveal-delay={`${Number(number) * 70}`} key={number} data-hover>
                  <span className="k95-flow-index">[{number}]</span>
                  <div className="k95-flow-info">
                    <strong>{t(titleKey)}</strong>
                    <small>{t(detailKey)}</small>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* CAPABILITIES GRID */}
        <section className="landing-capabilities page-shell k95-capabilities">
          <div className="landing-section-heading k95-section-heading" data-reveal="heading">
            <div>
              <div className="eyebrow k95-eyebrow"><span /> {t("home.featuresEyebrow")}</div>
              <h2 data-reveal-title className="k95-section-title">{t("home.featuresTitle")}</h2>
            </div>
            <p className="k95-section-desc">{t("home.featuresDescription")}</p>
          </div>

          <div className="landing-capability-grid k95-capability-grid" data-reveal-panel>
            {capabilityGroups.map(([number, titleKey, descriptionKey, supportingTitleKey, supportingDescriptionKey]) => (
              <article className="k95-capability-card" data-reveal="card" data-reveal-delay={`${Number(number) * 80}`} key={number} data-hover>
                <span className="landing-capability-index k95-cap-index">[{number}]</span>
                <div className="landing-capability-primary">
                  <h3>{t(titleKey)}</h3>
                  <p>{t(descriptionKey)}</p>
                </div>
                <div className="landing-capability-support k95-cap-support">
                  <strong>{t(supportingTitleKey)}</strong>
                  <p>{t(supportingDescriptionKey)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ROLES SECTION */}
        <section className="landing-roles page-shell k95-roles" id="roles">
          <div className="landing-roles-intro k95-section-heading" data-reveal="heading">
            <div className="eyebrow k95-eyebrow"><span /> {t("home.rolesEyebrow")}</div>
            <h2 data-reveal-title className="k95-section-title">{t("home.rolesTitle")}</h2>
          </div>

          <div className="landing-role-list k95-role-grid">
            {roles.map(([number, titleKey, descriptionKey, actionKey, href]) => (
              <article className="k95-role-card" data-reveal="card" data-reveal-delay={`${Number(number) * 75}`} key={number} data-hover>
                <span className="k95-role-num">[{number}]</span>
                <div className="k95-role-content">
                  <h3>{t(titleKey)}</h3>
                  <p>{t(descriptionKey)}</p>
                </div>
                <Link href={href} className="k95-role-arrow" aria-label={`${t(actionKey)} — ${t(titleKey)}`} data-hover>
                  ↗
                </Link>
              </article>
            ))}
          </div>
        </section>

        {/* TRUST ARCHITECTURE */}
        <section className="landing-trust k95-trust" id="trust">
          <div className="page-shell">
            <div className="landing-section-heading k95-section-heading" data-reveal="heading">
              <div>
                <div className="eyebrow k95-eyebrow"><span /> {t("home.trustEyebrow")}</div>
                <h2 data-reveal-title className="k95-section-title">{t("home.trustTitle")}</h2>
              </div>
              <p className="k95-section-desc">{t("home.trustDescription")}</p>
            </div>

            <div className="landing-trust-grid k95-trust-grid">
              <article className="k95-trust-card" data-reveal="card" data-reveal-delay="70" data-hover>
                <span className="k95-trust-tag">AI</span>
                <h3>{t("home.assessmentContract")}</h3>
                <p>{t("home.assessmentDescription")}</p>
                <small>{t("home.aiOptional")}</small>
              </article>

              <article className="k95-trust-card" data-reveal="card" data-reveal-delay="140" data-hover>
                <span className="k95-trust-tag">H</span>
                <h3>{t("home.humanReview")}</h3>
                <p>{t("home.humanDescription")}</p>
                <small>{t("home.auditAppeal")}</small>
              </article>

              <article className="k95-trust-card" data-reveal="card" data-reveal-delay="210" data-hover>
                <span className="k95-trust-tag">S</span>
                <h3>{t("home.solanaProofTitle")}</h3>
                <p>{t("home.solanaDescription")}</p>
                <small>{t("home.noPii")}</small>
              </article>

              <article className="landing-trust-outcome k95-trust-card k95-trust-outcome" data-reveal="card" data-reveal-delay="280" data-hover>
                <span className="k95-trust-tag">↗</span>
                <h3>{t("home.accessTitle")}</h3>
                <p>{t("home.accessDescription")}</p>
                <small>{t("home.verifyLoop")}</small>
              </article>
            </div>
          </div>
        </section>

        {/* PILOT SECTION */}
        <section className="landing-pilot page-shell k95-pilot" id="pilot">
          <div data-reveal="heading" className="k95-pilot-head">
            <div className="eyebrow k95-eyebrow"><span /> {t("home.pilotEyebrow")}</div>
            <h2 data-reveal-title className="k95-pilot-title">{t("home.pilotTitle")}</h2>
          </div>

          <div data-reveal="copy" data-reveal-delay="140" className="k95-pilot-body">
            <p>{t("home.pilotDescription")}</p>
            <a className="button button-dark k95-btn-dark" href="mailto:pilot@skillbridge.vn" data-hover>
              <KineticText text={t("home.designPartner")} />
            </a>
          </div>
        </section>

        {/* K95 FOOTER */}
        <footer className="site-footer landing-footer page-shell k95-footer">
          <div className="k95-footer-col k95-footer-left">
            <span className="k95-tabular-line">BRAND & PROOF-OF-SKILL PLATFORM</span>
          </div>

          <div className="k95-footer-col k95-footer-center">
            <span className="k95-tabular-line">
              07 / 07 <span className="k95-dim">VERIFIED NODES</span> · <Link href="/workspace" className="k95-footer-link" data-hover>Workspace</Link>
            </span>
          </div>

          <div className="k95-footer-col k95-footer-right">
            <span className="k95-tabular-line">© 2026 SKILLBRIDGE VIETNAM</span>
          </div>
        </footer>
      </main>
    </>
  );
}

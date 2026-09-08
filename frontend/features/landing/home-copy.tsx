"use client";

import { useState } from "react";
import Link from "next/link";
import { LanguageSwitcher, useLanguage } from "../../i18n/i18n";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const outlookMailtoUrl = `mailto:tri.2274802010922@vanlanguni.vn?subject=${encodeURIComponent(
    isEn ? "Design Partner Program Application - SkillBridge Vietnam" : "Đăng ký Đối tác Thiết kế - SkillBridge Vietnam"
  )}&body=${encodeURIComponent(
    isEn
      ? "Dear SkillBridge Vietnam Team,\n\nI am interested in becoming a Design Partner with SkillBridge Vietnam.\n\nContact Information:\n- Full Name:\n- Organization / University:\n- Phone Number:\n- Message / Goals:\n"
      : "Kính gửi Ban Phát triển SkillBridge Vietnam,\n\nTôi quan tâm đến chương trình Đối tác Thiết kế và muốn tìm hiểu chi tiết về cơ hội hợp tác.\n\nThông tin liên hệ:\n- Họ và tên:\n- Đơn vị / Trường:\n- Số điện thoại:\n- Nội dung trao đổi:\n"
  )}`;

  return (
      <main className="solana-landing" id="top">
        <a className="landing-skip-link" href="#landing-content">
          {t("home.skipContent")}
        </a>

        {/* Static, readable landing header */}
        <header className="solana-header page-shell">
          <div className="solana-header-inner">
            <Link className="solana-wordmark" href="#top" aria-label="SkillBridge Vietnam" data-hover>
              <span className="solana-logo-badge">S</span>
              <span className="solana-brand-name">SkillBridge</span>
              <span className="solana-tag">VIETNAM</span>
            </Link>

            <nav className="solana-desktop-nav" aria-label={t("home.navHow")}>
              <a href="#product" className="solana-nav-link" data-hover>
                {t("home.navProduct")}
              </a>
              <a href="#flow" className="solana-nav-link" data-hover>
                {t("home.navFlow")}
              </a>
              <a href="#roles" className="solana-nav-link" data-hover>
                {t("home.navRoles")}
              </a>
              <a href="#trust" className="solana-nav-link" data-hover>
                {t("home.navHow")}
              </a>
            </nav>

            <div className="solana-header-actions">
              <Link className="solana-btn-pill-primary" href="/auth" data-hover>
                <span>{t("home.login")}</span>
              </Link>

              <button
                type="button"
                className={`solana-mobile-menu-btn ${mobileMenuOpen ? "is-open" : ""}`}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={t(mobileMenuOpen ? "home.menuClose" : "home.menuOpen")}
                aria-controls="solana-mobile-navigation"
                aria-expanded={mobileMenuOpen}
                data-hover
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  {mobileMenuOpen ? (
                    <path d="M6 6l12 12M18 6L6 18" />
                  ) : (
                    <path d="M4 7h16M4 12h16M4 17h16" />
                  )}
                </svg>
              </button>

              <LanguageSwitcher />
            </div>
          </div>
        </header>

        {/* Mobile navigation */}
        {mobileMenuOpen && (
          <div className="solana-mobile-overlay" role="dialog" aria-modal="true" aria-label={t("home.mobileNavigation")}>
            <button
              type="button"
              className="solana-mobile-overlay__backdrop"
              aria-label={t("home.menuClose")}
              onClick={() => setMobileMenuOpen(false)}
            />
            <nav className="solana-mobile-nav" id="solana-mobile-navigation" aria-label={t("home.mobileNavigation")}>
              <a href="#product" className="solana-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                {t("home.navProduct")}
              </a>
              <a href="#flow" className="solana-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                {t("home.navFlow")}
              </a>
              <a href="#roles" className="solana-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                {t("home.navRoles")}
              </a>
              <a href="#trust" className="solana-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                {t("home.navHow")}
              </a>
              <Link href="/auth" className="solana-mobile-link solana-mobile-cta" onClick={() => setMobileMenuOpen(false)}>
                {t("home.login")}
              </Link>
            </nav>
          </div>
        )}

        {/* SOLANA-INSPIRED HERO SECTION */}
        <section className="solana-hero page-shell" id="landing-content" tabIndex={-1}>
          <div className="solana-hero-container">
            <div className="solana-hero-copy">
            <div className="solana-hero-badge">
              <span className="solana-live-dot" />
              <span>{t("home.eyebrow")}</span>
            </div>

            {/* Solana Two-Tone Headline */}
            <h1 className="solana-hero-title">
              {isEn ? (
                <>
                  Turn proven skills <br />
                  <span className="solana-title-light">into real opportunities.</span>
                </>
              ) : (
                <>
                  Kỹ năng có bằng chứng. <br />
                  <span className="solana-title-light">Cơ hội có cơ sở.</span>
                </>
              )}
            </h1>

            <p className="solana-hero-desc">
              {t("home.heroDescription")}
            </p>

            <div className="solana-hero-cta-row">
              <Link className="solana-btn-main" href="/auth" data-hover>
                <span>{t("home.start")}</span>
              </Link>
              <a className="solana-btn-secondary" href="#flow" data-hover>
                <span>{t("home.navFlow")}</span>
              </a>
            </div>

            {/* Network Note Bar */}
            <div className="solana-network-bar">
              <div className="solana-net-item">
                <span className="solana-net-label">{isEn ? "NETWORK" : "MẠNG"}</span>
                <span className="solana-net-val">Solana Devnet</span>
              </div>
              <div className="solana-net-item">
                <span className="solana-net-label">{isEn ? "JOURNEY" : "HÀNH TRÌNH"}</span>
                <span className="solana-net-val">{isEn ? "Proof-to-Payout" : "Kỹ năng đến phần thưởng"}</span>
              </div>
              <div className="solana-net-item">
                <span className="solana-net-label">{isEn ? "REVIEW" : "ĐÁNH GIÁ"}</span>
                <span className="solana-net-val">{isEn ? "Human decision · optional AI" : "Con người quyết định · AI tùy chọn"}</span>
              </div>
            </div>
            </div>

            <aside className="solana-hero-proof" aria-label={isEn ? "SkillBridge protocol" : "Quy trình SkillBridge"}>
              <div className="solana-hero-proof-bar">
                <span>SB://PROTOCOL</span>
                <span>DEVNET</span>
              </div>
              <ol>
                <li><span>01</span><strong>{isEn ? "Fund the reward vault" : "Nạp quỹ phần thưởng"}</strong></li>
                <li><span>02</span><strong>{isEn ? "Review work with evidence" : "Duyệt bài dựa trên bằng chứng"}</strong></li>
                <li><span>03</span><strong>{isEn ? "Confirm payout or credential" : "Xác nhận trả thưởng hoặc huy hiệu"}</strong></li>
              </ol>
              <p>{isEn ? "Human approval remains the final decision." : "Con người luôn là người ra quyết định cuối cùng."}</p>
            </aside>
          </div>
        </section>

        {/* 4 PROOF SIGNALS / METRIC CARDS */}
        <section className="solana-signals-section page-shell" aria-label={t("home.trustArchitecture")}>
          <div className="solana-signal-grid">
            {proofSignals.map(([number, titleKey, detailKey]) => (
              <div className="solana-signal-card" data-reveal="card" data-reveal-delay={`${Number(number) * 60}`} key={number} data-hover>
                <div className="solana-signal-top">
                  <span className="solana-signal-num">[{number}]</span>
                  <span className="solana-signal-dot" />
                </div>
                <h3 className="solana-signal-title">{t(titleKey)}</h3>
                <p className="solana-signal-sub">{t(detailKey)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 2: EDITORIAL / PROBLEM SOLVING */}
        <section className="solana-section page-shell" id="product">
          <div className="solana-section-header" data-reveal="heading">
            <span className="solana-section-tag">{t("home.problemEyebrow")}</span>
            <h2 className="solana-section-title" data-reveal-title>
              {isEn ? (
                <>Real Challenges. <span className="solana-title-light">Clear Verification.</span></>
              ) : (
                <>Vấn đề thực tế. <span className="solana-title-light">Cần một lối đi rõ ràng.</span></>
              )}
            </h2>
            <p className="solana-section-desc">{t("home.problemDescription")}</p>
          </div>

          <div className="solana-grid-3">
            {problems.map(([number, roleKey, problemKey]) => (
              <article className="solana-card" data-reveal="card" data-reveal-delay={`${Number(number) * 80}`} key={number} data-hover>
                <div className="solana-card-badge">[{number}]</div>
                <h3 className="solana-card-title">{t(roleKey)}</h3>
                <p className="solana-card-text">{t(problemKey)}</p>
              </article>
            ))}
          </div>
        </section>

        {/* SECTION 3: 5-STEP PROOF-TO-PAYOUT FLOW */}
        <section className="solana-section page-shell" id="flow">
          <div className="solana-section-header" data-reveal="heading">
            <span className="solana-section-tag">{t("home.flowEyebrow")}</span>
            <h2 className="solana-section-title" data-reveal-title>
              {isEn ? (
                <>5-Step Protocol. <span className="solana-title-light">From Submission to Payout.</span></>
              ) : (
                <>Quy trình 5 bước. <span className="solana-title-light">Từ bài làm đến thanh toán.</span></>
              )}
            </h2>
            <p className="solana-section-desc">{t("home.flowDescription")}</p>
          </div>

          <div className="solana-flow-list">
            {flowNodes.map(([number, titleKey, detailKey]) => (
              <div className="solana-flow-item" data-reveal="flow" data-reveal-delay={`${Number(number) * 70}`} key={number} data-hover>
                <div className="solana-flow-index-box">{number}</div>
                <div className="solana-flow-content">
                  <h3 className="solana-flow-title">{t(titleKey)}</h3>
                  <p className="solana-flow-desc">{t(detailKey)}</p>
                </div>
                <span className="solana-flow-status">VERIFIED</span>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 4: CAPABILITIES */}
        <section className="solana-section page-shell">
          <div className="solana-section-header" data-reveal="heading">
            <span className="solana-section-tag">{t("home.featuresEyebrow")}</span>
            <h2 className="solana-section-title" data-reveal-title>
              {isEn ? (
                <>Full Architecture. <span className="solana-title-light">Built for Reliability.</span></>
              ) : (
                <>Hạ tầng toàn diện. <span className="solana-title-light">Đảm bảo độ tin cậy tuyệt đối.</span></>
              )}
            </h2>
            <p className="solana-section-desc">{t("home.featuresDescription")}</p>
          </div>

          <div className="solana-grid-3">
            {capabilityGroups.map(([number, titleKey, descriptionKey, supportingTitleKey, supportingDescriptionKey]) => (
              <article className="solana-card solana-card--tall" data-reveal="card" data-reveal-delay={`${Number(number) * 80}`} key={number} data-hover>
                <div className="solana-card-badge">[{number}]</div>
                <h3 className="solana-card-title">{t(titleKey)}</h3>
                <p className="solana-card-text">{t(descriptionKey)}</p>
                <div className="solana-card-divider" />
                <div className="solana-card-support">
                  <strong>{t(supportingTitleKey)}</strong>
                  <p>{t(supportingDescriptionKey)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* SECTION 5: ROLES */}
        <section className="solana-section page-shell" id="roles">
          <div className="solana-section-header" data-reveal="heading">
            <span className="solana-section-tag">{t("home.rolesEyebrow")}</span>
            <h2 className="solana-section-title" data-reveal-title>
              {isEn ? (
                <>For Every Participant. <span className="solana-title-light">Students, Businesses & Schools.</span></>
              ) : (
                <>Dành cho mọi đối tượng. <span className="solana-title-light">Sinh viên, Doanh nghiệp & Nhà trường.</span></>
              )}
            </h2>
          </div>

          <div className="solana-grid-3">
            {roles.map(([number, titleKey, descriptionKey, actionKey, href]) => (
              <article className="solana-card solana-role-card" data-reveal="card" data-reveal-delay={`${Number(number) * 80}`} key={number} data-hover>
                <div className="solana-card-badge">[{number}]</div>
                <h3 className="solana-card-title">{t(titleKey)}</h3>
                <p className="solana-card-text">{t(descriptionKey)}</p>
                <div className="solana-card-bottom">
                  <Link href={href} className="solana-link-cta" data-hover>
                    <span>{t(actionKey)}</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* SECTION 6: TRUST ARCHITECTURE */}
        <section className="solana-section page-shell" id="trust">
          <div className="solana-section-header" data-reveal="heading">
            <span className="solana-section-tag">{t("home.trustEyebrow")}</span>
            <h2 className="solana-section-title" data-reveal-title>
              {isEn ? (
                <>Trust & Verification. <span className="solana-title-light">AI + Human Consensus.</span></>
              ) : (
                <>Độ tin cậy & Kiểm chứng. <span className="solana-title-light">Kết hợp AI & Đồng thuận con người.</span></>
              )}
            </h2>
            <p className="solana-section-desc">{t("home.trustDescription")}</p>
          </div>

          <div className="solana-grid-4">
            <article className="solana-card" data-reveal="card" data-reveal-delay="70" data-hover>
              <div className="solana-card-tag">AI ENGINE</div>
              <h3 className="solana-card-title">{t("home.assessmentContract")}</h3>
              <p className="solana-card-text">{t("home.assessmentDescription")}</p>
            </article>

            <article className="solana-card" data-reveal="card" data-reveal-delay="140" data-hover>
              <div className="solana-card-tag">HUMAN AUDIT</div>
              <h3 className="solana-card-title">{t("home.humanReview")}</h3>
              <p className="solana-card-text">{t("home.humanDescription")}</p>
            </article>

            <article className="solana-card" data-reveal="card" data-reveal-delay="210" data-hover>
              <div className="solana-card-tag">SOLANA DEVNET</div>
              <h3 className="solana-card-title">{t("home.solanaProofTitle")}</h3>
              <p className="solana-card-text">{t("home.solanaDescription")}</p>
            </article>

            <article className="solana-card" data-reveal="card" data-reveal-delay="280" data-hover>
              <div className="solana-card-tag">USDC PAYOUT</div>
              <h3 className="solana-card-title">{t("home.accessTitle")}</h3>
              <p className="solana-card-text">{t("home.accessDescription")}</p>
            </article>
          </div>
        </section>

        {/* SECTION 7: PILOT CALLOUT BANNER (OUTLOOK MAIL INTEGRATION) */}
        <section className="solana-pilot-section page-shell" id="pilot">
          <div className="solana-pilot-card" data-reveal="card">
            <div className="solana-pilot-left">
              <span className="solana-section-tag">{t("home.pilotEyebrow")}</span>
              <h2 className="solana-pilot-title">{t("home.pilotTitle")}</h2>
              <p className="solana-pilot-desc">{t("home.pilotDescription")}</p>
            </div>
            <div className="solana-pilot-right">
              <a className="solana-btn-main" href={outlookMailtoUrl} data-hover>
                <span>{t("home.designPartner")}</span>
              </a>
            </div>
          </div>
        </section>

        {/* FULL ORIGINAL RESTORED FOOTER — FULL BLEED EDGE-TO-EDGE */}
        <footer className="solana-footer">
          <div className="solana-footer-inner">
            <div className="solana-footer-top">
              <div className="solana-footer-brand-col">
                <Link className="solana-wordmark" href="#top" aria-label="SkillBridge Vietnam">
                  <span className="solana-logo-badge">SB</span>
                  <span className="solana-brand-name">SkillBridge</span>
                  <span className="solana-tag">SOLANA</span>
                </Link>
                <p className="solana-footer-tagline">{t("home.footerTagline")}</p>
              </div>

              <div className="solana-footer-links-col">
                <span className="solana-footer-heading">{isEn ? "LEGAL & POLICIES" : "CHÍNH SÁCH & ĐIỀU KHOẢN"}</span>
                <div className="solana-footer-links-grid">
                  <Link href="/privacy" className="solana-footer-link" data-hover>{t("home.data")}</Link>
                  <Link href="/terms" className="solana-footer-link" data-hover>{t("home.terms")}</Link>
                  <Link href="/risk" className="solana-footer-link" data-hover>{t("home.risk")}</Link>
                  <Link href="/auth" className="solana-footer-link" data-hover>{t("home.login")}</Link>
                </div>
              </div>
            </div>

            <div className="solana-footer-divider" />

            <div className="solana-footer-bottom">
              <div className="solana-footer-bottom-left">
                <span className="solana-footer-audience">{t("home.builtFor")}</span>
                <span className="solana-footer-dot">·</span>
                <span className="solana-footer-credit">{isEn ? "Developed by Team 404" : "Được phát triển bởi Team 404"}</span>
              </div>
              <span className="solana-footer-copy">© 2026 SkillBridge Vietnam. Built on Solana Devnet.</span>
            </div>
          </div>
        </footer>
      </main>
  );
}

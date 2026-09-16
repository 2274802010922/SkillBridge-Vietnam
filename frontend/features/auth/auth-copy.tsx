"use client";

import Link from "next/link";
import { useEffect } from "react";
import { LanguageSwitcher, useLanguage } from "../../i18n/i18n";
import { WalletSignIn } from "../../components/wallet/wallet-sign-in";
import { walletOnboardingCopy } from "../../i18n/wallet-onboarding";
import styles from "../../components/wallet/wallet-onboarding.module.css";

export function AuthCopy({ returnTo }: { returnTo: string }) {
  const { t, locale } = useLanguage();
  const copy = walletOnboardingCopy[locale];
  useEffect(() => { document.title = `${copy.heading} | SkillBridge Vietnam`; }, [copy.heading]);
  return (
    <main className={`auth-page ${styles.page}`}>
      <header className="auth-header page-shell">
        <Link className="wordmark" href="/" aria-label="SkillBridge Vietnam"><span className="wordmark-mark" aria-hidden="true">S</span><span>SkillBridge</span><small>VIETNAM</small></Link>
        <div className="topbar-actions"><Link className="text-link" href="/">← {t("common.home")}</Link><LanguageSwitcher /></div>
      </header>
      <section className="auth-shell page-shell">
        <div className={`auth-copy ${styles.intro}`}>
          <div className="eyebrow"><span /> {t("auth.walletIdentity")}</div>
          <h1>{copy.introTitle}</h1>
          <p>{copy.introDescription}</p>
          <ol><li>{t("auth.chooseWallet")}</li><li>{t("auth.signMessage")}</li><li>{t("auth.enterWorkspace")}</li></ol>
        </div>
        <WalletSignIn returnTo={returnTo} />
      </section>
    </main>
  );
}

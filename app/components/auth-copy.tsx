"use client";

import Link from "next/link";
import { LanguageSwitcher, useLanguage } from "./i18n";
import { WalletSignIn } from "./wallet-sign-in";

export function AuthCopy({ returnTo }: { returnTo: string }) {
  const { t } = useLanguage();
  return (
    <main className="auth-page">
      <header className="auth-header page-shell">
        <Link className="wordmark" href="/" aria-label="SkillBridge Vietnam"><span className="wordmark-mark" aria-hidden="true">S</span><span>SkillBridge</span><small>VIETNAM</small></Link>
        <div className="topbar-actions"><Link className="text-link" href="/">← {t("common.home")}</Link><LanguageSwitcher /></div>
      </header>
      <section className="auth-shell page-shell">
        <div className="auth-copy">
          <div className="eyebrow"><span /> {t("auth.walletIdentity")}</div>
          <h1>{t("auth.oneWallet")}<br /><em>{t("auth.verifiableIdentity")}</em></h1>
          <p>{t("auth.description")}</p>
          <ol><li>{t("auth.chooseWallet")}</li><li>{t("auth.signMessage")}</li><li>{t("auth.enterWorkspace")}</li></ol>
        </div>
        <WalletSignIn returnTo={returnTo} />
      </section>
    </main>
  );
}

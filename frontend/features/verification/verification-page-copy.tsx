"use client";

import Link from "next/link";
import { LanguageSwitcher, useLanguage } from "../../i18n/i18n";
import { PublicVerification } from "./public-verification";

export function VerificationPageCopy({ id }: { id: string }) {
  const { t } = useLanguage();
  return <main className="verify-page"><header className="auth-header page-shell"><Link className="wordmark" href="/"><span className="wordmark-mark">S</span><span>SkillBridge</span><small>VERIFY</small></Link><div className="topbar-actions"><LanguageSwitcher /><span className="workspace-tag">{t("shell.devnet").toUpperCase()}</span></div></header><section className="verify-shell page-shell"><div><div className="eyebrow"><span /> {t("verify.kicker")}</div><h1>{t("verify.title")}</h1><p>{t("verify.description")}</p></div><PublicVerification id={id} /></section></main>;
}

"use client";

import Link from "next/link";
import { useLanguage } from "./i18n";

export function PaymentsWorkspace() {
  const { t } = useLanguage();
  return <div className="workspace-product-content">
    <div className="app-welcome"><div><span>{t("payments.kicker")}</span><h1>{t("payments.title")}</h1><p>{t("payments.description")}</p></div><div className="identity-card"><small>{t("payments.simpleRule")}</small><strong className="metric-number">1</strong><b>{t("payments.noCustody")}</b></div></div>
    <section className="payment-choice-grid">
      <article className="app-panel payment-choice-card payment-choice-reward"><span className="panel-kicker">{t("payments.challengeKicker")}</span><h2>{t("payments.challengeTitle")}</h2><p>{t("payments.challengeDescription")}</p><ol><li>{t("payments.challengeStepOne")}</li><li>{t("payments.challengeStepTwo")}</li><li>{t("payments.challengeStepThree")}</li></ol><Link className="button button-primary" href="/app/payouts">{t("payments.openPayouts")}</Link></article>
      <article className="app-panel payment-choice-card"><span className="panel-kicker">{t("payments.invoiceKicker")}</span><h2>{t("payments.invoiceTitle")}</h2><p>{t("payments.invoiceDescription")}</p><ol><li>{t("payments.invoiceStepOne")}</li><li>{t("payments.invoiceStepTwo")}</li><li>{t("payments.invoiceStepThree")}</li></ol><Link className="button button-dark" href="/app/invoices">{t("payments.openInvoices")}</Link></article>
    </section>
    <section className="app-panel payment-explainer"><div><span className="panel-kicker">{t("payments.whatHappensKicker")}</span><h2>{t("payments.whatHappensTitle")}</h2></div><p>{t("payments.whatHappensDescription")}</p><details className="technical-details"><summary>{t("payments.technicalDetails")}</summary><p>{t("payments.technicalDetailsDescription")}</p></details></section>
  </div>;
}

"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "../../i18n/i18n";

export function PublicVerification({ id }: { id: string }) {
  const { t } = useLanguage();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetch(`/api/credentials/${encodeURIComponent(id)}/verify`, { cache: "no-store" }).then(async (response) => {
      const payload = await response.json() as { credential?: Record<string, unknown>; error?: string };
      if (!active) return;
      if (response.ok && payload.credential) setData(payload.credential); else setError(payload.error ?? t("verify.notVerified"));
    });
    return () => { active = false; };
  }, [id, t]);
  if (error) return <div className="verification-result denied"><strong>{t("verify.notVerified")}</strong><p>{error}</p></div>;
  if (!data) return <div className="verification-result"><strong>{t("verify.checking")}</strong></div>;
  const chain = data.chainStatus as { valid: boolean; reason: string };
  return <div className={`verification-result ${chain.valid ? "verified" : "denied"}`}><span>{chain.valid ? t("verify.liveProof") : t("verify.denied")}</span><h2>{String(data.challenge_title)}</h2><div className="verify-score"><strong>{String(data.score)}</strong><small>/100</small></div><dl><div><dt>{t("verify.issuer")}</dt><dd>{String(data.issuer_name)}</dd></div><div><dt>{t("verify.subject")}</dt><dd>{String(data.student_wallet)}</dd></div><div><dt>{t("verify.status")}</dt><dd>{String(data.status)} · {chain.reason}</dd></div><div><dt>{t("verify.expires")}</dt><dd>{String(data.expires_at)}</dd></div></dl><a className="button button-dark" href={String(data.attestationExplorer)} target="_blank" rel="noreferrer">{t("verify.explorer")}</a></div>;
}

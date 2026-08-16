"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "./i18n";

type AuditEvent = { id: string; action: string; target_type: string; target_id: string; organization_name: string | null; metadata_json: string; created_at: string };

export function AuditWorkspace() {
  const { t, locale } = useLanguage();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/audit", { cache: "no-store" }).then(async (response) => {
      const data = await response.json() as { events?: AuditEvent[]; error?: string };
      if (!active) return;
      if (response.ok) setEvents(data.events ?? []); else setError(data.error ?? t("audit.error"));
    });
    return () => { active = false; };
  }, [t]);
  return <div className="workspace-product-content"><div className="app-welcome"><div><span>{t("audit.kicker")}</span><h1>{t("audit.title")}</h1><p>{t("audit.description")}</p></div><div className="identity-card"><small>{t("audit.events")}</small><strong className="metric-number">{events.length}</strong><b>{t("audit.newest")}</b></div></div>{error && <p className="app-notice">{error}</p>}<section className="audit-list">{events.length === 0 && <div className="app-panel empty-product"><h2>{t("audit.empty")}</h2><p>{t("audit.emptyDescription")}</p></div>}{events.map((event) => <article key={event.id}><div><span>{event.organization_name ?? "PERSONAL"}</span><strong>{event.action}</strong><small>{event.target_type} · {event.target_id}</small></div><time>{new Date(event.created_at).toLocaleString(locale === "vi" ? "vi-VN" : "en-US")}</time><details><summary>{t("audit.metadata")}</summary><pre>{JSON.stringify(JSON.parse(event.metadata_json), null, 2)}</pre></details></article>)}</section></div>;
}

"use client";

import { useEffect, useState } from "react";

type AuditEvent = {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  organization_name: string | null;
  metadata_json: string;
  created_at: string;
};

export function AuditWorkspace() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/audit", { cache: "no-store" }).then(async (response) => {
      const data = await response.json() as { events?: AuditEvent[]; error?: string };
      if (!active) return;
      if (response.ok) setEvents(data.events ?? []);
      else setError(data.error ?? "Không thể tải audit trail.");
    });
    return () => { active = false; };
  }, []);
  return <div className="workspace-product-content">
    <div className="app-welcome"><div><span>IMMUTABLE APPLICATION LOG</span><h1>Ai đã làm gì, khi nào.</h1><p>Sự kiện nhạy cảm được append-only trong D1; transaction on-chain được lưu kèm metadata để đối chiếu.</p></div><div className="identity-card"><small>VISIBLE EVENTS</small><strong className="metric-number">{events.length}</strong><b>Newest first</b></div></div>
    {error && <p className="app-notice">{error}</p>}
    <section className="audit-list">
      {events.length === 0 && <div className="app-panel empty-product"><h2>Chưa có sự kiện</h2><p>Audit trail sẽ xuất hiện sau các hành động như đăng nhập, đánh giá, phát hành credential và kiểm tra cơ hội.</p></div>}
      {events.map((event) => <article key={event.id}>
        <div><span>{event.organization_name ?? "PERSONAL"}</span><strong>{event.action}</strong><small>{event.target_type} · {event.target_id}</small></div>
        <time>{new Date(event.created_at).toLocaleString("vi-VN")}</time>
        <details><summary>Metadata</summary><pre>{JSON.stringify(JSON.parse(event.metadata_json), null, 2)}</pre></details>
      </article>)}
    </section>
  </div>;
}


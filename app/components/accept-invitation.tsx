"use client";

import { useState } from "react";

export function AcceptInvitation({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function accept() {
    setBusy(true); setMessage(null);
    const response = await fetch("/api/invitations/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
    const data = await response.json() as { membership?: { organizationName: string; role: string }; error?: string };
    if (response.ok && data.membership) setMessage(`Đã tham gia ${data.membership.organizationName} với role ${data.membership.role}.`);
    else setMessage(data.error ?? "Không thể nhận lời mời.");
    setBusy(false);
  }
  return <div><button className="button button-primary" disabled={busy} onClick={accept}>{busy ? "Đang xác nhận…" : "Nhận lời mời"}</button>{message && <p className="app-notice" role="status">{message}</p>}</div>;
}


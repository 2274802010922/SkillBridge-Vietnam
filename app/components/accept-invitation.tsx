"use client";

import { useState } from "react";
import { useLanguage } from "./i18n";

export function AcceptInvitation({ token }: { token: string }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function accept() {
    setBusy(true); setMessage(null);
    const response = await fetch("/api/invitations/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
    const data = await response.json() as { membership?: { organizationName: string; role: string }; error?: string };
    if (response.ok && data.membership) setMessage(`${t("invite.accepted")} ${data.membership.role}.`);
    else setMessage(data.error ?? t("invite.acceptErrorMembership"));
    setBusy(false);
  }
  return <div><button className="button button-primary" disabled={busy} onClick={accept}>{busy ? t("invite.accepting") : t("invite.accept")}</button>{message && <p className="app-notice" role="status">{message}</p>}</div>;
}

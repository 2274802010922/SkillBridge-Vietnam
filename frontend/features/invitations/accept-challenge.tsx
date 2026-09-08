"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "../../i18n/i18n";
export function AcceptChallenge({ token }: { token: string }) { const router=useRouter(); const { t } = useLanguage(); const [busy,setBusy]=useState(false); const [message,setMessage]=useState<string|null>(null); async function accept(){setBusy(true);const response=await fetch("/api/challenge-invitations/accept",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token})});const data=await response.json() as {error?:string};if(response.ok){router.push("/app/submissions");router.refresh();return;}setMessage(data.error??t("invite.acceptError"));setBusy(false);}return <div><button className="button button-primary" disabled={busy} onClick={accept}>{busy?t("invite.acceptingChallenge"):t("invite.acceptChallenge")}</button>{message&&<p className="app-notice">{message}</p>}</div>;}

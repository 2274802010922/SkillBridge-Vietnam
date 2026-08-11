"use client";
import { useState } from "react";
export function AcceptChallenge({ token }: { token: string }) { const [busy,setBusy]=useState(false); const [message,setMessage]=useState<string|null>(null); async function accept(){setBusy(true);const response=await fetch("/api/challenge-invitations/accept",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token})});const data=await response.json() as {error?:string};if(response.ok){window.location.assign("/app/submissions");return;}setMessage(data.error??"Không thể tham gia challenge.");setBusy(false);}return <div><button className="button button-primary" disabled={busy} onClick={accept}>{busy?"Đang tham gia…":"Tham gia challenge"}</button>{message&&<p className="app-notice">{message}</p>}</div>;}


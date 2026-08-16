import { env } from "@/lib/runtime-env";
import { headers } from "next/headers";
import { getSessionUser, sha256 } from "../../../lib/auth";
import { ChallengeInviteCopy } from "../../components/invite-copy";
export const dynamic = "force-dynamic";
export default async function ChallengeInvitePage({params}:{params:Promise<{token:string}>}){const {token}=await params;const row=await env.DB.prepare(`SELECT c.title,c.brief,c.reward,o.name AS organization_name,i.status,i.expires_at FROM challenge_invitations i JOIN challenges c ON c.id=i.challenge_id JOIN organizations o ON o.id=c.organization_id WHERE i.token_hash=?`).bind(await sha256(token)).first<{title:string;brief:string;reward:string;organization_name:string;status:string;expires_at:string}>();const incoming=await headers();const host=incoming.get("host")??"localhost:3000";const request=new Request(`${host.startsWith("localhost")?"http":"https"}://${host}/challenge/${token}`,{headers:incoming});const user=await getSessionUser(request);const valid=Boolean(row&&row.status==="active"&&row.expires_at>new Date().toISOString());return <ChallengeInviteCopy token={token} row={row} valid={valid} signedIn={Boolean(user)} />;}

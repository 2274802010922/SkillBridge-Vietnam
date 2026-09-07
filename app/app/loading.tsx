"use client";

import Link from "next/link";
import { useLanguage } from "../components/i18n";

export default function Loading() {
  const { locale } = useLanguage();
  return <main className="workspace-load" role="status" aria-live="polite">
    <Link href="/">SkillBridge</Link>
    <h1>{locale === "vi" ? "Đang tải không gian làm việc" : "Loading your workspace"}</h1>
    <p>{locale === "vi" ? "Thông tin của bạn sẽ xuất hiện trong giây lát." : "Your information will appear shortly."}</p>
  </main>;
}

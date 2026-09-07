"use client";

import Link from "next/link";
import { useLanguage } from "../components/i18n";

export default function WorkspaceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { locale } = useLanguage();
  return <main className="workspace-load">
    <Link href="/">SkillBridge</Link>
    <h1>{locale === "vi" ? "Chưa thể mở trang này" : "This page could not be opened"}</h1>
    <p role="alert">{locale === "vi" ? "Hãy tải lại trang. Nếu bạn vừa ký giao dịch, kiểm tra mã giao dịch đã gửi trước khi thực hiện thêm lần nữa." : "Try loading again. If you just signed a transaction, verify its existing signature before sending another."}</p>
    <button className="button button-primary" onClick={reset}>{locale === "vi" ? "Thử lại" : "Try again"}</button>
  </main>;
}

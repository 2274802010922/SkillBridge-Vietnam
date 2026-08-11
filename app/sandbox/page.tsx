import type { Metadata } from "next";
import Link from "next/link";
import { RoleWorkspace } from "../components/role-workspace";

export const metadata: Metadata = {
  title: "Sandbox mô phỏng ba vai trò",
  description: "Kiểm thử cùng một proof-of-skill journey qua ba vai trò Business, Student và University.",
};

export default function SandboxPage() {
  return (
    <main className="role-page">
      <header className="role-header page-shell">
        <Link className="wordmark" href="/" aria-label="Về trang SkillBridge Vietnam">
          <span className="wordmark-mark" aria-hidden="true">S</span>
          <span>SkillBridge</span>
          <small>VIETNAM</small>
        </Link>
        <span className="workspace-tag">SANDBOX · ROLE SIMULATOR</span>
        <Link className="text-link" href="/">← Trang giới thiệu</Link>
      </header>
      <RoleWorkspace />
    </main>
  );
}

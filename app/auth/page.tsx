import type { Metadata } from "next";
import Link from "next/link";
import { WalletSignIn } from "../components/wallet-sign-in";

export const metadata: Metadata = { title: "Đăng nhập bằng ví Solana" };

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const query = await searchParams;
  const returnTo = query.returnTo?.startsWith("/") && !query.returnTo.startsWith("//") ? query.returnTo : "/app";
  return (
    <main className="auth-page">
      <header className="auth-header page-shell">
        <Link className="wordmark" href="/" aria-label="SkillBridge Vietnam">
          <span className="wordmark-mark" aria-hidden="true">S</span><span>SkillBridge</span><small>VIETNAM</small>
        </Link>
        <Link className="text-link" href="/">← Trang chủ</Link>
      </header>
      <section className="auth-shell page-shell">
        <div className="auth-copy">
          <div className="eyebrow"><span /> Wallet-bound identity</div>
          <h1>Một ví.<br /><em>Một danh tính có thể kiểm chứng.</em></h1>
          <p>Đăng nhập để tham gia challenge, đánh giá bằng chứng và quản lý credential kỹ năng trên Solana Devnet.</p>
          <ol><li>Chọn ví</li><li>Ký thông điệp đăng nhập</li><li>Vào workspace đúng quyền</li></ol>
        </div>
        <WalletSignIn returnTo={returnTo} />
      </section>
    </main>
  );
}


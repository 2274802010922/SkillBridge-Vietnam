import type { Metadata } from "next";
import { AuthCopy } from "../components/auth-copy";

export const metadata: Metadata = { title: "Đăng nhập bằng ví Solana" };

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const query = await searchParams;
  const returnTo = query.returnTo?.startsWith("/") && !query.returnTo.startsWith("//") ? query.returnTo : "/app";
  return <AuthCopy returnTo={returnTo} />;
}

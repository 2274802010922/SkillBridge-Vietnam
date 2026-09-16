import type { Metadata } from "next";
import { AuthCopy } from "../../frontend/features/auth/auth-copy";
import { safeWalletReturnTo } from "../../shared/validation/wallet-onboarding";

export const metadata: Metadata = { title: "Kết nối ví" };

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const query = await searchParams;
  const returnTo = safeWalletReturnTo(query.returnTo);
  return <AuthCopy returnTo={returnTo} />;
}

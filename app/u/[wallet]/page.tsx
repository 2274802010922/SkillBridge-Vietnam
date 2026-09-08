import { SharedWalletProfile } from "../../../frontend/features/profile/wallet-profile-view";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "SkillBridge — Hồ sơ / Profile",
  robots: { index: false, follow: false },
};
export default async function ProfilePage({
  params,
}: {
  params: Promise<{ wallet: string }>;
}) {
  const { wallet } = await params;
  return <SharedWalletProfile wallet={wallet} />;
}

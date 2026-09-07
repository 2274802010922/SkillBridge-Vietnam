"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLanguage } from "./i18n";
import { ContentSkeleton } from "./loading-ui";
type Profile = {
  user_id: string;
  display_name: string;
  wallet_address: string;
  headline: string;
  bio: string;
  skills: string[];
  credentials: unknown[];
};
export function TalentWorkspace() {
  const { t, locale } = useLanguage();
  const vi = locale === "vi";
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    fetch("/api/talent", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const d = (await r.json()) as { profiles: Profile[] };
        if (active) setProfiles(d.profiles);
      })
      .catch(() => {
        if (active) setError(true);
      }).finally(() => { if (active) setLoading(false); });
    return () => {
      active = false;
    };
  }, []);
  if (loading) return <div id="workspace-main" tabIndex={-1} className="workspace-product-content"><ContentSkeleton delayed variant="list" /></div>;
  return (
    <div id="workspace-main" tabIndex={-1} className="workspace-product-content">
      <div className="app-welcome">
        <div>
          <span>{t("talent.kicker")}</span>
          <h1>{t("talent.title")}</h1>
          <p>{t("talent.description")}</p>
        </div>
      </div>
      <section className="app-panel">
        <h2>
          {vi
            ? "Hồ sơ và quyền chia sẻ của bạn"
            : "Your profile and sharing settings"}
        </h2>
        <p>
          {vi
            ? "Chỉnh sửa hồ sơ tại một nơi. Chọn công khai để xuất hiện trong danh sách ứng viên."
            : "Manage your profile in one place. Choose public visibility to appear in this directory."}
        </p>
        <Link className="button button-primary" href="/app/profile">
          {vi ? "Quản lý hồ sơ" : "Manage profile"}
        </Link>
      </section>
      {error && (
        <p role="alert">
          {vi
            ? "Chưa thể tải danh sách. Vui lòng tải lại."
            : "Unable to load the directory. Please reload."}
        </p>
      )}
      <section className="talent-grid">
        {profiles.map((p) => (
          <article className="app-panel" key={p.user_id}>
            <h2>
              <Link href={`/u/${p.wallet_address}`}>
                {p.display_name || p.wallet_address.slice(0, 10)}
              </Link>
            </h2>
            <h3>{p.headline}</h3>
            <p>{p.bio}</p>
            <div className="entity-tags">
              {p.skills.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
            <p>
              {p.credentials.length} {t("talent.credentials")}
            </p>
            <Link className="profile-menu-link" href={`/u/${p.wallet_address}`}>
              {vi ? "Xem hồ sơ" : "View profile"} →
            </Link>
          </article>
        ))}
      </section>
    </div>
  );
}

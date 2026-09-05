"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LanguageSwitcher, useLanguage } from "./i18n";
import type { WalletProfile } from "@/lib/wallet-profile";

export function ProfileAvatar({
  avatar,
  name,
}: {
  avatar: string;
  name: string;
}) {
  // Bounded, locally encoded raster; next/image cannot optimize an inline data URL.
  return avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="profile-avatar"
      src={avatar}
      alt=""
      width={96}
      height={96}
    />
  ) : (
    <span className="profile-avatar profile-initials" aria-hidden="true">
      {(name || "S").slice(0, 2).toUpperCase()}
    </span>
  );
}
export function WalletProfileView({
  profile,
  owner = false,
}: {
  profile: WalletProfile;
  owner?: boolean;
}) {
  const { locale } = useLanguage();
  const vi = locale === "vi";
  const availability: Record<string, string> = vi
    ? {
        available: "Sẵn sàng nhận cơ hội",
        busy: "Hiện chưa nhận cơ hội",
        internship: "Tìm thực tập",
        employment: "Tìm việc làm",
        freelance: "Nhận dự án",
      }
    : {
        available: "Open to opportunities",
        busy: "Not currently available",
        internship: "Seeking an internship",
        employment: "Seeking employment",
        freelance: "Open to projects",
      };
  const proofSkills = [
    ...new Set(
      profile.proofs
        .filter((p) => ["active", "issued"].includes(p.status))
        .flatMap((p) => p.skills),
    ),
  ];
  return (
    <div className="profile-view">
      <section className="app-panel profile-intro">
        <ProfileAvatar avatar={profile.avatar} name={profile.displayName} />
        <div>
          <span className="panel-kicker">
            {vi ? "HỒ SƠ GẮN VỚI VÍ" : "WALLET PROFILE"}
          </span>
          <h1>
            {profile.displayName || (vi ? "Chưa đặt tên" : "Unnamed profile")}
          </h1>
          <p className="profile-headline">{profile.headline}</p>
          <span className="profile-availability">
            {availability[profile.availability]}
          </span>
        </div>
        <div className="profile-wallet">
          <span>
            {vi
              ? "Ví đã xác nhận bằng chữ ký"
              : "Wallet ownership confirmed by signature"}
          </span>
          <code>{profile.wallet}</code>
          <small>
            {vi
              ? "Thông tin giới thiệu do chủ ví cung cấp."
              : "Biographical details are supplied by the wallet owner."}
          </small>
        </div>
      </section>
      <div className="profile-columns">
        <section className="app-panel">
          <h2>{vi ? "Giới thiệu" : "About"}</h2>
          <p className="profile-prose">
            {profile.bio ||
              (vi ? "Chưa có giới thiệu." : "No introduction yet.")}
          </p>
          <dl className="profile-facts">
            {profile.education && (
              <div>
                <dt>{vi ? "Học tập" : "Education"}</dt>
                <dd>{profile.education}</dd>
              </div>
            )}
            {profile.occupation && (
              <div>
                <dt>{vi ? "Công việc" : "Work"}</dt>
                <dd>{profile.occupation}</dd>
              </div>
            )}
          </dl>
          <div className="profile-links">
            {[
              ["GitHub", profile.github],
              ["LinkedIn", profile.linkedin],
              [vi ? "Trang cá nhân" : "Website", profile.website],
            ]
              .filter(([, url]) => url)
              .map(([label, url]) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {label} ↗
                </a>
              ))}
          </div>
        </section>
        <section className="app-panel">
          <h2>{vi ? "Kỹ năng tự khai" : "Self-reported skills"}</h2>
          <p>{vi ? "Do chủ hồ sơ bổ sung." : "Added by the profile owner."}</p>
          <div className="entity-tags">
            {profile.skills.length ? (
              profile.skills.map((s) => <span key={s}>{s}</span>)
            ) : (
              <p>{vi ? "Chưa bổ sung kỹ năng." : "No skills added yet."}</p>
            )}
          </div>
        </section>
      </div>
      <section className="app-panel">
        <div className="profile-section-title">
          <div>
            <h2>{vi ? "Hộ chiếu kỹ năng" : "Skill Passport"}</h2>
            <p>
              {owner
                ? vi
                  ? "Thành tích cá nhân; chỉ chứng nhận từ thử thách công khai, còn hiệu lực được chia sẻ khi bạn cho phép."
                  : "Your achievements. Only valid credentials from public challenges are shared when you opt in."
                : vi
                  ? "Chứng nhận dựa trên kết quả được người đánh giá phê duyệt."
                  : "Credentials based on human-approved results."}
            </p>
          </div>
          {owner && (
            <Link href="/app/passport">
              {vi ? "Quản lý chứng nhận" : "Manage credentials"} →
            </Link>
          )}
        </div>
        {proofSkills.length > 0 && (
          <>
            <h3>{vi ? "Kỹ năng có bằng chứng" : "Evidence-backed skills"}</h3>
            <div className="entity-tags">
              {proofSkills.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
          </>
        )}
        {profile.proofs.length ? (
          <div className="profile-proofs">
            {profile.proofs.map((p) => (
              <article key={p.id}>
                <div>
                  <h3>{p.title}</h3>
                  <p>{p.issuer}</p>
                  <small>
                    {["active", "issued"].includes(p.status)
                      ? vi
                        ? "Còn hiệu lực"
                        : "Active"
                      : p.status === "revoked"
                        ? vi
                          ? "Đã thu hồi"
                          : "Revoked"
                        : p.status === "expired"
                          ? vi
                            ? "Đã hết hạn"
                            : "Expired"
                          : vi
                            ? "Chưa có hiệu lực"
                            : "Not active"}
                  </small>
                </div>
                <div>
                  <strong>
                    {p.score}
                    <small>/100</small>
                  </strong>
                  <Link href={`/verify/${encodeURIComponent(p.id)}`}>
                    {vi ? "Xem bằng chứng" : "View proof"} →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="profile-empty">
            {vi
              ? "Chưa có thành tích được hiển thị."
              : "No achievements to display."}
          </p>
        )}
      </section>
      {profile.portfolio.length > 0 && (
        <section className="app-panel">
          <h2>{vi ? "Sản phẩm nổi bật" : "Featured work"}</h2>
          <p>
            {vi
              ? "Liên kết do chủ hồ sơ lựa chọn chia sẻ."
              : "Links selected and shared by the profile owner."}
          </p>
          <div className="profile-links">
            {profile.portfolio.map((p, i) => (
              <a key={i} href={p.url} target="_blank" rel="noopener noreferrer">
                {p.title} ↗
              </a>
            ))}
          </div>
        </section>
      )}
      {profile.organizations.length > 0 && (
        <section className="app-panel">
          <h2>{vi ? "Tổ chức tham gia" : "Organization memberships"}</h2>
          <p>
            {vi
              ? "Tư cách thành viên đang hoạt động trong SkillBridge."
              : "Active memberships within SkillBridge."}
          </p>
          <div className="entity-tags">
            {profile.organizations.map((o, i) => (
              <span key={i}>{o.name}</span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
export function SharedWalletProfile({ wallet }: { wallet: string }) {
  const { locale } = useLanguage();
  const vi = locale === "vi";
  const [profile, setProfile] = useState<WalletProfile | null>(null);
  const [state, setState] = useState("loading");
  useEffect(() => {
    let active = true;
    fetch(`/api/profiles/${encodeURIComponent(wallet)}?preview=1`, {
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) {
          if (active) setState(r.status === 404 ? "unavailable" : "error");
          return;
        }
        const data = (await r.json()) as { profile: WalletProfile };
        if (active) {
          setProfile(data.profile);
          setState("ready");
        }
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
    };
  }, [wallet]);
  return (
    <main className="product-app profile-public">
      <header className="profile-public-header">
        <Link className="wordmark" href="/">
          SkillBridge
        </Link>
        <LanguageSwitcher />
      </header>
      {state === "ready" && profile ? (
        <WalletProfileView profile={profile} />
      ) : (
        <section className="app-panel">
          <h1>
            {state === "loading"
              ? vi
                ? "Đang tải hồ sơ…"
                : "Loading profile…"
              : state === "error"
                ? vi
                  ? "Chưa thể tải hồ sơ"
                  : "Unable to load profile"
                : vi
                  ? "Hồ sơ không khả dụng"
                  : "Profile unavailable"}
          </h1>
          <p>
            {state === "unavailable"
              ? vi
                ? "Hồ sơ này chưa được chia sẻ hoặc địa chỉ không tồn tại."
                : "This profile is not shared or the address does not exist."
              : state === "error"
                ? vi
                  ? "Vui lòng tải lại trang để thử lại."
                  : "Reload the page to try again."
                : ""}
          </p>
        </section>
      )}
    </main>
  );
}

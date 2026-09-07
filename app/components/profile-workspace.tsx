"use client";
import { useEffect, useRef, useState } from "react";
import type { WalletProfile } from "@/lib/wallet-profile";
import { ProfileAvatar, WalletProfileView } from "./wallet-profile-view";
import { useLanguage } from "./i18n";
import { ContentSkeleton } from "./loading-ui";

async function resizeAvatar(file: File): Promise<string> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024
  )
    throw new Error("avatar");
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("avatar");
  }
  const size = Math.min(bitmap.width, bitmap.height);
  ctx.drawImage(
    bitmap,
    (bitmap.width - size) / 2,
    (bitmap.height - size) / 2,
    size,
    size,
    0,
    0,
    160,
    160,
  );
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}
export function ProfileWorkspace() {
  const { locale } = useLanguage();
  const vi = locale === "vi";
  const [saved, setSaved] = useState<WalletProfile | null>(null);
  const [draft, setDraft] = useState<WalletProfile | null>(null);
  const [preview, setPreview] = useState<WalletProfile | null>(null);
  const [view, setView] = useState<"edit" | "mine" | "visitor">("edit");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  const dirty = Boolean(
    saved && draft && JSON.stringify(saved) !== JSON.stringify(draft),
  );
  useEffect(() => {
    let live = true;
    fetch("/api/profile", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const d = (await r.json()) as { profile: WalletProfile };
        if (live) {
          setSaved(d.profile);
          setDraft(d.profile);
        }
      })
      .catch(() => {
        if (live) setError("load");
      }).finally(() => { if (live) setLoading(false); });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  function change<K extends keyof WalletProfile>(
    key: K,
    value: WalletProfile[K],
  ) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setMessage("");
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(Object.entries(draft).filter(([key]) => !['wallet','proofs','organizations'].includes(key)))),
      });
      const data = (await r.json()) as {
        profile: WalletProfile;
        error?: string;
      };
      if (!r.ok) throw new Error(data.error || "save");
      setSaved(data.profile);
      setDraft(data.profile);
      setMessage("saved");
      window.dispatchEvent(new Event("skillbridge-profile-change"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "save");
    } finally {
      setBusy(false);
    }
  }
  async function visitPreview() {
    if (!saved) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/profiles/${saved.wallet}?preview=1`, {
        cache: "no-store",
      });
      if (r.status === 404) setPreview(null);
      else {
        if (!r.ok) throw new Error();
        setPreview(((await r.json()) as { profile: WalletProfile }).profile);
      }
      setView("visitor");
    } catch {
      setError("load");
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    if (!saved) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/u/${saved.wallet}`,
      );
      setMessage("copied");
    } catch {
      setError("copy");
    }
  }
  const labels = vi
    ? {
        displayName: "Tên hiển thị",
        headline: "Dòng giới thiệu",
        education: "Trường học / ngành học",
        occupation: "Công việc hiện tại",
        github: "GitHub",
        linkedin: "LinkedIn",
        website: "Trang cá nhân",
      }
    : {
        displayName: "Display name",
        headline: "Headline",
        education: "School / field of study",
        occupation: "Current work",
        github: "GitHub",
        linkedin: "LinkedIn",
        website: "Website",
      };
  if (loading) return <div id="workspace-main" tabIndex={-1} className="workspace-product-content"><ContentSkeleton delayed variant="profile" /></div>;
  return (
    <div id="workspace-main" tabIndex={-1} className="workspace-product-content profile-workspace">
      <div className="profile-page-heading">
        <span className="panel-kicker">
          {vi
            ? "DANH TÍNH · NĂNG LỰC · BẰNG CHỨNG"
            : "IDENTITY · SKILLS · EVIDENCE"}
        </span>
        <h1>{vi ? "Hồ sơ của tôi" : "My profile"}</h1>
        <p>
          {vi
            ? "Giới thiệu bản thân và chọn những thành tích bạn muốn chia sẻ."
            : "Introduce yourself and choose the achievements you want to share."}
        </p>
      </div>
      <div className="profile-toolbar">
        <button
          type="button"
          className="button button-secondary"
          aria-pressed={view === "edit"}
          onClick={() => setView("edit")}
        >
          {vi ? "Chỉnh sửa" : "Edit"}
        </button>
        <button
          type="button"
          className="button button-secondary"
          aria-pressed={view === "mine"}
          disabled={!draft}
          onClick={() => setView("mine")}
        >
          {vi ? "Xem hồ sơ của tôi" : "My profile view"}
        </button>
        <button
          type="button"
          className="button button-secondary"
          aria-pressed={view === "visitor"}
          disabled={!saved || busy}
          onClick={() => void visitPreview()}
        >
          {vi ? "Xem như khách" : "View as visitor"}
        </button>
        <button
          type="button"
          className="button button-secondary"
          disabled={!saved || saved.visibility === "private"}
          onClick={() => void copy()}
        >
          {vi ? "Sao chép liên kết" : "Copy link"}
        </button>
      </div>
      {error && (
        <p ref={errorRef} tabIndex={-1} className="demo-error" role="alert">
          {error.startsWith("PROFILE_INVALID:")
            ? (vi ? "Vui lòng kiểm tra trường: " : "Please check: ") +
              error.split(":")[1]
            : vi
              ? "Chưa thể thực hiện. Kiểm tra dữ liệu, kết nối và thử lại; ảnh cần là JPEG/PNG/WebP, tối đa 5 MB."
              : "Unable to complete. Check your inputs and connection, then retry; use JPEG/PNG/WebP up to 5 MB."}
        </p>
      )}
      {message && (
        <p className="app-notice" role="status">
          {message === "saved"
            ? vi
              ? "Đã lưu hồ sơ."
              : "Profile saved."
            : vi
              ? "Đã sao chép liên kết."
              : "Link copied."}
        </p>
      )}
      {dirty && (
        <p role="status">
          {vi
            ? "Bạn có thay đổi chưa lưu. Bản xem như khách dùng dữ liệu đã lưu."
            : "You have unsaved changes. The visitor preview uses saved data."}
        </p>
      )}
      {!draft && !error && (
        <p role="status">{vi ? "Đang tải hồ sơ…" : "Loading profile…"}</p>
      )}
      {view === "mine" && draft && <WalletProfileView profile={draft} owner />}
      {view === "visitor" &&
        (preview ? (
          <WalletProfileView profile={preview} />
        ) : (
          <section className="app-panel">
            <h2>
              {vi
                ? "Khách chưa thể xem hồ sơ"
                : "Visitors cannot see this profile"}
            </h2>
            <p>
              {vi
                ? "Hồ sơ đang riêng tư. Thay đổi quyền chia sẻ và lưu để mở liên kết."
                : "The profile is private. Change sharing settings and save to enable the link."}
            </p>
          </section>
        ))}
      {view === "edit" && draft && (
        <form onSubmit={(e) => void save(e)} className="profile-editor">
          <section className="app-panel">
            <h2>{vi ? "Thông tin cá nhân" : "Personal information"}</h2>
            <div className="profile-avatar-editor">
              <ProfileAvatar avatar={draft.avatar} name={draft.displayName} />
              <div>
                <label htmlFor="profile-photo">
                  {vi ? "Ảnh đại diện" : "Profile photo"}
                </label>
                <input
                  id="profile-photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                  onChange={async (e) => {
                    const file = e.currentTarget.files?.[0];
                    e.currentTarget.value = "";
                    if (!file) return;
                    setBusy(true);
                    try {
                      change("avatar", await resizeAvatar(file));
                      setError("");
                    } catch {
                      setError("avatar");
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
                <small>
                  {vi
                    ? "Ảnh được thu nhỏ trên thiết bị trước khi lưu."
                    : "The image is resized on your device before saving."}
                </small>
                {draft.avatar && (
                  <button
                    type="button"
                    className="button button-secondary"
                    disabled={busy}
                    onClick={() => change("avatar", "")}
                  >
                    {vi ? "Bỏ ảnh" : "Remove photo"}
                  </button>
                )}
              </div>
            </div>
            <div className="profile-fields">
              {(
                ["displayName", "headline", "education", "occupation"] as const
              ).map((key) => (
                <label key={key}>
                  {labels[key]}
                  {key === "displayName" ? " *" : ""}
                  <input
                    value={draft[key]}
                    maxLength={key === "displayName" ? 80 : 160}
                    required={key === "displayName"}
                    minLength={key === "displayName" ? 2 : undefined}
                    onChange={(e) => change(key, e.target.value)}
                  />
                </label>
              ))}
            </div>
            <label>
              {vi ? "Giới thiệu bản thân" : "About you"}
              <textarea
                rows={5}
                maxLength={2000}
                value={draft.bio}
                onChange={(e) => change("bio", e.target.value)}
              />
            </label>
            <div className="profile-fields">
              <label>
                {vi ? "Loại hồ sơ" : "Profile type"}
                <select
                  value={draft.profileKind}
                  onChange={(e) =>
                    change(
                      "profileKind",
                      e.target.value as WalletProfile["profileKind"],
                    )
                  }
                >
                  <option value="student">
                    {vi ? "Sinh viên" : "Student"}
                  </option>
                  <option value="professional">
                    {vi ? "Người đi làm" : "Professional"}
                  </option>
                </select>
              </label>
              <label>
                {vi ? "Cơ hội đang tìm" : "Open to"}
                <select
                  value={draft.availability}
                  onChange={(e) =>
                    change(
                      "availability",
                      e.target.value as WalletProfile["availability"],
                    )
                  }
                >
                  {[
                    ["available", "Sẵn sàng nhận cơ hội", "Opportunities"],
                    ["internship", "Thực tập", "Internships"],
                    ["employment", "Việc làm", "Employment"],
                    ["freelance", "Dự án", "Projects"],
                    ["busy", "Chưa nhận cơ hội", "Not available"],
                  ].map(([value, a, b]) => (
                    <option value={value} key={value}>
                      {vi ? a : b}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
          <section className="app-panel">
            <h2>{vi ? "Kỹ năng và sản phẩm" : "Skills and work"}</h2>
            <label>
              {vi
                ? "Kỹ năng tự khai — cách nhau bằng dấu phẩy"
                : "Self-reported skills — comma separated"}
              <input
                value={draft.skills.join(",")}
                onChange={(e) =>
                  change("skills", e.target.value.split(",").slice(0, 20))
                }
              />
            </label>
            <p>
              {vi
                ? "Kỹ năng có bằng chứng được lấy tự động từ chứng nhận còn hiệu lực."
                : "Evidence-backed skills come from active credentials."}
            </p>
            <div className="profile-fields">
              {(["github", "linkedin", "website"] as const).map((key) => (
                <label key={key}>
                  {labels[key]}
                  <input
                    type="url"
                    placeholder="https://"
                    maxLength={500}
                    value={draft[key]}
                    onChange={(e) => change(key, e.target.value)}
                  />
                </label>
              ))}
            </div>
            <h3>{vi ? "Sản phẩm nổi bật" : "Featured work"}</h3>
            <p>
              {vi
                ? "Chỉ thêm liên kết sản phẩm bạn được phép công khai."
                : "Add only work you have permission to share."}
            </p>
            {draft.portfolio.map((p, i) => (
              <div className="profile-portfolio-row" key={i}>
                <label>
                  {vi ? "Tên sản phẩm" : "Work title"}
                  <input
                    required
                    maxLength={100}
                    value={p.title}
                    onChange={(e) =>
                      change(
                        "portfolio",
                        draft.portfolio.map((x, j) =>
                          j === i ? { ...x, title: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  {vi ? "Liên kết" : "Link"}
                  <input
                    required
                    type="url"
                    placeholder="https://"
                    value={p.url}
                    onChange={(e) =>
                      change(
                        "portfolio",
                        draft.portfolio.map((x, j) =>
                          j === i ? { ...x, url: e.target.value } : x,
                        ),
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  aria-label={
                    (vi ? "Bỏ sản phẩm " : "Remove work ") + (p.title || i + 1)
                  }
                  className="button button-secondary"
                  onClick={() =>
                    change(
                      "portfolio",
                      draft.portfolio.filter((_, j) => j !== i),
                    )
                  }
                >
                  {vi ? "Bỏ" : "Remove"}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="button button-secondary"
              disabled={draft.portfolio.length >= 6}
              onClick={() =>
                change("portfolio", [
                  ...draft.portfolio,
                  { title: "", url: "" },
                ])
              }
            >
              {vi ? "Thêm sản phẩm" : "Add work"}
            </button>
          </section>
          <section className="app-panel">
            <h2>{vi ? "Quyền chia sẻ" : "Sharing settings"}</h2>
            <label>
              {vi ? "Ai có thể xem hồ sơ?" : "Who can view this profile?"}
              <select
                value={draft.visibility}
                onChange={(e) =>
                  change(
                    "visibility",
                    e.target.value as WalletProfile["visibility"],
                  )
                }
              >
                <option value="private">
                  {vi ? "Riêng tư — chỉ tôi" : "Private — only me"}
                </option>
                <option value="unlisted">
                  {vi ? "Người có liên kết" : "Anyone with the link"}
                </option>
                <option value="public">
                  {vi
                    ? "Công khai — có trong danh sách ứng viên"
                    : "Public — listed in talent directory"}
                </option>
              </select>
            </label>
            <p>
              {vi
                ? "Liên kết có thể được chuyển tiếp. Dữ liệu vốn công khai trên blockchain vẫn tồn tại khi bạn ẩn hồ sơ."
                : "Links can be forwarded. Already-public blockchain records remain when you hide your profile."}
            </p>
            <label className="profile-check">
              <input
                type="checkbox"
                checked={draft.shareAchievements}
                onChange={(e) => change("shareAchievements", e.target.checked)}
              />
              <span>
                {vi
                  ? "Chia sẻ chứng nhận còn hiệu lực từ thử thách công khai và kỹ năng có bằng chứng."
                  : "Share active credentials from public challenges and their evidence-backed skills."}
              </span>
            </label>
            <label className="profile-check">
              <input
                type="checkbox"
                checked={draft.shareOrganizations}
                onChange={(e) => change("shareOrganizations", e.target.checked)}
              />
              <span>
                {vi
                  ? "Chia sẻ tổ chức tôi đang tham gia trong SkillBridge."
                  : "Share my active SkillBridge organization memberships."}
              </span>
            </label>
            <p>
              {vi
                ? "Số dư ví, thông tin ngân hàng, hợp đồng và tệp bài nộp không nằm trong hồ sơ chia sẻ."
                : "Wallet balances, bank details, contracts and submission files are excluded from this shared profile."}
            </p>
          </section>
          <div className="profile-save-bar">
            <button
              disabled={busy}
              type="submit"
              className="button button-primary"
            >
              {busy
                ? vi
                  ? "Đang lưu…"
                  : "Saving…"
                : vi
                  ? "Lưu hồ sơ"
                  : "Save profile"}
            </button>
            <span>
              {draft.visibility === "private"
                ? vi
                  ? "Hồ sơ riêng tư"
                  : "Private profile"
                : vi
                  ? "Hãy xem như khách sau khi lưu"
                  : "Preview as a visitor after saving"}
            </span>
          </div>
        </form>
      )}
    </div>
  );
}

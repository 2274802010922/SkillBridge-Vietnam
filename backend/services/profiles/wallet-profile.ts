export const PROFILE_SCHEMA = `CREATE TABLE IF NOT EXISTS wallet_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  details_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

export type ProfileDetails = {
  avatar: string;
  education: string;
  occupation: string;
  skills: string[];
  github: string;
  linkedin: string;
  website: string;
  portfolio: Array<{ title: string; url: string }>;
  shareAchievements: boolean;
  shareOrganizations: boolean;
};
export type ProfileInput = ProfileDetails & {
  displayName: string;
  profileKind: "student" | "professional";
  headline: string;
  bio: string;
  visibility: "private" | "unlisted" | "public";
  availability:
    | "available"
    | "busy"
    | "internship"
    | "employment"
    | "freelance";
};
export type ProfileProof = {
  id: string;
  title: string;
  issuer: string;
  score: string;
  status: string;
  issuedAt: string | null;
  skills: string[];
};
export type WalletProfile = ProfileInput & {
  wallet: string;
  proofs: ProfileProof[];
  organizations: Array<{ name: string; kind: string }>;
};
export const DEFAULT_DETAILS: ProfileDetails = {
  avatar: "",
  education: "",
  occupation: "",
  skills: [],
  github: "",
  linkedin: "",
  website: "",
  portfolio: [],
  shareAchievements: false,
  shareOrganizations: false,
};
export class ProfileValidationError extends Error {
  status = 400;
}
function fail(field: string): never {
  throw new ProfileValidationError(`PROFILE_INVALID:${field}`);
}
function bounded(value: unknown, field: string, max: number) {
  if (typeof value !== "string" || value.trim().length > max)
    return fail(field);
  return value.trim();
}
function safeLink(value: unknown, field: string) {
  const text = bounded(value, field, 500);
  if (!text) return "";
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" || url.username || url.password)
      return fail(field);
    return url.href;
  } catch {
    return fail(field);
  }
}
export function validateProfileUpdate(
  body: unknown,
  current: ProfileInput,
): ProfileInput {
  if (!body || typeof body !== "object" || Array.isArray(body))
    return fail("body");
  const data = body as Record<string, unknown>;
  const next: ProfileInput = { ...current };
  for (const [key, max] of [
    ["displayName", 80],
    ["headline", 160],
    ["bio", 2000],
    ["education", 160],
    ["occupation", 160],
  ] as const) {
    if (key in data) next[key] = bounded(data[key], key, max);
  }
  if ("displayName" in data && next.displayName.length < 2)
    return fail("displayName");
  for (const [key, values] of [
    ["profileKind", ["student", "professional"]],
    ["visibility", ["private", "unlisted", "public"]],
    [
      "availability",
      ["available", "busy", "internship", "employment", "freelance"],
    ],
  ] as const) {
    if (key in data) {
      if (
        typeof data[key] !== "string" ||
        !(values as readonly string[]).includes(data[key] as string)
      )
        return fail(key);
      Object.assign(next, { [key]: data[key] });
    }
  }
  for (const key of ["github", "linkedin", "website"] as const)
    if (key in data) next[key] = safeLink(data[key], key);
  for (const key of ["shareAchievements", "shareOrganizations"] as const)
    if (key in data) {
      if (typeof data[key] !== "boolean") return fail(key);
      next[key] = data[key] as boolean;
    }
  if ("skills" in data) {
    if (!Array.isArray(data.skills) || data.skills.length > 20)
      return fail("skills");
    next.skills = [
      ...new Set(
        data.skills.map((s) => bounded(s, "skills", 60)).filter(Boolean),
      ),
    ];
  }
  if ("portfolio" in data) {
    if (!Array.isArray(data.portfolio) || data.portfolio.length > 6)
      return fail("portfolio");
    next.portfolio = data.portfolio.map((item) => {
      if (!item || typeof item !== "object") return fail("portfolio");
      const title = bounded(item.title, "portfolio", 100);
      const url = safeLink(item.url, "portfolio");
      if (!title || !url) return fail("portfolio");
      return { title, url };
    });
  }
  if ("avatar" in data) {
    const avatar = bounded(data.avatar, "avatar", 110000);
    if (avatar) {
      if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(avatar))
        return fail("avatar");
      const bytes = Buffer.from(avatar.split(",")[1], "base64");
      if (
        bytes.length > 80000 ||
        bytes[0] !== 255 ||
        bytes[1] !== 216 ||
        bytes[2] !== 255
      )
        return fail("avatar");
    }
    next.avatar = avatar;
  }
  return next;
}
type Row = {
  user_id: string;
  wallet: string;
  display_name: string | null;
  profile_kind: string;
  headline: string | null;
  bio: string | null;
  visibility: string | null;
  availability: string | null;
  details_json: string | null;
};
function parseDetails(raw: string | null): ProfileDetails {
  try {
    return { ...DEFAULT_DETAILS, ...JSON.parse(raw || "{}") };
  } catch {
    return { ...DEFAULT_DETAILS };
  }
}
function profileFields(row: Row): ProfileInput {
  return {
    ...parseDetails(row.details_json),
    displayName: row.display_name || "",
    profileKind:
      row.profile_kind === "professional" ? "professional" : "student",
    headline: row.headline || "",
    bio: row.bio || "",
    visibility: (row.visibility || "private") as ProfileInput["visibility"],
    availability: (row.availability ||
      "available") as ProfileInput["availability"],
  };
}
export function mayReadProfile(
  visibility: string,
  ownerId: string,
  viewerId?: string,
) {
  return (
    ownerId === viewerId || visibility === "public" || visibility === "unlisted"
  );
}
export function evidenceSkills(raw: string): string[] {
  try {
    return [
      ...new Set(
        (JSON.parse(raw) as unknown[]).flatMap((item) =>
          typeof item === "string"
            ? [item]
            : item &&
                typeof item === "object" &&
                "skill" in item &&
                typeof item.skill === "string"
              ? [item.skill]
              : [],
        ),
      ),
    ];
  } catch {
    return [];
  }
}
const SELECT = `SELECT u.id AS user_id, w.address AS wallet, u.display_name, u.profile_kind,
  t.headline, t.bio, t.visibility, t.availability, p.details_json
  FROM users u JOIN wallets w ON w.user_id=u.id
  LEFT JOIN talent_profiles t ON t.user_id=u.id LEFT JOIN wallet_profiles p ON p.user_id=u.id`;

export async function readWalletProfile(
  db: D1Database,
  wallet: string,
  viewerId?: string,
): Promise<WalletProfile | null> {
  await db.prepare(PROFILE_SCHEMA).run();
  const row = await db
    .prepare(`${SELECT} WHERE w.address=?`)
    .bind(wallet)
    .first<Row>();
  if (!row) return null;
  const fields = profileFields(row);
  const owner = viewerId === row.user_id;
  if (!mayReadProfile(fields.visibility, row.user_id, viewerId)) return null;
  const proofs: ProfileProof[] = [];
  if (owner || fields.shareAchievements) {
    const records = await db
      .prepare(
        `SELECT sc.id, c.title, o.name AS issuer, sc.score, sc.status, sc.expires_at, sc.issued_at, sc.skills_json
      FROM skill_credentials sc JOIN challenges c ON c.id=sc.challenge_id
      JOIN assessments a ON a.id=sc.assessment_id JOIN organizations o ON o.id=sc.issuer_organization_id
      WHERE sc.student_user_id=? AND sc.student_wallet=?
        AND (?=1 OR (c.access_type='public' AND c.deleted_at IS NULL AND a.status='approved'
          AND sc.status IN ('active','issued') AND julianday(sc.expires_at)>julianday('now')))
      ORDER BY sc.issued_at DESC LIMIT 100`,
      )
      .bind(row.user_id, wallet, owner ? 1 : 0)
      .all<{
        id: string;
        title: string;
        issuer: string;
        score: string;
        status: string;
        expires_at: string;
        issued_at: string | null;
        skills_json: string;
      }>();
    for (const proof of records.results) {
      const status =
        ["active", "issued"].includes(proof.status) &&
        Date.parse(proof.expires_at) <= Date.now()
          ? "expired"
          : proof.status;
      proofs.push({
        id: proof.id,
        title: proof.title,
        issuer: proof.issuer,
        score: proof.score,
        status,
        issuedAt: proof.issued_at,
        skills: evidenceSkills(proof.skills_json),
      });
    }
  }
  const organizations =
    owner || fields.shareOrganizations
      ? (
          await db
            .prepare(
              `SELECT DISTINCT o.name, o.kind FROM memberships m JOIN organizations o ON o.id=m.organization_id WHERE m.user_id=? AND m.status='active' ORDER BY o.name`,
            )
            .bind(row.user_id)
            .all<{ name: string; kind: string }>()
        ).results
      : [];
  return { ...fields, wallet, proofs, organizations };
}
export async function saveWalletProfile(
  db: D1Database,
  userId: string,
  body: unknown,
) {
  await db.prepare(PROFILE_SCHEMA).run();
  const row = await db
    .prepare(`${SELECT} WHERE u.id=?`)
    .bind(userId)
    .first<Row>();
  if (!row) throw new ProfileValidationError("PROFILE_NOT_FOUND");
  const data = validateProfileUpdate(body, profileFields(row));
  const {
    displayName,
    profileKind,
    headline,
    bio,
    visibility,
    availability,
    ...details
  } = data;
  await db.batch([
    db
      .prepare(
        "UPDATE users SET display_name=?, profile_kind=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
      )
      .bind(displayName, profileKind, userId),
    db
      .prepare(
        `INSERT INTO talent_profiles(user_id,headline,bio,visibility,availability) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET headline=excluded.headline,bio=excluded.bio,visibility=excluded.visibility,availability=excluded.availability,updated_at=CURRENT_TIMESTAMP`,
      )
      .bind(userId, headline, bio, visibility, availability),
    db
      .prepare(
        `INSERT INTO wallet_profiles(user_id,details_json) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET details_json=excluded.details_json,updated_at=CURRENT_TIMESTAMP`,
      )
      .bind(userId, JSON.stringify(details)),
  ]);
  return readWalletProfile(db, row.wallet, userId);
}

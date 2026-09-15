export type ApplicationProfile = {
  displayName: string;
  introduction: string;
  portfolio: string;
};
export function applicationProfile(value: unknown): ApplicationProfile {
  const v = value as Partial<ApplicationProfile> | null;
  if (
    !v ||
    typeof v.displayName !== "string" ||
    !v.displayName.trim() ||
    v.displayName.length > 80 ||
    typeof v.introduction !== "string" ||
    v.introduction.trim().length < 20 ||
    v.introduction.length > 3000 ||
    typeof v.portfolio !== "string" ||
    v.portfolio.length > 500
  )
    throw new Error("APPLICATION_INVALID");
  let portfolio = v.portfolio.trim();
  if (portfolio) {
    const url = new URL(portfolio);
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error("APPLICATION_INVALID");
    portfolio = url.href;
  }
  return {
    displayName: v.displayName.trim(),
    introduction: v.introduction.trim(),
    portfolio,
  };
}
export function opportunityAccepting(
  status: string,
  deadline: string | null,
  now = Date.now(),
) {
  return (
    status === "active" &&
    (!deadline ||
      (Number.isFinite(Date.parse(deadline)) && Date.parse(deadline) > now))
  );
}

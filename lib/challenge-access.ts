export const CHALLENGE_ACCESS_TYPES = ["public", "invite_only"] as const;

export type ChallengeAccessType = (typeof CHALLENGE_ACCESS_TYPES)[number];

export function isChallengeAccessType(value: unknown): value is ChallengeAccessType {
  return typeof value === "string" && CHALLENGE_ACCESS_TYPES.includes(value as ChallengeAccessType);
}

export function canJoinPublicChallenge(
  challenge: { status: string; accessType: string; closesAt?: string | null },
  now = new Date(),
) {
  return challenge.status === "published"
    && challenge.accessType === "public"
    && (!challenge.closesAt || challenge.closesAt > now.toISOString());
}

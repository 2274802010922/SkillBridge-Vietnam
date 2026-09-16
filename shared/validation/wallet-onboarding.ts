/** Public destinations only. Never load download URLs from user input. */
export const WALLET_DOWNLOADS = {
  phantom: { name: "Phantom", url: "https://phantom.com/download", domain: "phantom.com" },
  solflare: { name: "Solflare", url: "https://www.solflare.com/download/", domain: "solflare.com" },
} as const;

function unsafePathCharacters(value: string) {
  return [...value].some(char => char === "\\" || char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127);
}

export function safeWalletReturnTo(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/") || value.startsWith("//") || unsafePathCharacters(value)) return "/app";
  try {
    const decoded = decodeURIComponent(value.split(/[?#]/)[0]);
    if (decoded.startsWith("//") || unsafePathCharacters(decoded)) return "/app";
    const url = new URL(value, "https://skillbridge.invalid");
    if (url.origin !== "https://skillbridge.invalid" || /^\/(auth|api)(\/|$)/.test(url.pathname)) return "/app";
    for (const key of [...url.searchParams.keys()]) {
      if (/nonce|signature|session|token|secret|password|^code$|redirect|returnto/i.test(key)) url.searchParams.delete(key);
    }
    return url.pathname + url.search;
  } catch { return "/app"; }
}

export function walletHandoffUrl(origin: string, returnTo: string, locale: "vi" | "en") {
  const base = new URL(origin);
  if (!["https:", "http:"].includes(base.protocol) || base.username || base.password) throw new Error("Invalid origin");
  const url = new URL("/auth", base.origin);
  url.searchParams.set("returnTo", safeWalletReturnTo(returnTo));
  url.searchParams.set("lang", locale);
  return url.toString();
}

export function phantomBrowseUrl(origin: string, returnTo: string, locale: "vi" | "en") {
  const base = new URL(origin);
  if (base.protocol !== "https:") return null; // A phone cannot open a desktop's localhost.
  return `https://phantom.app/ul/browse/${encodeURIComponent(walletHandoffUrl(origin, returnTo, locale))}?ref=${encodeURIComponent(base.origin)}`;
}

export function preferredDetectedWallet(names: readonly string[], selected: string) {
  return names.includes(selected) ? selected : names[0] ?? "";
}

export function suggestedWalletDevice(userAgent: string, touchPoints = 0): "desktop" | "mobile" {
  return /Android|iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && touchPoints > 1) ? "mobile" : "desktop";
}

export function walletRequestWasCancelled(error: unknown) {
  const detail = error as { code?: unknown; message?: unknown } | null;
  return detail?.code === 4001 || /reject|cancel|declin|denied|hủy|từ chối/i.test(String(detail?.message ?? ""));
}

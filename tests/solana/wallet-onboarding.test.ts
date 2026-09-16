import assert from "node:assert/strict";
import test from "node:test";
import { WALLET_DOWNLOADS, safeWalletReturnTo, walletHandoffUrl, phantomBrowseUrl, preferredDetectedWallet, suggestedWalletDevice, walletRequestWasCancelled } from "../../shared/validation/wallet-onboarding.ts";
import { walletOnboardingCopy } from "../../frontend/i18n/wallet-onboarding.ts";

test("onboarding downloads are fixed official HTTPS destinations", () => {
  assert.deepEqual(Object.values(WALLET_DOWNLOADS).map(value => value.url), ["https://phantom.com/download", "https://www.solflare.com/download/"]);
});
test("wallet return path keeps internal challenge context and rejects external redirects", () => {
  assert.equal(safeWalletReturnTo("/challenge/invitation-123"), "/challenge/invitation-123");
  assert.equal(safeWalletReturnTo("/app/challenges?tab=mine"), "/app/challenges?tab=mine");
  for (const bad of [null, ["/app"], "https://evil.example", "//evil.example", "/\\evil.example", "/%5cevil.example", "/%2fevil.example", "/\nevil.example", "/%00evil", "/%broken", "/auth?returnTo=/auth", "/api/auth/session"]) {
    assert.equal(safeWalletReturnTo(bad), "/app", String(bad));
  }
});
test("handoff does not propagate auth secrets or the current browser session", () => {
  const result = new URL(walletHandoffUrl("https://example.org", "/app?tab=mine&nonce=secret&signature=x&session_token=x#secret", "en"));
  assert.equal(result.origin, "https://example.org");
  assert.equal(result.pathname, "/auth");
  assert.equal(result.searchParams.get("returnTo"), "/app?tab=mine");
  assert.equal(result.searchParams.get("lang"), "en");
  assert.equal(result.searchParams.size, 2);
  assert.equal(result.hash, "");
  assert.throws(() => walletHandoffUrl("javascript:evil", "/app", "vi"));
});
test("Phantom browse encodes the same-origin destination, language and internal return path", () => {
  const result = new URL(phantomBrowseUrl("https://example.org", "/join/invite-123", "en")!);
  assert.equal(result.origin, "https://phantom.app");
  const target = new URL(decodeURIComponent(result.pathname.slice("/ul/browse/".length)));
  assert.equal(target.origin, "https://example.org");
  assert.equal(target.searchParams.get("returnTo"), "/join/invite-123");
  assert.equal(target.searchParams.get("lang"), "en");
  assert.equal(result.searchParams.get("ref"), "https://example.org");
  assert.equal(phantomBrowseUrl("http://localhost:3000", "/app", "vi"), null);
});
test("discovery preserves selection, repairs removed wallets and handles an empty registry", () => {
  assert.equal(preferredDetectedWallet(["Phantom", "Solflare"], "Solflare"), "Solflare");
  assert.equal(preferredDetectedWallet(["Solflare"], "Phantom"), "Solflare");
  assert.equal(preferredDetectedWallet([], "Phantom"), "");
});
test("device suggestions support iPad desktop mode without assuming app installation", () => {
  assert.equal(suggestedWalletDevice("Mozilla Macintosh", 5), "mobile");
  assert.equal(suggestedWalletDevice("Mozilla Macintosh", 0), "desktop");
  assert.equal(suggestedWalletDevice("Android"), "mobile");
  assert.equal(suggestedWalletDevice("iPhone"), "mobile");
  assert.equal(suggestedWalletDevice("Windows"), "desktop");
});
test("user cancellation is distinct from verification and network failure", () => {
  assert.equal(walletRequestWasCancelled({ code: 4001 }), true);
  assert.equal(walletRequestWasCancelled(new Error("User rejected the request")), true);
  assert.equal(walletRequestWasCancelled(new Error("fetch failed")), false);
});
test("both onboarding languages have the same keys and three guide steps", () => {
  assert.deepEqual(Object.keys(walletOnboardingCopy.vi), Object.keys(walletOnboardingCopy.en));
  assert.equal(walletOnboardingCopy.vi.steps.length, 3);
  assert.equal(walletOnboardingCopy.en.steps.length, 3);
});

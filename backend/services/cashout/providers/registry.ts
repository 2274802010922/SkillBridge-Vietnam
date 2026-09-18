import type { CashoutEnvironment } from "../cashout.ts";
import { SandboxProvider, SANDBOX_PROVIDER } from "./sandbox.ts";
import { OfframpError } from "./types.ts";

/** Resolve stored orders separately from configuration for NEW orders. */
export function storedProvider(provider: string, mode: string, version = "2") {
  if (![SANDBOX_PROVIDER, "devnet_sandbox"].includes(provider) || mode !== "devnet_sandbox" || version !== "2")
    throw new OfframpError("Provider/mode/version unavailable; no funds should be sent", "PROVIDER_UNAVAILABLE", 503);
  return new SandboxProvider();
}
export function configuredProvider(env: CashoutEnvironment) {
  if (env.REAL_CASHOUT_ENABLED === "true" || env.OFFRAMP_API_BASE_URL || env.OFFRAMP_API_KEY)
    throw new OfframpError("Production adapter is not implemented. Use sandbox configuration only.", "PRODUCTION_UNAVAILABLE", 503);
  return storedProvider(env.OFFRAMP_PROVIDER || "devnet_sandbox", env.CASHOUT_MODE || "devnet_sandbox");
}

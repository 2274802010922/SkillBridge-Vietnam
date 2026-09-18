// Optional loopback-only browser fixture. No production route or real signing.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import bs58 from "bs58";
import { competitionFixture } from "./competition-fixture.ts";
const fixture = await competitionFixture();
const base = "http://localhost:3346";
const key = (n: number) => bs58.encode(new Uint8Array(32).fill(n));
const child = spawn(process.execPath, ["--import", "./tests/helpers/mock-offramp.mjs", "node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "3346"], {
  env: { ...process.env, TURSO_DATABASE_URL: fixture.dbUrl, TURSO_AUTH_TOKEN: "", SOLANA_RPC_URL: "http://127.0.0.1:39998",
    SOLANA_USDC_MINT: key(2), SOLANA_REWARD_VAULT_SECRET: "", SOLANA_AUTHORIZED_SIGNER_SECRET: "", CASHOUT_DEVNET_SETTLEMENT_WALLET: key(3),
    CASHOUT_MODE: "devnet_sandbox", REAL_CASHOUT_ENABLED: "false", OFFRAMP_PROVIDER: "devnet_sandbox", OFFRAMP_API_KEY: "", OFFRAMP_API_BASE_URL: "",
    EXCHANGE_RATE_API_KEY: "", OPEN_EXCHANGE_RATES_APP_ID: "", PYTH_HERMES_API_KEY: "" }, stdio: "ignore" });
for (let i = 0; i < 80; i++) { try { if ((await fetch(base)).ok) break; } catch { /* local server startup */ } await new Promise(r => setTimeout(r, 300)); }
const headers = { cookie: fixture.cookies.student, "content-type": "application/json" };
const response = await fetch(base + "/api/cashout/beneficiaries", { method: "POST", headers,
  body: JSON.stringify({ method: "bank", bankCode: "MB", destination: "000123456789", accountHolder: "QA ONLY" }) });
const { beneficiary } = await response.json() as { beneficiary: { id: string } };
const created = await fetch(base + "/api/cashout", { method: "POST", headers,
  body: JSON.stringify({ amountUsdc: "10", beneficiaryId: beneficiary.id, payoutMethod: "bank" }) });
const { session } = await created.json() as { session: { id: string } };
await fixture.db.prepare("UPDATE cashout_sessions SET status='reconciliation_required',verification_state='reconciliation_required',payment_tx=?,last_error_code='UNDERPAYMENT' WHERE id=?")
  .bind(bs58.encode(new Uint8Array(64).fill(7)), session.id).run();
const auth = createServer((req, res) => {
  if (req.url !== "/__qa") { res.writeHead(404); res.end(); return; }
  res.writeHead(302, { "set-cookie": fixture.cookies.student + "; Path=/; HttpOnly; SameSite=Lax", location: base + "/app/cashout" }); res.end();
});
auth.listen(3347, "127.0.0.1", () => console.log("Offramp browser fixture: http://localhost:3347/__qa (mock RPC, no broadcasts)"));
async function stop() { auth.close(); child.kill(); await fixture.stop(); process.exit(); }
process.on("SIGINT", () => void stop()); process.on("SIGTERM", () => void stop());

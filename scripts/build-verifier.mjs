import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
import nextEnv from "@next/env";
import { createKeyPairSignerFromBytes, address } from "gill";
import bs58 from "bs58";
nextEnv.loadEnvConfig(process.cwd());
const authorities = (process.env.SKILLBRIDGE_TRUSTED_ISSUERS || "")
  .split(/[\s,]+/)
  .filter(Boolean);
if (!authorities.length && process.env.SOLANA_ISSUER_SECRET) {
  const raw = process.env.SOLANA_ISSUER_SECRET;
  const issuer = await createKeyPairSignerFromBytes(
    raw.trim().startsWith("[")
      ? Uint8Array.from(JSON.parse(raw))
      : bs58.decode(raw),
  );
  authorities.push(String(issuer.address));
}
authorities.forEach((value) => address(value));
const out = "public/claim-verifier";
await mkdir(out, { recursive: true });
await build({
  entryPoints: ["tools/claim-verifier/main.ts"],
  outfile: out + "/app.js",
  bundle: true,
  minify: true,
  platform: "browser",
  target: "es2020",
  define: {
    "process.env.NODE_ENV": '"production"',
    __SKILLBRIDGE_ISSUERS__: JSON.stringify([...new Set(authorities)]),
  },
});
await copyFile("tools/claim-verifier/index.html", out + "/index.html");
await copyFile("tools/claim-verifier/style.css", out + "/style.css");
console.log(
  "Standalone verifier built. Serve public/claim-verifier on any static host.",
);

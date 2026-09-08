import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
const out = "public/claim-verifier";
await mkdir(out, { recursive: true });
await build({
  entryPoints: ["tools/claim-verifier/main.ts"],
  outfile: out + "/app.js",
  bundle: true,
  minify: true,
  platform: "browser",
  target: "es2020",
  define: { "process.env.NODE_ENV": '"production"' },
});
await copyFile("tools/claim-verifier/index.html", out + "/index.html");
await copyFile("tools/claim-verifier/style.css", out + "/style.css");
console.log(
  "Standalone verifier built. Serve public/claim-verifier on any static host.",
);

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve("public/claim-verifier");
const files = {
  "/": ["index.html", "text/html"],
  "/index.html": ["index.html", "text/html"],
  "/style.css": ["style.css", "text/css"],
  "/app.js": ["app.js", "text/javascript"],
};
createServer(async (request, response) => {
  const file = files[new URL(request.url, "http://localhost").pathname];
  if (!file || !["GET", "HEAD"].includes(request.method)) {
    response.writeHead(404);
    response.end();
    return;
  }
  try {
    const body = await readFile(resolve(root, file[0]));
    response.writeHead(200, {
      "Content-Type": file[1] + "; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    response.writeHead(503);
    response.end("Run npm run build:verifier first.");
  }
}).listen(3219, "127.0.0.1", () =>
  console.log(
    "Independent static verifier: http://127.0.0.1:3219 (no Next.js/API/database)",
  ),
);

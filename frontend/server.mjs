// Production web server for the TERRAFORM frontend (used on Render as a Node web service).
// Zero dependencies: serves the Vite build in ./dist, falls back to index.html for client routes,
// exposes /config.js with the backend URL from the API_BASE_URL env var (runtime, no rebuild needed),
// and /healthz for Render's health check.
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const DIST = resolve(process.cwd(), "dist");
const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || "0.0.0.0";

const normalizeUrl = (u) => {
  const v = (u || "").trim().replace(/\/+$/, "");
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
};
const API_BASE_URL = normalizeUrl(process.env.API_BASE_URL);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".bin": "application/octet-stream",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

if (!existsSync(join(DIST, "index.html"))) {
  console.error(`[terraform-web] ${DIST}/index.html not found — run "npm run build" first.`);
  process.exit(1);
}

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { "X-Content-Type-Options": "nosniff", ...headers });
  res.end(body);
};

const serveFile = (req, res, file, cache) => {
  const type = TYPES[extname(file).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": type,
    "Content-Length": statSync(file).size,
    "Cache-Control": cache,
    "X-Content-Type-Options": "nosniff",
  });
  if (req.method === "HEAD") return res.end();
  createReadStream(file).pipe(res);
};

createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed");
  const path = decodeURIComponent((req.url || "/").split("?")[0]);

  if (path === "/healthz") return send(res, 200, "ok", { "Content-Type": "text/plain" });
  if (path === "/config.js") {
    const body = `window.__TERRAFORM_CONFIG__ = ${JSON.stringify({ apiBaseUrl: API_BASE_URL })};\n`;
    return send(res, 200, body, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" });
  }

  // static file (guard against path traversal)
  const file = normalize(join(DIST, path));
  if (file.startsWith(DIST) && existsSync(file) && statSync(file).isFile()) {
    const immutable = path.startsWith("/assets/") && /-[A-Za-z0-9_-]{8,}\./.test(path);
    return serveFile(req, res, file, immutable ? "public, max-age=31536000, immutable" : "public, max-age=3600");
  }
  // unknown asset-looking paths → 404; everything else → SPA index.html
  if (extname(path)) return send(res, 404, "Not found", { "Content-Type": "text/plain" });
  return serveFile(req, res, join(DIST, "index.html"), "no-cache");
}).listen(PORT, HOST, () => {
  console.log(`[terraform-web] serving ${DIST} on http://${HOST}:${PORT}  (API_BASE_URL=${API_BASE_URL || "not set → frontend default"})`);
});

import serverEntry from "../dist/server/index.js";
import fs from "node:fs/promises";
import path from "node:path";

function toWebHeaders(nodeHeaders) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeHeaders ?? {})) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      headers.set(key, value.join(","));
    } else {
      headers.set(key, value);
    }
  }
  return headers;
}

function guessContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    case ".txt":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

async function tryReadFile(absPath) {
  try {
    const buf = await fs.readFile(absPath);
    return buf;
  } catch {
    return null;
  }
}

async function maybeServeStatic(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;

  const url = new URL(req.url, "http://local");
  // Vercel routes rewrite `/assets/*` to `/api/index?__asset=...` etc.
  const routedPath =
    url.searchParams.get("__asset") ??
    url.searchParams.get("__file") ??
    url.searchParams.get("__path");

  const pathname = routedPath
    ? `/${decodeURIComponent(routedPath).replace(/^\/+/, "")}`
    : decodeURIComponent(url.pathname);

  // Prevent path traversal; only serve plain paths
  if (pathname.includes("..")) return false;

  const clientRoot = path.resolve(process.cwd(), "dist", "client");

  const candidates = [];

  // Primary: /assets/* and anything under dist/client/*
  candidates.push(path.join(clientRoot, pathname));

  // Common: some apps reference hashed assets without /assets prefix
  if (!pathname.startsWith("/assets/")) {
    candidates.push(path.join(clientRoot, "assets", path.basename(pathname)));
  }

  // If requesting "/", allow the SSR app to handle it (not static).
  if (pathname === "/") return false;

  for (const abs of candidates) {
    const normalized = path.normalize(abs);
    if (!normalized.startsWith(clientRoot)) continue;
    const buf = await tryReadFile(normalized);
    if (!buf) continue;

    res.statusCode = 200;
    res.setHeader("Content-Type", guessContentType(normalized));
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    if (req.method === "HEAD") {
      res.end();
    } else {
      res.end(buf);
    }
    return true;
  }

  return false;
}

export default async function handler(req, res) {
  if (await maybeServeStatic(req, res)) return;

  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const incoming = new URL(req.url, `${proto}://${host}`);
  const originalPath = incoming.searchParams.get("__path");
  const requestUrl = originalPath
    ? `${proto}://${host}/${originalPath.replace(/^\/+/, "")}`
    : `${proto}://${host}${req.url}`;

  const request = new Request(requestUrl, {
    method: req.method,
    headers: toWebHeaders(req.headers),
    body: req.method === "GET" || req.method === "HEAD" ? undefined : req,
  });

  const entry = serverEntry?.default ?? serverEntry;
  const response = await entry.fetch(request);

  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));

  const buf = Buffer.from(await response.arrayBuffer());
  res.end(buf);
}


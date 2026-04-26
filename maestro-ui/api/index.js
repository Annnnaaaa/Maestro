import serverEntry from "../dist/server/index.js";

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

export default async function handler(req, res) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const url = `${proto}://${host}${req.url}`;

  const request = new Request(url, {
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


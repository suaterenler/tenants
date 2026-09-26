import http from "node:http";

const PORT = Number(process.env.EDGE_PORT ?? 3060);
const HOST = process.env.EDGE_HOST ?? "127.0.0.1";
const SOURCE = `${(process.env.TENANTS_INTERNAL_URL ?? "http://127.0.0.1:3050/admin").replace(/\/+$/, "")}/api/domains`;
const SECRET = (process.env.TENANTS_SECRET ?? process.env.PLATFORM_SECRET ?? "").trim();
const REFRESH_MS = 30_000;
const MISS_REFRESH_MS = 5_000;
const UPSTREAM_TIMEOUT_MS = 5 * 60 * 1000;
const HOP_HEADERS = new Set(["connection", "keep-alive", "proxy-connection", "transfer-encoding", "upgrade", "te", "trailer"]);

let routes = new Map();
let lastLoad = 0;
let lastMiss = 0;
let pending = null;

function log(message) {
  console.log(`${new Date().toISOString()} ${message}`);
}

async function load() {
  const response = await fetch(SOURCE, { headers: { Authorization: `Bearer ${SECRET}` }, signal: AbortSignal.timeout(15_000) });
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.error ?? `HTTP ${response.status}`);
  const next = payload.data.complete ? new Map() : new Map(routes);
  for (const route of payload.data.routes) next.set(route.domain, route);
  routes = next;
  lastLoad = Date.now();
}

function refresh() {
  pending ??= load()
    .catch((error) => log(`alan adi tablosu alinamadi: ${error.message}`))
    .finally(() => {
      pending = null;
    });
  return pending;
}

function hostOf(request) {
  const raw = request.headers["x-forwarded-host"] ?? request.headers.host ?? "";
  return String(raw).split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

async function resolve(host) {
  if (Date.now() - lastLoad > REFRESH_MS) await refresh();
  let route = routes.get(host);
  if (!route && Date.now() - lastMiss > MISS_REFRESH_MS) {
    lastMiss = Date.now();
    await refresh();
    route = routes.get(host);
  }
  return route ?? null;
}

function notConfigured(response, host) {
  response.writeHead(404, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  response.end(
    `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Alan adı tanımlı değil</title></head><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#fafafa;color:#222"><div style="text-align:center;padding:24px"><h1 style="font-size:20px;margin:0 0 8px">Alan adı tanımlı değil</h1><p style="margin:0;color:#666">${host.replace(/[<>&"]/g, "")} bu sunucuda henüz bir hesaba bağlanmamış.</p></div></body></html>`,
  );
}

function forward(request, response, route, host) {
  const target = new URL(route.target);
  const headers = {};
  for (const [name, value] of Object.entries(request.headers)) {
    if (!HOP_HEADERS.has(name.toLowerCase()) && value !== undefined) headers[name] = value;
  }
  headers.host = host;
  headers["x-forwarded-host"] = host;
  const upstream = http.request(
    { hostname: target.hostname, port: target.port || 80, method: request.method, path: request.url, headers, timeout: UPSTREAM_TIMEOUT_MS },
    (upstreamResponse) => {
      const outgoing = {};
      for (const [name, value] of Object.entries(upstreamResponse.headers)) {
        if (!HOP_HEADERS.has(name.toLowerCase()) && value !== undefined) outgoing[name] = value;
      }
      response.writeHead(upstreamResponse.statusCode ?? 502, outgoing);
      upstreamResponse.pipe(response);
    },
  );
  upstream.on("timeout", () => upstream.destroy(new Error("upstream timeout")));
  upstream.on("error", (error) => {
    log(`${host} -> ${route.target}: ${error.message}`);
    if (!response.headersSent) response.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Uygulamaya ulaşılamadı.");
  });
  request.pipe(upstream);
}

const server = http.createServer(async (request, response) => {
  const host = hostOf(request);
  if (request.url === "/__edge/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: true, routes: routes.size, lastLoad }));
    return;
  }
  const route = await resolve(host);
  if (!route) return notConfigured(response, host);
  forward(request, response, route, host);
});

server.keepAliveTimeout = 65_000;
server.listen(PORT, HOST, () => {
  log(`edge ${HOST}:${PORT} -> ${SOURCE}`);
  void refresh();
});

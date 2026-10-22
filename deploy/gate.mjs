import http from "node:http";
import { readFileSync } from "node:fs";

const LISTEN_PORT = Number(process.env.GATE_PORT ?? 3050);
const HOST = process.env.GATE_HOST ?? "127.0.0.1";
const STATE_FILE = process.env.GATE_STATE ?? "/gate/active-port";
const FALLBACK = Number(process.env.GATE_DEFAULT ?? 3061);

let cached = { port: FALLBACK, at: 0 };

function activePort() {
  const now = Date.now();
  if (now - cached.at < 1000) return cached.port;
  let port = cached.port;
  try {
    const value = Number(readFileSync(STATE_FILE, "utf8").trim());
    if (Number.isInteger(value) && value > 0 && value < 65536) port = value;
  } catch {
    port = cached.port;
  }
  cached = { port, at: now };
  return port;
}

function forward(req, res, port, retry) {
  const upstream = http.request(
    { host: "127.0.0.1", port, method: req.method, path: req.url, headers: req.headers },
    (response) => {
      res.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(res);
    },
  );
  upstream.on("error", (error) => {
    if (retry && !res.headersSent && (req.method === "GET" || req.method === "HEAD") && (error.code === "ECONNREFUSED" || error.code === "ECONNRESET")) {
      cached.at = 0;
      const next = activePort();
      setTimeout(() => forward(req, res, next, false), next === port ? 1500 : 0);
      return;
    }
    if (!res.headersSent) {
      res.writeHead(503, { "Content-Type": "text/html; charset=utf-8", "Retry-After": "5" });
      res.end('<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="5"><title>Güncelleniyor</title><p style="font-family:sans-serif;margin:3rem;text-align:center">Kısa bir güncelleme yapılıyor, sayfa birkaç saniye içinde kendiliğinden yenilenecek.</p>');
    } else {
      res.destroy();
    }
  });
  res.on("close", () => upstream.destroy());
  req.pipe(upstream);
}

http
  .createServer((req, res) => {
    if (req.url === "/__gate/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(String(activePort()));
      return;
    }
    forward(req, res, activePort(), true);
  })
  .listen(LISTEN_PORT, HOST, () => console.log(`gate ${HOST}:${LISTEN_PORT} -> ${activePort()}`));

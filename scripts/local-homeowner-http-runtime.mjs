import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, relative, resolve } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const staticRoot = resolve(projectRoot, "dist");
const port = Number(process.env.TAURO_PG_LOCAL_HTTP_PORT ?? "55400");
const host = "127.0.0.1";

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("TAURO_PG_LOCAL_HTTP_PORT must be an integer between 1 and 65535.");
}

export const localRuntimeApiModules = Object.freeze({
  "/api/paint-guide/homeowner/exchange": "api/paint-guide/homeowner/exchange.js",
  "/api/paint-guide/homeowner/document": "api/paint-guide/homeowner/document.js",
  "/api/paint-guide/homeowner/end-session": "api/paint-guide/homeowner/end-session.js",
  "/api/paint-guide/staff/access/status": "api/paint-guide/staff/access/status.js",
  "/api/paint-guide/staff/access/issue": "api/paint-guide/staff/access/issue.js",
  "/api/paint-guide/staff/access/recover": "api/paint-guide/staff/access/recover.js",
  "/api/paint-guide/staff/access/rotate": "api/paint-guide/staff/access/rotate.js",
  "/api/paint-guide/staff/access/revoke": "api/paint-guide/staff/access/revoke.js",
});

export function resolveLocalRuntimeApiModule(pathname) {
  return localRuntimeApiModules[pathname] ?? null;
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

function pathInside(root, pathname) {
  const resolved = resolve(root, `.${pathname}`);
  const pathFromRoot = relative(root, resolved);
  return pathFromRoot.startsWith("..") || pathFromRoot === "" ? null : resolved;
}

function copyResponseHeaders(response, nodeResponse) {
  const setCookies = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : response.headers.get("set-cookie")
      ? [response.headers.get("set-cookie")]
      : [];
  for (const [name, value] of response.headers) {
    if (name !== "set-cookie") nodeResponse.setHeader(name, value);
  }
  if (setCookies.length) nodeResponse.setHeader("Set-Cookie", setCookies);
}

async function loadApiHandlers() {
  const handlers = new Map();
  for (const [pathname, modulePath] of Object.entries(localRuntimeApiModules)) {
    const module = await import(new URL(`../dist/local-homeowner-runtime/${modulePath}`, import.meta.url));
    if (!module.default || typeof module.default.fetch !== "function") {
      throw new Error(`Compiled API entrypoint is unavailable: ${pathname}`);
    }
    handlers.set(pathname, module.default.fetch);
  }
  return handlers;
}

async function serveStatic(pathname, nodeResponse) {
  const filePath = pathname === "/paint-guide" || pathname.startsWith("/paint-guide/")
    ? resolve(staticRoot, "paint-guide.html")
    : pathname.startsWith("/assets/")
      ? pathInside(staticRoot, pathname)
      : pathname.startsWith("/tauro/")
        ? pathInside(staticRoot, pathname)
      : null;
  if (!filePath) return false;

  try {
    await access(filePath);
    if (!(await stat(filePath)).isFile()) return false;
  } catch {
    return false;
  }

  nodeResponse.statusCode = 200;
  nodeResponse.setHeader("Content-Type", mimeTypes[extname(filePath)] ?? "application/octet-stream");
  createReadStream(filePath).pipe(nodeResponse);
  return true;
}

export function requestFromNode(nodeRequest) {
  const bodyAllowed = nodeRequest.method !== "GET" && nodeRequest.method !== "HEAD";
  return new Request(new URL(nodeRequest.url ?? "/", `http://${host}:${port}`), {
    method: nodeRequest.method,
    headers: nodeRequest.headers,
    body: bodyAllowed ? Readable.toWeb(nodeRequest) : undefined,
    duplex: bodyAllowed ? "half" : undefined,
  });
}

async function respondWithWebResponse(response, nodeResponse) {
  nodeResponse.statusCode = response.status;
  copyResponseHeaders(response, nodeResponse);
  if (!response.body) return nodeResponse.end();
  Readable.fromWeb(response.body).pipe(nodeResponse);
}

async function main() {
  const handlers = await loadApiHandlers();
  if (process.argv.includes("--check")) {
    process.stdout.write("Local homeowner HTTP runtime API entrypoints: ready\n");
    return;
  }

  const server = createServer(async (nodeRequest, nodeResponse) => {
    try {
      const pathname = new URL(nodeRequest.url ?? "/", `http://${host}:${port}`).pathname;
      const handler = handlers.get(pathname);
      if (handler) {
        await respondWithWebResponse(await handler(requestFromNode(nodeRequest)), nodeResponse);
        return;
      }
      if (await serveStatic(pathname, nodeResponse)) return;
      nodeResponse.statusCode = 404;
      nodeResponse.end("Not found");
    } catch {
      nodeResponse.statusCode = 500;
      nodeResponse.end("Local runtime unavailable");
    }
  });

  server.listen(port, host, () => {
    process.stdout.write(`Local homeowner HTTP runtime listening at http://${host}:${port}\n`);
  });
  process.once("SIGINT", () => server.close(() => process.exit(0)));
  process.once("SIGTERM", () => server.close(() => process.exit(0)));
}

const invokedDirectly = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) await main();

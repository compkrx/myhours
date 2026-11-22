import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, relative, resolve, sep } from "node:path";

const root = resolve("dist");
const basePath = (process.env.TEST_BASE_PATH || "/").replace(/\/?$/, "/");
const port = Number(process.env.TEST_PORT || 4173);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};

if (!existsSync(resolve(root, "index.html"))) {
  throw new Error("Build the app before starting the browser test server.");
}

const server = createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(request.url || "/", "http://localhost").pathname,
    );
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }

  if (!pathname.startsWith(basePath)) {
    response.writeHead(404).end("Not found");
    return;
  }

  const relativePath = pathname.slice(basePath.length) || "index.html";
  let file = resolve(root, relativePath);
  const pathFromRoot = relative(root, file);
  if (pathFromRoot.startsWith(`..${sep}`) || pathFromRoot === "..") {
    response.writeHead(404).end("Not found");
    return;
  }

  if (!existsSync(file) || !statSync(file).isFile()) {
    if (extname(relativePath)) {
      response.writeHead(404).end("Not found");
      return;
    }
    file = resolve(root, "index.html");
  }

  response.writeHead(200, {
    "Content-Type": mimeTypes[extname(file)] || "application/octet-stream",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  createReadStream(file).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`MyHours browser test server: http://127.0.0.1:${port}${basePath}`);
});

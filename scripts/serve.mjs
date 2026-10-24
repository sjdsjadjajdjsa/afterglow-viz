import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};

export function serve(root, port = Number(process.env.PORT) || 5173) {
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
      const file = normalize(join(root, path === "/" ? "dev.html" : path));
      if (!file.startsWith(root)) throw new Error("outside root");
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
      res.end(body);
    } catch {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not found");
    }
  });
  server.listen(port, "127.0.0.1", () => console.log(`Harness running at http://127.0.0.1:${port}/dev.html`));
  return server;
}

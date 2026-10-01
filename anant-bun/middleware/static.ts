import { file, serve } from "bun";
import path from "path";

const MIME: Record<string, string> = {
    ".html": "text/html",
    ".js":   "application/javascript",
    ".mjs":  "application/javascript",
    ".css":  "text/css",
    ".json": "application/json",
    ".png":  "image/png",
    ".svg":  "image/svg+xml",
    ".ico":  "image/x-icon",
    ".woff2":"font/woff2",
    ".woff": "font/woff",
    ".ttf":  "font/ttf",
};

export async function serveStatic(req: Request, staticDir: string): Promise<Response> {
    const url  = new URL(req.url);
    let   p    = url.pathname;

    // Map root to index.html
    if (p === "/" || !path.extname(p)) p = "/index.html";

    const filePath = path.join(staticDir, p);
    const f = Bun.file(filePath);

    if (!(await f.exists())) {
        // SPA fallback — serve index.html for any unknown route
        const index = Bun.file(path.join(staticDir, "index.html"));
        if (await index.exists()) {
            return new Response(index, { headers: { "Content-Type": "text/html" } });
        }
        return new Response("Not Found", { status: 404 });
    }

    const ext  = path.extname(filePath);
    const mime = MIME[ext] ?? "application/octet-stream";

    return new Response(f, {
        headers: {
            "Content-Type": mime,
            "Cache-Control": ext === ".html" ? "no-cache" : "max-age=86400",
        },
    });
}

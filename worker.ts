type Fetcher = { fetch: (request: Request) => Promise<Response> };

interface Env {
  ASSETS: Fetcher;
}

const securityHeaders: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
  "X-Frame-Options": "DENY"
};

function withSecurityHeaders(res: Response): Response {
  const next = new Response(res.body, res);
  for (const [k, v] of Object.entries(securityHeaders)) next.headers.set(k, v);
  return next;
}

function shouldSpaFallback(request: Request): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  const accept = request.headers.get("accept") ?? "";
  if (!accept.includes("text/html")) return false;
  const url = new URL(request.url);
  if (url.pathname.includes(".")) return false;
  return true;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    let res = await env.ASSETS.fetch(request);

    if (res.status === 404 && shouldSpaFallback(request)) {
      const url = new URL(request.url);
      url.pathname = "/index.html";
      res = await env.ASSETS.fetch(new Request(url.toString(), request));
    }

    return withSecurityHeaders(res);
  }
};

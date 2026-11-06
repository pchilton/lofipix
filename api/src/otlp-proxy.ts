import { type Context } from "hono";

export async function proxyOtlp(c: Context, organizationId: string, userId: string) {
  const upstream = process.env.UPTRACE_INTERNAL_URL ?? "http://127.0.0.1:14318";
  const url = new URL(c.req.path.replace(/^\/api\/telemetry/, ""), upstream);
  const headers = new Headers(c.req.raw.headers);
  headers.delete("host");
  const projectToken = process.env.UPTRACE_PROJECT_TOKEN;
  if (projectToken) {
    headers.set("uptrace-dsn", projectToken);
  }
  headers.set("x-lofipix-organization", organizationId);
  headers.set("x-lofipix-user", userId);

  const response = await fetch(url, {
    method: c.req.method,
    headers,
    body:
      c.req.method === "GET" || c.req.method === "HEAD"
        ? undefined
        : c.req.raw.body,
  });

  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  });
}

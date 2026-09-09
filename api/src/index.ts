import { Hono } from "hono";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/", (c) => c.json({ name: "lofipix api" }));

app.get("/api/hello", (c) => c.json({ message: "hello from lofipix" }));

export default app;

if (import.meta.env.PROD) {
  const { serve } = await import("@hono/node-server");
  const port = Number(process.env.PORT ?? 3000);
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`api listening on http://localhost:${info.port}`);
  });
}

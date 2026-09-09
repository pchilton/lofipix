import { Hono } from "hono";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/", (c) => c.json({ name: "lofipix api" }));

app.get("/api/hello", (c) => c.json({ message: "hello from lofipix" }));

export default {
  port: Number(process.env.PORT ?? 3000),
  fetch: app.fetch,
};


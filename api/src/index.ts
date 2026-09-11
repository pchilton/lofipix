import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { getDb } from "./db";

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok" }));

app.get("/", (c) => c.json({ name: "lofipix api" }));

app.get("/api/hello", (c) => c.json({ message: "hello from lofipix" }));

app.get("/db/status", async (c) => {
  try {
    await getDb().execute(sql`select 1`);
    return c.json({ status: "connected" });
  } catch (error) {
    console.error("Database health check failed:", error);
    return c.json({ status: "disconnected" }, 503);
  }
});

export default {
  port: Number(process.env.PORT ?? 3000),
  hostname: "0.0.0.0",
  fetch: app.fetch,
};

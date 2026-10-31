import { Hono } from "hono";
import { cors } from "hono/cors";
import { sql } from "drizzle-orm";
import { db as baseDb } from "@lofipix/db";
import { auth } from "@lofipix/db/auth";

const app = new Hono();

const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  "http://192.168.1.15:5173",
  "http://localhost:5174",
  "http://192.168.1.15:5174",
  "https://www.lofipix.app",
  "https://pwa.lofipix.app",
]);

app.use(
  "*",
  cors({
    origin: (origin) => (ALLOWED_ORIGINS.has(origin) ? origin : undefined),
    credentials: true,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.get("/health", (c) => c.json({ status: "ok" }));
app.get("/", (c) => c.json({ name: "lofipix api" }));
app.get("/api/hello", (c) => c.json({ message: "hello from lofipix" }));

app.get("/db/status", async (c) => {
  try {
    await baseDb.execute(sql`select 1`);
    return c.json({ status: "connected" });
  } catch (error) {
    console.error("Database health check failed:", error);
    return c.json({ status: "disconnected" }, 503);
  }
});

export default {
  port: Number(process.env.PORT ?? 5634),
  hostname: "0.0.0.0",
  fetch: app.fetch,
};

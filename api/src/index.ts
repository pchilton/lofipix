import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { sql } from "drizzle-orm";
import { db as baseDb } from "@lofipix/db";
import { auth } from "@lofipix/db/auth";
import { syncMutationsRequestSchema } from "@lofipix/db/schema";
import { applySyncMutations } from "./sync-mutations";
import { proxyShape } from "./sync-shapes";
import { proxyOtlp } from "./otlp-proxy";

const app = new Hono();

const ALLOWED_ORIGINS = new Set([
  "http://192.168.1.15:5173",
  "http://192.168.1.15:4173",
  "https://www.lofipix.app",
  "lofipix://",
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

async function resolveActiveOrganization(
  userId: string,
  activeOrganizationId: string | null | undefined,
) {
  const context = await auth.$context;
  const members = await context.adapter.findMany<{ organizationId: string }>({
    model: "member",
    where: [{ field: "userId", value: userId }],
    limit: 2,
  });
  if (!members || members.length !== 1) {
    return null;
  }
  if (activeOrganizationId && members[0].organizationId !== activeOrganizationId) {
    return null;
  }
  return members[0].organizationId;
}

async function resolveSession(c: Context) {
  return auth.api.getSession({ headers: c.req.raw.headers });
}

async function requireSyncContext(c: Context) {
  const session = await resolveSession(c);
  if (!session) {
    return { error: c.json({ error: "Not signed in." }, 401) } as const;
  }
  const organizationId = await resolveActiveOrganization(
    session.user.id,
    session.session.activeOrganizationId,
  );
  if (!organizationId) {
    return { error: c.json({ error: "No organisation membership." }, 403) } as const;
  }
  return { session, organizationId } as const;
}

app.on(["GET", "POST"], "/api/sync/shapes/:table", async (c) => {
  const context = await requireSyncContext(c);
  if ("error" in context) {
    return context.error;
  }
  return proxyShape(c, context.organizationId);
});

app.post("/api/sync/mutations", async (c) => {
  const context = await requireSyncContext(c);
  if ("error" in context) {
    return context.error;
  }

  const parsed = syncMutationsRequestSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) {
    return c.json({ error: "Invalid mutations.", issues: parsed.error.issues }, 400);
  }

  const results = await applySyncMutations(
    context.organizationId,
    context.session.user.id,
    parsed.data.mutations,
  );
  return c.json({ results });
});

app.on(["POST", "PUT"], "/api/telemetry/*", async (c) => {
  const context = await requireSyncContext(c);
  if ("error" in context) {
    return context.error;
  }
  return proxyOtlp(c, context.organizationId, context.session.user.id);
});
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

import { Hono } from "hono";
import { cors } from "hono/cors";
import { sql } from "drizzle-orm";
import { ZodError } from "zod";
import { db as baseDb } from "@lofipix/db";
import { auth } from "@lofipix/db/auth";
import { syncUploadRequestSchema } from "@lofipix/db/schema";
import { applySyncOperations, SyncForbiddenError } from "./sync-upload";

const app = new Hono();

const ALLOWED_ORIGINS = new Set([
  "http://192.168.1.15:5173",
  "http://192.168.1.15:5174",
  "http://192.168.1.15:5175",
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

async function resolveActiveOrganization(userId: string, activeOrganizationId: string | null | undefined) {
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

app.get("/api/sync/token", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: "Not signed in." }, 401);
  }
  const organizationId = await resolveActiveOrganization(
    session.user.id,
    session.session.activeOrganizationId,
  );
  if (!organizationId) {
    return c.json({ error: "No organisation membership." }, 403);
  }

  const context = await auth.$context;
  const jwtPlugin = context.getPlugin("jwt");
  if (!jwtPlugin?.endpoints.signJWT) {
    return c.json({ error: "PowerSync JWT signing is not configured." }, 500);
  }
  const result = await jwtPlugin.endpoints.signJWT({
    context,
    body: {
      payload: {
        sub: session.user.id,
        organization_id: organizationId,
        aud: process.env.POWERSYNC_AUDIENCE,
      },
      overrideOptions: {
        jwt: { audience: process.env.POWERSYNC_AUDIENCE, expirationTime: "15 minutes" },
      },
    },
  });
  return c.json({ token: result.token });
});

app.post("/api/sync/upload", async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: "Not signed in." }, 401);
  }

  const organizationId = await resolveActiveOrganization(
    session.user.id,
    session.session.activeOrganizationId,
  );
  if (!organizationId) {
    return c.json({ error: "No organisation membership." }, 403);
  }

  const parsed = syncUploadRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "Invalid upload.", issues: parsed.error.issues }, 400);
  }

  try {
    await applySyncOperations(organizationId, parsed.data.operations);
  } catch (error) {
    if (error instanceof SyncForbiddenError) {
      return c.json({ error: error.message }, 403);
    }
    if (error instanceof ZodError) {
      return c.json({ error: "Invalid row.", issues: error.issues }, 422);
    }
    throw error;
  }

  return c.json({ applied: parsed.data.operations.length });
});


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

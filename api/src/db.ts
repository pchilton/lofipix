import { drizzle } from "drizzle-orm/bun-sql";

let db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  if (!db) {
    db = drizzle(connectionString);
  }

  return db;
}

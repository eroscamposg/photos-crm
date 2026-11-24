import { sql } from "drizzle-orm";

import { db } from "@/db";
import { storageHealth } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  let database: "ok" | "error" = "ok";
  try {
    await db.execute(sql`select 1`);
  } catch (error) {
    console.error("[health] database", error);
    database = "error";
  }
  const storage = await storageHealth();
  return Response.json(
    { app: "ok", database, storage },
    { status: database === "ok" ? 200 : 503 },
  );
}

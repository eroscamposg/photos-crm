import { eq } from "drizzle-orm";

import { db } from "@/db";
import { rateLimits } from "@/db/schema";

export async function consumeRateLimit(key: string, limit: number, windowMs: number) {
  const now = new Date();
  const [row] = await db.select().from(rateLimits).where(eq(rateLimits.key, key)).limit(1);
  if (!row || now.getTime() - row.windowStart.getTime() >= windowMs) {
    await db
      .insert(rateLimits)
      .values({ key, count: 1, windowStart: now })
      .onConflictDoUpdate({ target: rateLimits.key, set: { count: 1, windowStart: now } });
    return { ok: true, remaining: limit - 1 };
  }
  if (row.count >= limit) return { ok: false, remaining: 0 };
  await db.update(rateLimits).set({ count: row.count + 1 }).where(eq(rateLimits.key, key));
  return { ok: true, remaining: limit - row.count - 1 };
}

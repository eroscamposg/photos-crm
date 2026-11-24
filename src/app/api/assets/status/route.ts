import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { assets } from "@/db/schema";
import { requireStaff } from "@/lib/studio";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ctx = await requireStaff();
  const ids =
    new URL(request.url).searchParams
      .get("ids")
      ?.split(",")
      .filter(Boolean)
      .slice(0, 40) ?? [];
  if (!ids.length) return Response.json({ assets: [] });
  const rows = await db
    .select({ id: assets.id, status: assets.status, error: assets.error })
    .from(assets)
    .where(and(eq(assets.studioId, ctx.studio.id), inArray(assets.id, ids)));
  return Response.json({ assets: rows });
}

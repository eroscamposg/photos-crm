import { eq } from "drizzle-orm";

import { db } from "@/db";
import { studios } from "@/db/schema";
import { isStorageConfigured, objectExists } from "@/lib/storage";
import { requireStaff } from "@/lib/studio";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ctx = await requireStaff();
  if (ctx.role !== "owner")
    return Response.json(
      { error: "Only the owner can change the logo." },
      { status: 403 },
    );
  if (!isStorageConfigured())
    return Response.json(
      { error: "Storage is not configured" },
      { status: 503 },
    );
  const body = (await request.json()) as { key?: string };
  const key = String(body.key ?? "");
  if (key !== `brand/${ctx.studio.id}/logo`)
    return Response.json({ error: "Unexpected logo key" }, { status: 400 });
  try {
    await objectExists(key);
  } catch {
    return Response.json(
      { error: "Logo upload has not arrived." },
      { status: 400 },
    );
  }
  await db
    .update(studios)
    .set({ logoKey: key, updatedAt: new Date() })
    .where(eq(studios.id, ctx.studio.id));
  return Response.json({ ok: true });
}

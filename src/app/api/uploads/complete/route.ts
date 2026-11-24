import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { assets } from "@/db/schema";
import { enqueueJob } from "@/lib/jobs";
import { isStorageConfigured, objectExists } from "@/lib/storage";
import { requireStaff } from "@/lib/studio";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ctx = await requireStaff();
  if (!isStorageConfigured())
    return Response.json(
      { error: "Storage is not configured" },
      { status: 503 },
    );
  const body = (await request.json()) as { assetId?: string };
  const [asset] = await db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.id, String(body.assetId ?? "")),
        eq(assets.studioId, ctx.studio.id),
      ),
    )
    .limit(1);
  if (!asset)
    return Response.json({ error: "Asset not found" }, { status: 404 });
  try {
    await objectExists(asset.originalKey);
  } catch {
    return Response.json(
      { error: "The upload has not arrived in storage yet." },
      { status: 400 },
    );
  }
  await enqueueJob({
    studioId: ctx.studio.id,
    type: "derivatives",
    payload: { assetId: asset.id },
  });
  return Response.json({ ok: true, assetId: asset.id });
}

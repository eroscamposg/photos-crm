import { and, eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";

import { db } from "@/db";
import {
  assets,
  downloadAudits,
  galleryAssets,
  galleryLinks,
} from "@/db/schema";
import { galleryCookieName, signValue } from "@/lib/passwords";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isStorageConfigured, presignGet } from "@/lib/storage";
import { clientIp } from "@/lib/studio";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const ip = await clientIp();
  const limit = await consumeRateLimit(
    `download:${token}:${ip}`,
    40,
    60 * 60 * 1000,
  );
  if (!limit.ok)
    return Response.json(
      { error: "Too many downloads. Try again later." },
      { status: 429 },
    );
  if (!isStorageConfigured())
    return Response.json(
      { error: "Downloads are not configured." },
      { status: 503 },
    );
  const [link] = await db
    .select()
    .from(galleryLinks)
    .where(eq(galleryLinks.token, token))
    .limit(1);
  if (!link)
    return Response.json({ error: "Gallery not found" }, { status: 404 });
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
    return Response.json({ error: "This link has expired" }, { status: 410 });
  }
  if (link.passwordHash) {
    const jar = await cookies();
    if (jar.get(galleryCookieName(token))?.value !== signValue(token)) {
      return Response.json({ error: "Password required" }, { status: 401 });
    }
  }
  const body = (await request.json()) as { assetId?: string; tier?: string };
  const assetId = String(body.assetId ?? "");
  const tier =
    body.tier === "web" || body.tier === "original" || body.tier === "preview"
      ? body.tier
      : "preview";
  const [item] = await db
    .select()
    .from(galleryAssets)
    .where(
      and(
        eq(galleryAssets.galleryId, link.galleryId),
        eq(galleryAssets.assetId, assetId),
        eq(galleryAssets.studioId, link.studioId),
      ),
    )
    .limit(1);
  if (!item)
    return Response.json(
      { error: "Photo not in this gallery" },
      { status: 404 },
    );
  if (
    tier === "web" &&
    item.downloadTier !== "web" &&
    item.downloadTier !== "original"
  ) {
    return Response.json(
      { error: "Web downloads are not enabled for this photo" },
      { status: 403 },
    );
  }
  if (tier === "original" && item.downloadTier !== "original") {
    return Response.json(
      { error: "Original downloads are not enabled for this photo" },
      { status: 403 },
    );
  }
  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, item.assetId), eq(assets.studioId, link.studioId)))
    .limit(1);
  if (!asset) return Response.json({ error: "Photo missing" }, { status: 404 });
  const key =
    tier === "original"
      ? asset.originalKey
      : tier === "web"
        ? asset.webKey
        : asset.watermarkedKey;
  if (!key)
    return Response.json(
      { error: "That version is still processing" },
      { status: 409 },
    );
  const headerStore = await headers();
  await db.insert(downloadAudits).values({
    id: crypto.randomUUID(),
    studioId: link.studioId,
    galleryLinkId: link.id,
    assetId: asset.id,
    tier,
    ip,
    userAgent: headerStore.get("user-agent"),
  });
  return Response.json({ url: await presignGet(key, 60) });
}

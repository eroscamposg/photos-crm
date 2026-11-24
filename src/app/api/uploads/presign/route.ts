import { db } from "@/db";
import { assets } from "@/db/schema";
import {
  MAX_UPLOAD_BYTES,
  isStorageConfigured,
  normalizeUploadType,
  presignPut,
} from "@/lib/storage";
import { requireStaff } from "@/lib/studio";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ctx = await requireStaff();
  if (!isStorageConfigured())
    return Response.json(
      { error: "Storage is not configured" },
      { status: 503 },
    );
  const body = (await request.json()) as {
    filename?: string;
    contentType?: string;
    byteSize?: number;
    purpose?: string;
  };
  const filename = String(body.filename ?? "photo").slice(0, 180);
  const byteSize = Number(body.byteSize ?? 0);
  const declared = String(body.contentType ?? "");
  const contentType =
    body.purpose === "logo" &&
    (declared === "image/png" || filename.toLowerCase().endsWith(".png"))
      ? "image/png"
      : normalizeUploadType(filename, declared);
  if (
    !contentType ||
    !Number.isFinite(byteSize) ||
    byteSize <= 0 ||
    byteSize > MAX_UPLOAD_BYTES
  ) {
    return Response.json(
      { error: "Use a JPEG, WebP, or HEIC under 40 MB." },
      { status: 400 },
    );
  }
  if (body.purpose === "logo") {
    const key = `brand/${ctx.studio.id}/logo`;
    const url = await presignPut(key, contentType);
    return Response.json({ url, key, contentType });
  }
  const assetId = crypto.randomUUID();
  const key = `originals/${ctx.studio.id}/${assetId}`;
  await db.insert(assets).values({
    id: assetId,
    studioId: ctx.studio.id,
    originalKey: key,
    filename,
    contentType,
    byteSize: Math.round(byteSize),
    status: "pending",
    kind: "original",
  });
  const url = await presignPut(key, contentType);
  return Response.json({ url, key, assetId, contentType });
}

import { eq } from "drizzle-orm";
import sharp from "sharp";

import { db } from "@/db";
import {
  assets,
  editRecipes,
  galleries,
  galleryAssets,
  studios,
} from "@/db/schema";
import {
  sanitizeRecipe,
  sharpAdjustments,
  type EditRecipe,
} from "@/lib/recipe";
import { readObject, writeObject } from "@/lib/storage";

async function orientedBuffer(bytes: Buffer) {
  return sharp(bytes, { failOn: "none" }).rotate().toBuffer();
}

function watermarkSvg(width: number, height: number, label: string) {
  const fontSize = Math.max(28, Math.round(width / 14));
  const safe = label.replace(/[<>&]/g, "");
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="rgba(255,255,255,0.55)" font-size="${fontSize}" font-family="sans-serif" transform="rotate(-28 ${width / 2} ${height / 2})">${safe}</text></svg>`,
  );
}

export async function processDerivatives(assetId: string) {
  const [asset] = await db
    .select()
    .from(assets)
    .where(eq(assets.id, assetId))
    .limit(1);
  if (!asset) throw new Error("Asset not found");
  const [studio] = await db
    .select()
    .from(studios)
    .where(eq(studios.id, asset.studioId))
    .limit(1);
  await db
    .update(assets)
    .set({ status: "processing", error: null })
    .where(eq(assets.id, asset.id));
  const oriented = await orientedBuffer(await readObject(asset.originalKey));
  const meta = await sharp(oriented).metadata();
  const thumbKey = `thumbs/${asset.studioId}/${asset.id}.jpg`;
  const webKey = `web/${asset.studioId}/${asset.id}.jpg`;
  const watermarkedKey = `watermarked/${asset.studioId}/${asset.id}.jpg`;
  const thumb = await sharp(oriented)
    .resize({
      width: 640,
      height: 640,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 76 })
    .toBuffer();
  const web = await sharp(oriented)
    .resize({
      width: 2048,
      height: 2048,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 82 })
    .toBuffer();
  const previewBase = sharp(oriented).resize({
    width: 1600,
    height: 1600,
    fit: "inside",
    withoutEnlargement: true,
  });
  const previewMeta = await previewBase.clone().metadata();
  const preview = await previewBase
    .composite([
      {
        input: watermarkSvg(
          previewMeta.width ?? 1600,
          previewMeta.height ?? 1600,
          studio?.name ?? "PREVIEW",
        ),
      },
    ])
    .jpeg({ quality: 70 })
    .toBuffer();
  await writeObject(thumbKey, thumb, "image/jpeg");
  await writeObject(webKey, web, "image/jpeg");
  await writeObject(watermarkedKey, preview, "image/jpeg");
  await db
    .update(assets)
    .set({
      status: "ready",
      thumbKey,
      webKey,
      watermarkedKey,
      width: meta.width ?? null,
      height: meta.height ?? null,
      error: null,
    })
    .where(eq(assets.id, asset.id));
}

async function applyRecipe(bytes: Buffer, recipe: EditRecipe) {
  const base = await orientedBuffer(bytes);
  const rotated = recipe.rotation
    ? await sharp(base, { failOn: "none" }).rotate(recipe.rotation).toBuffer()
    : base;
  const meta = await sharp(rotated).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  let pipeline = sharp(rotated, { failOn: "none" });
  if (recipe.crop && width && height) {
    const left = Math.min(recipe.crop.x, Math.max(0, width - 2));
    const top = Math.min(recipe.crop.y, Math.max(0, height - 2));
    const cropWidth = Math.max(1, Math.min(recipe.crop.width, width - left));
    const cropHeight = Math.max(1, Math.min(recipe.crop.height, height - top));
    pipeline = pipeline.extract({
      left,
      top,
      width: cropWidth,
      height: cropHeight,
    });
  }
  const { brightness, contrast, saturation } = sharpAdjustments(recipe);
  return pipeline
    .modulate({ brightness, saturation })
    .linear(contrast, 128 * (1 - contrast))
    .jpeg({ quality: 90 })
    .toBuffer();
}

export async function processRender(recipeId: string) {
  const [row] = await db
    .select()
    .from(editRecipes)
    .where(eq(editRecipes.id, recipeId))
    .limit(1);
  if (!row) throw new Error("Recipe not found");
  const [source] = await db
    .select()
    .from(assets)
    .where(eq(assets.id, row.assetId))
    .limit(1);
  if (!source || source.studioId !== row.studioId)
    throw new Error("Source asset is outside the studio");
  const [studio] = await db
    .select()
    .from(studios)
    .where(eq(studios.id, row.studioId))
    .limit(1);
  const recipe = sanitizeRecipe(row.recipe);
  await db
    .update(editRecipes)
    .set({ status: "rendering", error: null, updatedAt: new Date() })
    .where(eq(editRecipes.id, row.id));
  const rendered = await applyRecipe(
    await readObject(source.originalKey),
    recipe,
  );
  const meta = await sharp(rendered).metadata();
  const outputId = row.outputAssetId ?? crypto.randomUUID();
  const key = `edits/${row.studioId}/${row.id}.jpg`;
  const thumbKey = `thumbs/${row.studioId}/edit-${row.id}.jpg`;
  const watermarkedKey = `watermarked/${row.studioId}/edit-${row.id}.jpg`;
  const thumb = await sharp(rendered)
    .resize({
      width: 640,
      height: 640,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 76 })
    .toBuffer();
  const marked = await sharp(rendered)
    .resize({
      width: 1600,
      height: 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .composite([
      {
        input: watermarkSvg(
          meta.width ?? 1600,
          meta.height ?? 1600,
          studio?.name ?? "PREVIEW",
        ),
      },
    ])
    .jpeg({ quality: 70 })
    .toBuffer();
  await writeObject(key, rendered, "image/jpeg");
  await writeObject(thumbKey, thumb, "image/jpeg");
  await writeObject(watermarkedKey, marked, "image/jpeg");
  const filename = source.filename.replace(/\.[^.]+$/, "") + "-edit.jpg";
  if (row.outputAssetId) {
    await db
      .update(assets)
      .set({
        status: "ready",
        originalKey: key,
        webKey: key,
        thumbKey,
        watermarkedKey,
        width: meta.width ?? null,
        height: meta.height ?? null,
        byteSize: rendered.length,
        error: null,
      })
      .where(eq(assets.id, row.outputAssetId));
  } else {
    await db.insert(assets).values({
      id: outputId,
      studioId: row.studioId,
      originalKey: key,
      thumbKey,
      webKey: key,
      watermarkedKey,
      filename,
      contentType: "image/jpeg",
      byteSize: rendered.length,
      width: meta.width ?? null,
      height: meta.height ?? null,
      status: "ready",
      kind: "derivative",
      sourceAssetId: source.id,
    });
    if (row.galleryId) {
      const [gallery] = await db
        .select()
        .from(galleries)
        .where(eq(galleries.id, row.galleryId))
        .limit(1);
      if (gallery && gallery.studioId === row.studioId) {
        const items = await db
          .select()
          .from(galleryAssets)
          .where(eq(galleryAssets.galleryId, gallery.id));
        const sourceItem = items.find((item) => item.assetId === source.id);
        const sortOrder =
          items.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;
        await db.insert(galleryAssets).values({
          id: crypto.randomUUID(),
          studioId: row.studioId,
          galleryId: gallery.id,
          assetId: outputId,
          sortOrder,
          downloadTier: sourceItem?.downloadTier ?? "web",
        });
      }
    }
  }
  await db
    .update(editRecipes)
    .set({
      status: "ready",
      outputAssetId: outputId,
      error: null,
      updatedAt: new Date(),
    })
    .where(eq(editRecipes.id, row.id));
}

export async function failAsset(assetId: string, message: string) {
  await db
    .update(assets)
    .set({ status: "failed", error: message })
    .where(eq(assets.id, assetId));
}

export async function failRecipe(recipeId: string, message: string) {
  await db
    .update(editRecipes)
    .set({ status: "failed", error: message, updatedAt: new Date() })
    .where(eq(editRecipes.id, recipeId));
}

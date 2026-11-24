import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Editor } from "@/components/editor";
import { db } from "@/db";
import { assets, editRecipes, galleryAssets } from "@/db/schema";
import { signed } from "@/lib/media";
import { emptyRecipe, sanitizeRecipe } from "@/lib/recipe";
import { isStorageConfigured } from "@/lib/storage";
import { requireStaff } from "@/lib/studio";
export const dynamic = "force-dynamic";
export default async function EditPage({
  params,
}: {
  params: Promise<{ id: string; assetId: string }>;
}) {
  const { id, assetId } = await params;
  const ctx = await requireStaff();
  const [item] = await db
    .select()
    .from(galleryAssets)
    .where(
      and(
        eq(galleryAssets.galleryId, id),
        eq(galleryAssets.assetId, assetId),
        eq(galleryAssets.studioId, ctx.studio.id),
      ),
    )
    .limit(1);
  if (!item) notFound();
  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.studioId, ctx.studio.id)))
    .limit(1);
  if (!asset) notFound();
  const [recipe] = await db
    .select()
    .from(editRecipes)
    .where(
      and(
        eq(editRecipes.galleryId, id),
        eq(editRecipes.assetId, assetId),
        eq(editRecipes.studioId, ctx.studio.id),
      ),
    )
    .limit(1);
  const imageUrl = await signed(asset.webKey ?? asset.originalKey);
  return (
    <div className="grid gap-4">
      <div>
        <Link href={`/galleries/${id}`} className="text-sm underline">
          Back to gallery
        </Link>
        <h1 className="font-serif text-4xl">Edit {asset.filename}</h1>
        <p className="mt-2 max-w-2xl text-stone-700">
          The preview stays in the browser. Saving stores a recipe and asks the
          worker for a new JPEG. The original bytes do not change.
        </p>
        {recipe ? (
          <p className="mt-2 text-sm text-muted">
            Last render: {recipe.status}
          </p>
        ) : null}
      </div>
      {!isStorageConfigured() || !imageUrl ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm">
          The editor needs a processed web JPEG in storage before it can
          preview.
        </p>
      ) : (
        <Editor
          galleryId={id}
          assetId={assetId}
          imageUrl={imageUrl}
          initial={recipe ? sanitizeRecipe(recipe.recipe) : emptyRecipe()}
        />
      )}
    </div>
  );
}

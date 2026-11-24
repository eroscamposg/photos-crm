import type { Metadata } from "next";
import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { assets, collections, portfolioItems } from "@/db/schema";
import { signed } from "@/lib/media";
import { getPublicStudio } from "@/lib/studio";
export const dynamic = "force-dynamic";

async function load(slug: string) {
  const studio = await getPublicStudio();
  if (!studio) return null;

  const [collection] = await db
    .select()
    .from(collections)
    .where(
      and(
        eq(collections.studioId, studio.id),
        eq(collections.slug, slug),
        eq(collections.status, "published"),
      ),
    )
    .limit(1);

  if (!collection) return null;

  const items = await db
    .select({ item: portfolioItems, asset: assets })
    .from(portfolioItems)
    .innerJoin(
      assets,
      and(
        eq(portfolioItems.assetId, assets.id),
        eq(assets.studioId, studio.id),
      ),
    )
    .where(
      and(
        eq(portfolioItems.collectionId, collection.id),
        eq(portfolioItems.studioId, studio.id),
      ),
    )
    .orderBy(asc(portfolioItems.sortOrder));
  return { studio, collection, items };
}

// Not used RN
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const data = await load((await params).slug);
  if (!data) return { title: "Portfolio" };
  return {
    title:
      data.collection.seoTitle ||
      `${data.collection.title} · ${data.studio.name}`,
    description: data.collection.seoDescription || data.collection.description,
  };
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const data = await load((await params).slug);
  if (!data) notFound();
  const urls = await Promise.all(
    data.items.map((row) =>
      signed(row.asset.webKey ?? row.asset.watermarkedKey),
    ),
  );
  return (
    <article>
      <h1 className="font-serif text-5xl">{data.collection.title}</h1>
      <p className="mt-3 max-w-2xl text-stone-700">
        {data.collection.description}
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {data.items.map((row, index) => (
          <figure key={row.item.id}>
            {urls[index] ? (
              <img
                src={urls[index]!}
                alt={row.item.caption || data.collection.title}
                className="w-full rounded-2xl object-cover"
              />
            ) : (
              <div className="grid aspect-4/5 place-items-center rounded-2xl bg-stone-200 text-sm">
                Image processing
              </div>
            )}
            {row.item.caption ? (
              <figcaption className="mt-2 text-sm text-muted">
                {row.item.caption}
              </figcaption>
            ) : null}
          </figure>
        ))}
      </div>
    </article>
  );
}

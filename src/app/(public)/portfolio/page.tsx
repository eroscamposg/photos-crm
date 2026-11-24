import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, collections } from "@/db/schema";
import { signed } from "@/lib/media";
import { getPublicStudio } from "@/lib/studio";
import Image from "next/image";
export const dynamic = "force-dynamic";
export default async function PortfolioPage() {
  const studio = await getPublicStudio();
  if (!studio) return <p>The studio is not published yet.</p>;

  const rows = await db
    .select()
    .from(collections)
    .where(
      and(
        eq(collections.studioId, studio.id),
        eq(collections.status, "published"),
      ),
    )
    .orderBy(desc(collections.publishedAt));

  const covers = await Promise.all(
    rows.map(async (collection) => {
      if (!collection.coverAssetId) return null;
      const [asset] = await db
        .select()
        .from(assets)
        .where(
          and(
            eq(assets.id, collection.coverAssetId),
            eq(assets.studioId, studio.id),
          ),
        )
        .limit(1);
      return signed(asset?.webKey ?? asset?.thumbKey);
    }),
  );

  return (
    <div>
      <h1 className="font-serif text-5xl">Portfolio</h1>
      <p className="mt-3 max-w-xl text-stone-700">{studio.tagline}</p>
      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-muted">New work is on the way.</p>
      ) : null}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {rows.map((collection, index) => (
          <Link
            key={collection.id}
            href={`/portfolio/${collection.slug}`}
            className="overflow-hidden rounded-2xl border border-line bg-card"
          >
            {covers[index] ? (
              <Image
                src={covers[index]!}
                alt=""
                className="aspect-4/5 w-full object-cover"
              />
            ) : (
              <div className="aspect-4/5 bg-stone-200" />
            )}
            <div className="p-4">
              <h2 className="font-serif text-3xl">{collection.title}</h2>
              <p className="text-sm text-muted">{collection.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

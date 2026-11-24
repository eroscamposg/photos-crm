import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { db } from "@/db";
import { assets, collections, portfolioItems } from "@/db/schema";
import { signed } from "@/lib/media";
import { requireStaff } from "@/lib/studio";
import {
  addPortfolioItem,
  movePortfolioItem,
  removePortfolioItem,
  setCover,
  updateCollection,
} from "@/server/actions";
import Image from "next/image";
export const dynamic = "force-dynamic";
export default async function CollectionEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const ctx = await requireStaff();
  const [collection] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.id, id), eq(collections.studioId, ctx.studio.id)))
    .limit(1);
  if (!collection) notFound();
  const items = await db
    .select({ item: portfolioItems, asset: assets })
    .from(portfolioItems)
    .innerJoin(assets, eq(portfolioItems.assetId, assets.id))
    .where(
      and(
        eq(portfolioItems.collectionId, collection.id),
        eq(portfolioItems.studioId, ctx.studio.id),
      ),
    )
    .orderBy(asc(portfolioItems.sortOrder));
  const library = await db
    .select()
    .from(assets)
    .where(eq(assets.studioId, ctx.studio.id));
  const thumbs = await Promise.all(
    items.map((row) => signed(row.asset.thumbKey ?? row.asset.webKey)),
  );
  return (
    <div className="grid gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-serif text-4xl">{collection.title}</h1>
          <p className="text-sm text-muted">
            Public path /portfolio/{collection.slug}
          </p>
        </div>
        <Badge>{collection.status}</Badge>
      </div>
      {query.saved ? <p className="text-sm">Saved.</p> : null}
      <Card>
        <form action={updateCollection} className="grid gap-3 md:grid-cols-2">
          <input type="hidden" name="id" value={collection.id} />
          <Field label="Title">
            <Input name="title" defaultValue={collection.title} />
          </Field>
          <Field label="Slug">
            <Input name="slug" defaultValue={collection.slug} />
          </Field>
          <Field label="Description">
            <Textarea
              name="description"
              rows={4}
              defaultValue={collection.description}
            />
          </Field>
          <div className="grid gap-3">
            <Field label="SEO title">
              <Input name="seoTitle" defaultValue={collection.seoTitle ?? ""} />
            </Field>
            <Field label="SEO description">
              <Textarea
                name="seoDescription"
                rows={3}
                defaultValue={collection.seoDescription ?? ""}
              />
            </Field>
          </div>
          <Field label="Visibility">
            <Select name="status" defaultValue={collection.status}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </Select>
          </Field>
          <div className="self-end">
            <Button>Save collection</Button>
          </div>
        </form>
      </Card>
      <Card>
        <form
          action={addPortfolioItem}
          className="flex flex-wrap items-end gap-3"
        >
          <input type="hidden" name="collectionId" value={collection.id} />
          <Field label="Add a library photo">
            <Select name="assetId" defaultValue="">
              <option value="" disabled>
                Choose
              </option>
              {library.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.filename} ({asset.status})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Caption">
            <Input name="caption" />
          </Field>
          <Button>Add</Button>
        </form>
      </Card>
      <div className="grid gap-3">
        {items.map((row, index) => (
          <Card
            key={row.item.id}
            className="grid gap-3 md:grid-cols-[120px_1fr_auto]"
          >
            {thumbs[index] ? (
              <Image
                src={thumbs[index]!}
                alt=""
                className="h-28 w-full rounded-xl object-cover"
              />
            ) : (
              <div className="grid h-28 place-items-center rounded-xl bg-stone-200 text-xs">
                Processing
              </div>
            )}
            <div>
              <p className="font-medium">{row.asset.filename}</p>
              <p className="text-sm text-muted">
                {row.item.caption || "No caption"}
              </p>
              {collection.coverAssetId === row.asset.id ? (
                <p className="text-xs uppercase text-muted">Cover</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={movePortfolioItem}>
                <input type="hidden" name="id" value={row.item.id} />
                <input type="hidden" name="direction" value="up" />
                <Button variant="line">Up</Button>
              </form>
              <form action={movePortfolioItem}>
                <input type="hidden" name="id" value={row.item.id} />
                <input type="hidden" name="direction" value="down" />
                <Button variant="line">Down</Button>
              </form>
              <form action={setCover}>
                <input
                  type="hidden"
                  name="collectionId"
                  value={collection.id}
                />
                <input type="hidden" name="assetId" value={row.asset.id} />
                <Button variant="line">Cover</Button>
              </form>
              <form action={removePortfolioItem}>
                <input type="hidden" name="id" value={row.item.id} />
                <Button variant="line">Remove</Button>
              </form>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

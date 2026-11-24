import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { db } from "@/db";
import { assets, galleries, galleryAssets, galleryLinks } from "@/db/schema";
import { signed } from "@/lib/media";
import { appOrigin, requireStaff } from "@/lib/studio";
import {
  addGalleryAssets,
  createGalleryLink,
  deleteGalleryLink,
  moveGalleryAsset,
  setDownloadTier,
} from "@/server/actions";
import Image from "next/image";
export const dynamic = "force-dynamic";
export default async function GalleryEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireStaff();
  const [gallery] = await db
    .select()
    .from(galleries)
    .where(and(eq(galleries.id, id), eq(galleries.studioId, ctx.studio.id)))
    .limit(1);
  if (!gallery) notFound();
  const items = await db
    .select({ item: galleryAssets, asset: assets })
    .from(galleryAssets)
    .innerJoin(assets, eq(galleryAssets.assetId, assets.id))
    .where(
      and(
        eq(galleryAssets.galleryId, gallery.id),
        eq(galleryAssets.studioId, ctx.studio.id),
      ),
    )
    .orderBy(asc(galleryAssets.sortOrder));
  const library = await db
    .select()
    .from(assets)
    .where(eq(assets.studioId, ctx.studio.id));
  const links = await db
    .select()
    .from(galleryLinks)
    .where(
      and(
        eq(galleryLinks.galleryId, gallery.id),
        eq(galleryLinks.studioId, ctx.studio.id),
      ),
    );
  const thumbs = await Promise.all(
    items.map((row) => signed(row.asset.thumbKey ?? row.asset.webKey)),
  );
  const included = new Set(items.map((row) => row.asset.id));
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-4xl">{gallery.title}</h1>
        <p className="mt-2 text-stone-700">
          Order the photos, choose a download tier, then send a link that does
          not need an account.
        </p>
      </div>
      <Card>
        <form action={addGalleryAssets} className="grid gap-3">
          <input type="hidden" name="galleryId" value={gallery.id} />
          <div className="grid gap-2 sm:grid-cols-2">
            {library
              .filter((asset) => !included.has(asset.id))
              .map((asset) => (
                <label
                  key={asset.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <input type="checkbox" name="assetId" value={asset.id} />
                  {asset.filename}
                </label>
              ))}
          </div>
          <Button className="w-fit">Add selected</Button>
        </form>
      </Card>
      <div className="grid gap-3">
        {items.map((row, index) => (
          <Card
            key={row.item.id}
            className="grid items-center gap-3 md:grid-cols-[100px_1fr_auto]"
          >
            {thumbs[index] ? (
              <Image
                src={thumbs[index]!}
                alt=""
                className="h-24 w-full rounded-xl object-cover"
              />
            ) : (
              <div className="grid h-24 place-items-center rounded-xl bg-stone-200 text-xs">
                Waiting
              </div>
            )}
            <div>
              <p className="font-medium">{row.asset.filename}</p>
              <form
                action={setDownloadTier}
                className="mt-2 flex items-center gap-2"
              >
                <input type="hidden" name="id" value={row.item.id} />
                <Select
                  name="downloadTier"
                  defaultValue={row.item.downloadTier}
                >
                  <option value="none">Preview only</option>
                  <option value="web">Web JPEG</option>
                  <option value="original">Original</option>
                </Select>
                <Button variant="line">Save tier</Button>
              </form>
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={moveGalleryAsset}>
                <input type="hidden" name="id" value={row.item.id} />
                <input type="hidden" name="direction" value="up" />
                <Button variant="line">Up</Button>
              </form>
              <form action={moveGalleryAsset}>
                <input type="hidden" name="id" value={row.item.id} />
                <input type="hidden" name="direction" value="down" />
                <Button variant="line">Down</Button>
              </form>
              {row.asset.kind === "original" ? (
                <Link
                  href={`/galleries/${gallery.id}/edit/${row.asset.id}`}
                  className="inline-flex h-10 items-center rounded-full border border-line px-4 text-sm"
                >
                  Edit
                </Link>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-serif text-2xl">Share link</h2>
          <form action={createGalleryLink} className="mt-3 grid gap-3">
            <input type="hidden" name="galleryId" value={gallery.id} />
            <Field label="Display name">
              <Input name="displayName" defaultValue={ctx.studio.name} />
            </Field>
            <Field label="Accent">
              <Input
                name="accentColor"
                type="color"
                defaultValue={ctx.studio.accentColor}
              />
            </Field>
            <Field label="Expires">
              <Input name="expires" type="date" />
            </Field>
            <Field label="Password (optional)">
              <Input name="password" type="password" />
            </Field>
            <Button>Create link</Button>
          </form>
        </Card>
        <div className="grid gap-3">
          {links.map((link) => (
            <Card key={link.id}>
              <p className="font-medium">{link.displayName}</p>
              <p className="break-all text-sm text-muted">
                {appOrigin()}/g/{link.token}
              </p>
              <p className="mt-1 text-xs text-muted">
                {link.expiresAt
                  ? `Expires ${link.expiresAt.toISOString().slice(0, 10)}`
                  : "No expiry"}{" "}
                · {link.passwordHash ? "Password" : "Open link"}
              </p>
              <form action={deleteGalleryLink} className="mt-3">
                <input type="hidden" name="id" value={link.id} />
                <Button variant="line">Revoke</Button>
              </form>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

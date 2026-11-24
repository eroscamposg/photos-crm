import { and, asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { DownloadButton } from "@/components/downloads";
import { Button, Card, Field, Input } from "@/components/ui";
import { db } from "@/db";
import { assets, galleryAssets, galleryLinks } from "@/db/schema";
import { signed } from "@/lib/media";
import { galleryCookieName, signValue } from "@/lib/passwords";
import { unlockGallery } from "@/server/actions";
import Image from "next/image";
export const dynamic = "force-dynamic";

export default async function SharedGalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const [link] = await db
    .select()
    .from(galleryLinks)
    .where(eq(galleryLinks.token, token))
    .limit(1);

  if (!link) notFound();

  if (link.expiresAt && link.expiresAt.getTime() < Date.now())
    return (
      <Card>
        <h1 className="font-serif text-4xl">{link.displayName}</h1>
        <p className="mt-3">This gallery link has expired.</p>
      </Card>
    );

  const jar = await cookies();
  const unlocked =
    !link.passwordHash ||
    jar.get(galleryCookieName(token))?.value === signValue(token);

  const logo = await signed(link.logoKey);

  if (!unlocked) {
    return (
      <Card className="max-w-md">
        <h1 className="font-serif text-4xl">{link.displayName}</h1>
        <p className="mt-2 text-sm text-muted">
          This delivery is password protected.
        </p>
        <form action={unlockGallery} className="mt-4 grid gap-3">
          <input type="hidden" name="token" value={token} />
          <Field label="Password">
            <Input name="password" type="password" required />
          </Field>
          {query.error === "password" ? (
            <p className="text-sm text-red-800">
              That password does not match.
            </p>
          ) : null}
          {query.error === "rate" ? (
            <p className="text-sm text-red-800">
              Too many attempts. Try again later.
            </p>
          ) : null}
          <Button>Open gallery</Button>
        </form>
      </Card>
    );
  }
  const items = await db
    .select({ item: galleryAssets, asset: assets })
    .from(galleryAssets)
    .innerJoin(
      assets,
      and(
        eq(galleryAssets.assetId, assets.id),
        eq(assets.studioId, link.studioId),
      ),
    )
    .where(
      and(
        eq(galleryAssets.galleryId, link.galleryId),
        eq(galleryAssets.studioId, link.studioId),
      ),
    )
    .orderBy(asc(galleryAssets.sortOrder));
  const previews = await Promise.all(
    items.map((row) => signed(row.asset.watermarkedKey ?? row.asset.webKey)),
  );
  return (
    <div style={{ ["--accent" as string]: link.accentColor }}>
      <div className="mb-8 flex items-center gap-4">
        {logo ? (
          <Image
            src={logo}
            alt=""
            className="h-14 w-14 rounded-full object-cover"
          />
        ) : null}
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">
            Client gallery
          </p>
          <h1 className="font-serif text-5xl">{link.displayName}</h1>
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        {items.map((row, index) => (
          <figure
            key={row.item.id}
            className="overflow-hidden rounded-2xl border border-line bg-card"
          >
            {previews[index] ? (
              <Image
                src={previews[index]!}
                alt={row.asset.filename}
                className="aspect-4/5 w-full object-cover"
              />
            ) : (
              <div className="grid aspect-4/5 place-items-center bg-stone-200 text-sm">
                Still processing
              </div>
            )}
            <figcaption className="grid gap-1 p-4">
              <DownloadButton
                token={token}
                assetId={row.asset.id}
                tier="preview"
                label="Download preview"
              />
              {row.item.downloadTier === "web" ||
              row.item.downloadTier === "original" ? (
                <DownloadButton
                  token={token}
                  assetId={row.asset.id}
                  tier="web"
                  label="Download web JPEG"
                />
              ) : null}
              {row.item.downloadTier === "original" ? (
                <DownloadButton
                  token={token}
                  assetId={row.asset.id}
                  tier="original"
                  label="Download original"
                />
              ) : null}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

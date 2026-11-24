import { desc, eq } from "drizzle-orm";
import { Uploader } from "@/components/uploader";
import { Badge, Button, Card } from "@/components/ui";
import { db } from "@/db";
import { assets } from "@/db/schema";
import { signed } from "@/lib/media";
import { isStorageConfigured } from "@/lib/storage";
import { requireStaff } from "@/lib/studio";
import { retryAsset } from "@/server/actions";
import Image from "next/image";
export const dynamic = "force-dynamic";
export default async function LibraryPage() {
  const ctx = await requireStaff();
  const rows = await db
    .select()
    .from(assets)
    .where(eq(assets.studioId, ctx.studio.id))
    .orderBy(desc(assets.createdAt));
  const thumbs = await Promise.all(rows.map((asset) => signed(asset.thumbKey)));
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-4xl">Library</h1>
        <p className="mt-2 max-w-xl text-stone-700">
          Originals go to originals/{ctx.studio.id}/… The worker writes a
          thumbnail, a web JPEG, and a watermarked preview.
        </p>
      </div>
      {isStorageConfigured() ? null : (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm">
          R2 is not configured. The upload code is live and will refuse until
          the bucket env vars are set.
        </p>
      )}
      <Uploader />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((asset, index) => (
          <Card key={asset.id}>
            {thumbs[index] ? (
              <Image
                src={thumbs[index]!}
                alt=""
                className="mb-3 aspect-4/5 w-full rounded-xl object-cover"
              />
            ) : (
              <div className="mb-3 grid aspect-4/5 place-items-center rounded-xl bg-stone-200 text-sm text-muted">
                No preview yet
              </div>
            )}
            <p className="truncate text-sm font-medium">{asset.filename}</p>
            <div className="mt-2 flex items-center justify-between">
              <Badge>{asset.status}</Badge>
              <span className="text-xs text-muted">{asset.kind}</span>
            </div>
            {asset.error ? (
              <p className="mt-2 text-xs text-red-800">{asset.error}</p>
            ) : null}
            {asset.status === "failed" ? (
              <form action={retryAsset} className="mt-3">
                <input type="hidden" name="assetId" value={asset.id} />
                <Button variant="line">Retry</Button>
              </form>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}

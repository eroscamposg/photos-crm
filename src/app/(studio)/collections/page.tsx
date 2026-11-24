import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Badge, Button, Card, Field, Input, Textarea } from "@/components/ui";
import { db } from "@/db";
import { collections } from "@/db/schema";
import { requireStaff } from "@/lib/studio";
import { createCollection } from "@/server/actions";
export const dynamic = "force-dynamic";
export default async function CollectionsPage() {
  const ctx = await requireStaff();
  const rows = await db
    .select()
    .from(collections)
    .where(eq(collections.studioId, ctx.studio.id))
    .orderBy(desc(collections.createdAt));
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Card>
        <h1 className="font-serif text-3xl">New collection</h1>
        <form action={createCollection} className="mt-4 grid gap-3">
          <Field label="Title">
            <Input name="title" required />
          </Field>
          <Field label="Description">
            <Textarea name="description" rows={4} />
          </Field>
          <Field label="SEO title">
            <Input name="seoTitle" />
          </Field>
          <Field label="SEO description">
            <Textarea name="seoDescription" rows={3} />
          </Field>
          <Button>Create draft</Button>
        </form>
      </Card>
      <div className="grid gap-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted">
            Drafts stay off the public site until you publish them.
          </p>
        ) : null}
        {rows.map((collection) => (
          <Link key={collection.id} href={`/collections/${collection.id}`}>
            <Card className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-2xl">{collection.title}</h2>
                <p className="text-sm text-muted">
                  /portfolio/{collection.slug}
                </p>
              </div>
              <Badge>{collection.status}</Badge>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

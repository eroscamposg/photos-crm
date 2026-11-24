import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { db } from "@/db";
import { clients, galleries } from "@/db/schema";
import { requireStaff } from "@/lib/studio";
import { createGallery } from "@/server/actions";
export const dynamic = "force-dynamic";
export default async function GalleriesPage() {
  const ctx = await requireStaff();
  const rows = await db
    .select()
    .from(galleries)
    .where(eq(galleries.studioId, ctx.studio.id))
    .orderBy(desc(galleries.createdAt));
  const people = await db
    .select()
    .from(clients)
    .where(eq(clients.studioId, ctx.studio.id));
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <Card>
        <h1 className="font-serif text-3xl">New gallery</h1>
        <form action={createGallery} className="mt-4 grid gap-3">
          <Field label="Title">
            <Input name="title" placeholder="Chen family delivery" required />
          </Field>
          <Field label="Client">
            <Select name="clientId" defaultValue="">
              <option value="">None yet</option>
              {people.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button>Create gallery</Button>
        </form>
      </Card>
      <div className="grid gap-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted">
            A gallery holds the photos. The share link is what the client opens.
          </p>
        ) : null}
        {rows.map((gallery) => (
          <Link key={gallery.id} href={`/galleries/${gallery.id}`}>
            <Card>
              <h2 className="font-serif text-2xl">{gallery.title}</h2>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

import { desc, eq } from "drizzle-orm";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { requireStaff } from "@/lib/studio";
import { createClient } from "@/server/actions";
export const dynamic = "force-dynamic";
export default async function ClientsPage() {
  const ctx = await requireStaff();
  const rows = await db
    .select()
    .from(clients)
    .where(eq(clients.studioId, ctx.studio.id))
    .orderBy(desc(clients.createdAt));
  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <Card>
        <h1 className="font-serif text-3xl">Clients</h1>
        <form action={createClient} className="mt-4 grid gap-3">
          <Field label="Name">
            <Input name="name" required />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" />
          </Field>
          <Field label="Phone">
            <Input name="phone" />
          </Field>
          <Field label="Notes">
            <Textarea name="notes" rows={3} />
          </Field>
          <Button>Add client</Button>
        </form>
      </Card>
      <div className="grid gap-3">
        {rows.map((client) => (
          <Card key={client.id}>
            <h2 className="font-serif text-2xl">{client.name}</h2>
            <p className="text-sm text-muted">
              {[client.email, client.phone].filter(Boolean).join(" · ") ||
                "No contact yet"}
            </p>
            {client.notes ? (
              <p className="mt-2 text-sm">{client.notes}</p>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}

import { eq } from "drizzle-orm";
import { LogoUpload } from "@/components/logo-upload";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";
import { db } from "@/db";
import { memberships, user } from "@/db/schema";
import { signed } from "@/lib/media";
import { requireStaff } from "@/lib/studio";
import { updateBrand } from "@/server/actions";
import Image from "next/image";
export const dynamic = "force-dynamic";
export default async function BrandPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const ctx = await requireStaff();
  const members = await db
    .select({ name: user.name, email: user.email, role: memberships.role })
    .from(memberships)
    .innerJoin(user, eq(memberships.userId, user.id))
    .where(eq(memberships.studioId, ctx.studio.id));
  const logo = await signed(ctx.studio.logoKey);
  const locked = ctx.role !== "owner";
  return (
    <div className="grid max-w-3xl gap-6">
      <div>
        <h1 className="font-serif text-4xl">Brand</h1>
        <p className="mt-2 text-stone-700">
          Name, color, and logo are reused by the portfolio and as the default
          on each gallery link.
        </p>
      </div>
      {params.saved ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm">Brand saved.</p>
      ) : null}
      {params.error === "owner" ? (
        <p className="text-sm text-red-800">
          Only the owner can change brand settings.
        </p>
      ) : null}
      <Card>
        <form action={updateBrand} className="grid gap-4">
          <Field label="Studio name">
            <Input
              name="name"
              defaultValue={ctx.studio.name}
              disabled={locked}
            />
          </Field>
          <Field label="Tagline">
            <Textarea
              name="tagline"
              rows={3}
              defaultValue={ctx.studio.tagline}
              disabled={locked}
            />
          </Field>
          <Field label="Accent">
            <Input
              name="accentColor"
              type="color"
              defaultValue={ctx.studio.accentColor}
              disabled={locked}
            />
          </Field>
          {locked ? (
            <p className="text-sm text-muted">
              You can view the brand. The owner edits it.
            </p>
          ) : (
            <Button>Save brand</Button>
          )}
        </form>
      </Card>
      <Card className="grid gap-4">
        {logo ? (
          <Image
            src={logo}
            alt=""
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <p className="text-sm text-muted">No logo yet.</p>
        )}
        {locked ? null : <LogoUpload />}
      </Card>
      <Card>
        <h2 className="font-serif text-2xl">People</h2>
        <ul className="mt-3 grid gap-2 text-sm">
          {members.map((member) => (
            <li key={member.email} className="flex justify-between">
              <span>
                {member.name} · {member.email}
              </span>
              <span className="uppercase text-muted">{member.role}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

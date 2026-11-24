import Link from "next/link";
import { count, desc, eq } from "drizzle-orm";
import { Badge, Card } from "@/components/ui";
import { db } from "@/db";
import { assets, bookings, collections, galleries } from "@/db/schema";
import { requireStaff } from "@/lib/studio";
export const dynamic = "force-dynamic";
export default async function DashboardPage() {
  const ctx = await requireStaff();
  const studioId = ctx.studio.id;
  const [assetCount] = await db
    .select({ value: count() })
    .from(assets)
    .where(eq(assets.studioId, studioId));
  const [collectionCount] = await db
    .select({ value: count() })
    .from(collections)
    .where(eq(collections.studioId, studioId));
  const [galleryCount] = await db
    .select({ value: count() })
    .from(galleries)
    .where(eq(galleries.studioId, studioId));
  const upcoming = await db
    .select()
    .from(bookings)
    .where(eq(bookings.studioId, studioId))
    .orderBy(desc(bookings.createdAt))
    .limit(6);
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted">Desk</p>
        <h1 className="font-serif text-4xl">
          Good to see you, {ctx.user.name.split(" ")[0]}.
        </h1>
        <p className="mt-2 max-w-xl text-stone-700">{ctx.studio.tagline}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Library", assetCount?.value ?? 0, "/library"],
          ["Collections", collectionCount?.value ?? 0, "/collections"],
          ["Galleries", galleryCount?.value ?? 0, "/galleries"],
        ].map(([label, value, href]) => (
          <Link key={String(label)} href={String(href)}>
            <Card>
              <p className="text-sm text-muted">{label}</p>
              <p className="font-serif text-4xl">{value}</p>
            </Card>
          </Link>
        ))}
      </div>
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-2xl">Recent bookings</h2>
          <Link href="/calendar" className="text-sm underline">
            Open calendar
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted">
            No requests yet. Open dates are on the public booking page.
          </p>
        ) : (
          <ul className="grid gap-2">
            {upcoming.map((booking) => (
              <li
                key={booking.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span>
                  {booking.date} {booking.startTime} · {booking.clientName}
                </span>
                <Badge>{booking.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

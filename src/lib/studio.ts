import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { memberships, studios } from "@/db/schema";
import { auth } from "@/lib/auth";

export type StaffContext = {
  user: { id: string; name: string; email: string };
  role: "owner" | "staff";
  studio: typeof studios.$inferSelect;
};

export async function getStaffContext(): Promise<StaffContext | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  // So far memberships are used here, for staff actions
  const [row] = await db
    .select({ role: memberships.role, studio: studios })
    .from(memberships)
    .innerJoin(studios, eq(memberships.studioId, studios.id))
    .where(eq(memberships.userId, session.user.id))
    .limit(1);
  if (!row) return null;
  return {
    user: session.user,
    role: row.role === "owner" ? "owner" : "staff",
    studio: row.studio,
  };
}

export async function requireStaff() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const context = await getStaffContext();
  if (!context) redirect("/login?error=membership");
  return context;
}

export async function getPublicStudio() {
  console.log("getPublicStudio");
  const slug = process.env.PUBLIC_STUDIO_SLUG ?? "atelier-north";
  const [studio] = await db
    .select()
    .from(studios)
    .where(eq(studios.slug, slug))
    .limit(1);
  return studio ?? null;
}

export async function clientIp() {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "local";
  return headerStore.get("x-real-ip") ?? "local";
}

export function appOrigin() {
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
}

import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";

import { db, sql } from "./index";
import {
  account,
  availabilityRules,
  clients,
  memberships,
  sessionTypes,
  studios,
  user,
} from "./schema";

export const SEEDED_STUDIO = {
  id: "6f1c2a40-9b7e-4d1a-8c33-2a6e5b0d4f17",
  name: "Atelier North",
  slug: "atelier-north",
};

const DEMO_EMAIL = "owner@atelier.local";
const DEMO_PASSWORD = "AtelierDemo123!";

async function main() {
  // Check DB, if the studio exists
  const [existing] = await db
    .select()
    .from(studios)
    .where(eq(studios.slug, SEEDED_STUDIO.slug))
    .limit(1);

  // If doestn exist, create it, else just return it
  const studio =
    existing ??
    (
      await db
        .insert(studios)
        .values({
          id: SEEDED_STUDIO.id,
          name: SEEDED_STUDIO.name,
          slug: SEEDED_STUDIO.slug,
          tagline: "Portraits, families, and the quiet hours between.",
          accentColor: "#9a3412",
        })
        .returning()
    )[0];

  // Update tagline if is a new row
  if (existing && !existing.tagline) {
    await db
      .update(studios)
      .set({
        tagline: "Portraits, families, and the quiet hours between.",
        accentColor: existing.accentColor || "#9a3412",
      })
      .where(eq(studios.id, existing.id));
  }

  // Get from table User
  const [existingUser] = await db
    .select()
    .from(user)
    .where(eq(user.email, DEMO_EMAIL))
    .limit(1);
  let userId = existingUser?.id;

  // If no user id, create a new user and account lined to that user.
  if (!userId) {
    userId = crypto.randomUUID();
    const now = new Date();
    await db.insert(user).values({
      id: userId,
      name: "Demo Owner",
      email: DEMO_EMAIL,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(account).values({
      id: crypto.randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: await hashPassword(DEMO_PASSWORD),
      createdAt: now,
      updatedAt: now,
    });
  }

  // Memberships used later for administration
  const [membership] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .limit(1);
  if (!membership) {
    await db.insert(memberships).values({
      id: crypto.randomUUID(),
      studioId: studio.id,
      userId,
      role: "owner",
    });
  }

  // Session types. Used for booking a session, and defines the duration of the sessions
  const types = await db
    .select()
    .from(sessionTypes)
    .where(eq(sessionTypes.studioId, studio.id));
  if (types.length === 0) {
    await db.insert(sessionTypes).values([
      {
        id: crypto.randomUUID(),
        studioId: studio.id,
        name: "Portrait",
        description:
          "One hour, one person or a couple. Natural light when we can get it.",
        durationMinutes: 60,
        active: true,
      },
      {
        id: crypto.randomUUID(),
        studioId: studio.id,
        name: "Family",
        description:
          "Ninety minutes for a household, with room for the unplanned frames.",
        durationMinutes: 90,
        active: true,
      },
    ]);
  }

  // Availability rules define the hours available for booking during the day of the week
  const rules = await db
    .select()
    .from(availabilityRules)
    .where(eq(availabilityRules.studioId, studio.id));
  if (rules.length === 0) {
    await db.insert(availabilityRules).values(
      [1, 2, 3, 4, 5].map((weekday) => ({
        id: crypto.randomUUID(),
        studioId: studio.id,
        weekday,
        startTime: "09:00",
        endTime: "17:00",
      })),
    );
    await db.insert(availabilityRules).values({
      id: crypto.randomUUID(),
      studioId: studio.id,
      weekday: 6,
      startTime: "10:00",
      endTime: "14:00",
    });
  }

  // Example clients
  const people = await db
    .select()
    .from(clients)
    .where(eq(clients.studioId, studio.id));
  if (people.length === 0) {
    await db.insert(clients).values({
      id: crypto.randomUUID(),
      studioId: studio.id,
      name: "Maya Chen",
      email: "maya@example.com",
      phone: "555-0100",
      notes: "Sample client for gallery deliveries.",
    });
  }
  console.log(`Seeded ${studio.name} (${studio.slug})`);
  console.log(`Demo login ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  await sql.end({ timeout: 5 });
}

main().catch(async (error) => {
  console.error(error);
  await sql.end({ timeout: 5 }).catch(() => undefined);
  process.exit(1);
});

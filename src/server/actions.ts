"use server";

import { randomBytes } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import {
  assets,
  availabilityRules,
  bookings,
  clients,
  collections,
  dateOverrides,
  editRecipes,
  galleries,
  galleryAssets,
  galleryLinks,
  memberships,
  portfolioItems,
  sessionTypes,
  studios,
  user,
} from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  fromMinutes,
  isTime,
  minutes,
  slotsForDate,
  weekdayIndex,
} from "@/lib/availability";
import { sendEmail } from "@/lib/email";
import { enqueueJob } from "@/lib/jobs";
import {
  galleryCookieName,
  hashSecret,
  signValue,
  verifySecret,
} from "@/lib/passwords";
import { consumeRateLimit } from "@/lib/rate-limit";
import { sanitizeRecipe } from "@/lib/recipe";
import { hexColor, slugify, textField } from "@/lib/slug";
import { clientIp, getPublicStudio, requireStaff } from "@/lib/studio";

export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}

export async function updateBrand(formData: FormData) {
  const ctx = await requireStaff();
  if (ctx.role !== "owner") redirect("/brand?error=owner");
  const name = textField(formData.get("name"), 80);
  const tagline = textField(formData.get("tagline"), 180);
  const accentColor = hexColor(
    textField(formData.get("accentColor"), 7),
    ctx.studio.accentColor,
  );
  if (!name) redirect("/brand?error=name");
  await db
    .update(studios)
    .set({ name, tagline, accentColor, updatedAt: new Date() })
    .where(eq(studios.id, ctx.studio.id));
  revalidatePath("/", "layout");
  redirect("/brand?saved=1");
}

export async function createClient(formData: FormData) {
  const ctx = await requireStaff();
  const name = textField(formData.get("name"), 120);
  if (!name) redirect("/clients?error=name");
  await db.insert(clients).values({
    id: crypto.randomUUID(),
    studioId: ctx.studio.id,
    name,
    email: textField(formData.get("email"), 180) || null,
    phone: textField(formData.get("phone"), 40) || null,
    notes: textField(formData.get("notes"), 1000),
  });
  redirect("/clients");
}

async function uniqueSlug(studioId: string, title: string, ignoreId?: string) {
  const base = slugify(title);
  let slug = base;
  let suffix = 2;
  for (;;) {
    const [found] = await db
      .select()
      .from(collections)
      .where(
        and(eq(collections.studioId, studioId), eq(collections.slug, slug)),
      )
      .limit(1);
    if (!found || found.id === ignoreId) return slug;
    slug = `${base}-${suffix++}`;
  }
}

export async function createCollection(formData: FormData) {
  const ctx = await requireStaff();
  const title = textField(formData.get("title"), 120);
  if (!title) redirect("/collections?error=title");
  const id = crypto.randomUUID();
  await db.insert(collections).values({
    id,
    studioId: ctx.studio.id,
    title,
    slug: await uniqueSlug(ctx.studio.id, title),
    description: textField(formData.get("description"), 2000),
    status: "draft",
    seoTitle: textField(formData.get("seoTitle"), 160) || null,
    seoDescription: textField(formData.get("seoDescription"), 300) || null,
  });
  redirect(`/collections/${id}`);
}

export async function updateCollection(formData: FormData) {
  const ctx = await requireStaff();
  const id = textField(formData.get("id"), 80);
  const [collection] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.id, id), eq(collections.studioId, ctx.studio.id)))
    .limit(1);
  if (!collection) redirect("/collections");
  const title = textField(formData.get("title"), 120) || collection.title;
  const status = formData.get("status") === "published" ? "published" : "draft";
  const slug = await uniqueSlug(
    ctx.studio.id,
    textField(formData.get("slug"), 80) || title,
    collection.id,
  );
  await db
    .update(collections)
    .set({
      title,
      slug,
      description: textField(formData.get("description"), 2000),
      seoTitle: textField(formData.get("seoTitle"), 160) || null,
      seoDescription: textField(formData.get("seoDescription"), 300) || null,
      status,
      publishedAt:
        status === "published" ? (collection.publishedAt ?? new Date()) : null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(collections.id, collection.id),
        eq(collections.studioId, ctx.studio.id),
      ),
    );
  revalidatePath("/portfolio");
  revalidatePath(`/portfolio/${slug}`);
  redirect(`/collections/${collection.id}?saved=1`);
}

export async function addPortfolioItem(formData: FormData) {
  const ctx = await requireStaff();
  const collectionId = textField(formData.get("collectionId"), 80);
  const assetId = textField(formData.get("assetId"), 80);
  const [collection] = await db
    .select()
    .from(collections)
    .where(
      and(
        eq(collections.id, collectionId),
        eq(collections.studioId, ctx.studio.id),
      ),
    )
    .limit(1);
  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.studioId, ctx.studio.id)))
    .limit(1);
  if (!collection || !asset) redirect("/collections");
  const items = await db
    .select()
    .from(portfolioItems)
    .where(eq(portfolioItems.collectionId, collection.id));
  await db.insert(portfolioItems).values({
    id: crypto.randomUUID(),
    studioId: ctx.studio.id,
    collectionId: collection.id,
    assetId: asset.id,
    sortOrder:
      items.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1,
    caption: textField(formData.get("caption"), 240),
  });
  if (!collection.coverAssetId) {
    await db
      .update(collections)
      .set({ coverAssetId: asset.id, updatedAt: new Date() })
      .where(eq(collections.id, collection.id));
  }
  redirect(`/collections/${collection.id}`);
}

export async function movePortfolioItem(formData: FormData) {
  const ctx = await requireStaff();
  const id = textField(formData.get("id"), 80);
  const direction = formData.get("direction") === "up" ? -1 : 1;
  const [item] = await db
    .select()
    .from(portfolioItems)
    .where(
      and(
        eq(portfolioItems.id, id),
        eq(portfolioItems.studioId, ctx.studio.id),
      ),
    )
    .limit(1);
  if (!item) return;
  const siblings = await db
    .select()
    .from(portfolioItems)
    .where(
      and(
        eq(portfolioItems.collectionId, item.collectionId),
        eq(portfolioItems.studioId, ctx.studio.id),
      ),
    )
    .orderBy(asc(portfolioItems.sortOrder));
  const index = siblings.findIndex((sibling) => sibling.id === item.id);
  const swap = siblings[index + direction];
  if (!swap) return;
  await db
    .update(portfolioItems)
    .set({ sortOrder: swap.sortOrder })
    .where(eq(portfolioItems.id, item.id));
  await db
    .update(portfolioItems)
    .set({ sortOrder: item.sortOrder })
    .where(eq(portfolioItems.id, swap.id));
  revalidatePath(`/collections/${item.collectionId}`);
}

export async function removePortfolioItem(formData: FormData) {
  const ctx = await requireStaff();
  const id = textField(formData.get("id"), 80);
  const [item] = await db
    .select()
    .from(portfolioItems)
    .where(
      and(
        eq(portfolioItems.id, id),
        eq(portfolioItems.studioId, ctx.studio.id),
      ),
    )
    .limit(1);
  if (!item) return;
  await db
    .delete(portfolioItems)
    .where(
      and(
        eq(portfolioItems.id, item.id),
        eq(portfolioItems.studioId, ctx.studio.id),
      ),
    );
  revalidatePath(`/collections/${item.collectionId}`);
}

export async function setCover(formData: FormData) {
  const ctx = await requireStaff();
  await db
    .update(collections)
    .set({
      coverAssetId: textField(formData.get("assetId"), 80),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(collections.id, textField(formData.get("collectionId"), 80)),
        eq(collections.studioId, ctx.studio.id),
      ),
    );
}

export async function saveSessionType(formData: FormData) {
  const ctx = await requireStaff();
  const name = textField(formData.get("name"), 80);
  const duration = Number(formData.get("durationMinutes"));
  if (!name || !Number.isFinite(duration) || duration < 15 || duration > 480)
    redirect("/calendar?error=type");
  await db.insert(sessionTypes).values({
    id: crypto.randomUUID(),
    studioId: ctx.studio.id,
    name,
    description: textField(formData.get("description"), 400),
    durationMinutes: Math.round(duration),
    active: true,
  });
  redirect("/calendar");
}

export async function saveWeeklyRules(formData: FormData) {
  const ctx = await requireStaff();
  const rows: { weekday: number; startTime: string; endTime: string }[] = [];
  for (let weekday = 0; weekday < 7; weekday += 1) {
    if (formData.get(`closed-${weekday}`) === "on") continue;
    const startTime = textField(formData.get(`start-${weekday}`), 5);
    const endTime = textField(formData.get(`end-${weekday}`), 5);
    if (
      !isTime(startTime) ||
      !isTime(endTime) ||
      minutes(endTime) <= minutes(startTime)
    )
      redirect("/calendar?error=hours");
    rows.push({ weekday, startTime, endTime });
  }
  await db
    .delete(availabilityRules)
    .where(eq(availabilityRules.studioId, ctx.studio.id));
  if (rows.length) {
    await db.insert(availabilityRules).values(
      rows.map((row) => ({
        id: crypto.randomUUID(),
        studioId: ctx.studio.id,
        ...row,
      })),
    );
  }
  revalidatePath("/book");
  redirect("/calendar?saved=hours");
}

export async function saveOverride(formData: FormData) {
  const ctx = await requireStaff();
  const date = textField(formData.get("date"), 10);
  const status = formData.get("status") === "closed" ? "closed" : "open";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect("/calendar?error=date");
  const startTime = textField(formData.get("startTime"), 5);
  const endTime = textField(formData.get("endTime"), 5);
  await db
    .insert(dateOverrides)
    .values({
      id: crypto.randomUUID(),
      studioId: ctx.studio.id,
      date,
      status,
      startTime: status === "open" && isTime(startTime) ? startTime : null,
      endTime: status === "open" && isTime(endTime) ? endTime : null,
      note: textField(formData.get("note"), 240),
    })
    .onConflictDoUpdate({
      target: [dateOverrides.studioId, dateOverrides.date],
      set: {
        status,
        startTime: status === "open" && isTime(startTime) ? startTime : null,
        endTime: status === "open" && isTime(endTime) ? endTime : null,
        note: textField(formData.get("note"), 240),
      },
    });
  revalidatePath("/book");
  redirect(`/calendar?date=${date}`);
}

export async function setBookingStatus(formData: FormData) {
  const ctx = await requireStaff();
  const status = textField(formData.get("status"), 20);
  if (!["requested", "confirmed", "cancelled"].includes(status)) return;
  await db
    .update(bookings)
    .set({ status })
    .where(
      and(
        eq(bookings.id, textField(formData.get("id"), 80)),
        eq(bookings.studioId, ctx.studio.id),
      ),
    );
  revalidatePath("/book");
}

export async function bookSession(
  _prev: { error?: string } | null,
  formData: FormData,
) {
  const studio = await getPublicStudio();
  if (!studio) return { error: "This studio is not ready for bookings yet." };
  const ip = await clientIp();
  const limit = await consumeRateLimit(`book:${ip}`, 5, 60 * 60 * 1000);
  if (!limit.ok)
    return { error: "Too many booking attempts. Try again in an hour." };
  const sessionTypeId = textField(formData.get("sessionTypeId"), 80);
  const date = textField(formData.get("date"), 10);
  const startTime = textField(formData.get("startTime"), 5);
  const clientName = textField(formData.get("clientName"), 120);
  const clientEmail = textField(formData.get("clientEmail"), 180).toLowerCase();
  const clientPhone = textField(formData.get("clientPhone"), 40);
  const notes = textField(formData.get("notes"), 1000);
  if (
    !clientName ||
    !clientEmail.includes("@") ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    return { error: "Add your name, a real email, and an open date." };
  }
  const [sessionType] = await db
    .select()
    .from(sessionTypes)
    .where(
      and(
        eq(sessionTypes.id, sessionTypeId),
        eq(sessionTypes.studioId, studio.id),
        eq(sessionTypes.active, true),
      ),
    )
    .limit(1);
  if (!sessionType) return { error: "Choose a session type." };
  const rules = await db
    .select()
    .from(availabilityRules)
    .where(eq(availabilityRules.studioId, studio.id));
  const overrides = await db
    .select()
    .from(dateOverrides)
    .where(eq(dateOverrides.studioId, studio.id));
  const existing = await db
    .select()
    .from(bookings)
    .where(eq(bookings.studioId, studio.id));
  const open = slotsForDate({
    date,
    weekday: weekdayIndex(date),
    durationMinutes: sessionType.durationMinutes,
    rules,
    overrides: overrides.map((item) => ({
      date: item.date,
      status: item.status === "closed" ? "closed" : "open",
      startTime: item.startTime,
      endTime: item.endTime,
    })),
    busy: existing,
  });
  if (!open.includes(startTime))
    return { error: "That time is no longer open." };
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.studioId, studio.id), eq(clients.email, clientEmail)))
    .limit(1);
  const clientId =
    client?.id ??
    (
      await db
        .insert(clients)
        .values({
          id: crypto.randomUUID(),
          studioId: studio.id,
          name: clientName,
          email: clientEmail,
          phone: clientPhone || null,
          notes: "Created from a booking request.",
        })
        .returning()
    )[0].id;
  await db.insert(bookings).values({
    id: crypto.randomUUID(),
    studioId: studio.id,
    sessionTypeId: sessionType.id,
    clientId,
    clientName,
    clientEmail,
    clientPhone,
    date,
    startTime,
    endTime: fromMinutes(minutes(startTime) + sessionType.durationMinutes),
    status: "requested",
    notes,
  });
  try {
    await sendEmail({
      to: clientEmail,
      subject: `${studio.name} received your ${sessionType.name.toLowerCase()} request`,
      text: `Hello ${clientName},\n\nWe have your request for ${date} at ${startTime}.\n\n${studio.name}`,
    });
    const [owner] = await db
      .select({ email: user.email })
      .from(memberships)
      .innerJoin(user, eq(memberships.userId, user.id))
      .where(
        and(eq(memberships.studioId, studio.id), eq(memberships.role, "owner")),
      )
      .limit(1);
    if (owner?.email) {
      await sendEmail({
        to: owner.email,
        subject: `New booking request from ${clientName}`,
        text: `${clientName} (${clientEmail}) asked for ${sessionType.name} on ${date} at ${startTime}.`,
      });
    }
  } catch (error) {
    console.error("[email] booking notification failed", error);
  }
  redirect("/book?sent=1");
}

export async function createGallery(formData: FormData) {
  const ctx = await requireStaff();
  const title = textField(formData.get("title"), 120);
  if (!title) redirect("/galleries?error=title");
  const id = crypto.randomUUID();
  const clientId = textField(formData.get("clientId"), 80);
  await db
    .insert(galleries)
    .values({ id, studioId: ctx.studio.id, title, clientId: clientId || null });
  redirect(`/galleries/${id}`);
}

export async function addGalleryAssets(formData: FormData) {
  const ctx = await requireStaff();
  const galleryId = textField(formData.get("galleryId"), 80);
  const [gallery] = await db
    .select()
    .from(galleries)
    .where(
      and(eq(galleries.id, galleryId), eq(galleries.studioId, ctx.studio.id)),
    )
    .limit(1);
  if (!gallery) redirect("/galleries");
  const existing = await db
    .select()
    .from(galleryAssets)
    .where(eq(galleryAssets.galleryId, gallery.id));
  let sortOrder =
    existing.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;
  for (const assetId of formData.getAll("assetId").map(String)) {
    if (existing.some((item) => item.assetId === assetId)) continue;
    const [asset] = await db
      .select()
      .from(assets)
      .where(and(eq(assets.id, assetId), eq(assets.studioId, ctx.studio.id)))
      .limit(1);
    if (!asset) continue;
    await db.insert(galleryAssets).values({
      id: crypto.randomUUID(),
      studioId: ctx.studio.id,
      galleryId: gallery.id,
      assetId: asset.id,
      sortOrder,
      downloadTier: "none",
    });
    sortOrder += 1;
  }
  redirect(`/galleries/${gallery.id}`);
}

export async function moveGalleryAsset(formData: FormData) {
  const ctx = await requireStaff();
  const id = textField(formData.get("id"), 80);
  const direction = formData.get("direction") === "up" ? -1 : 1;
  const [item] = await db
    .select()
    .from(galleryAssets)
    .where(
      and(eq(galleryAssets.id, id), eq(galleryAssets.studioId, ctx.studio.id)),
    )
    .limit(1);
  if (!item) return;
  const siblings = await db
    .select()
    .from(galleryAssets)
    .where(
      and(
        eq(galleryAssets.galleryId, item.galleryId),
        eq(galleryAssets.studioId, ctx.studio.id),
      ),
    )
    .orderBy(asc(galleryAssets.sortOrder));
  const index = siblings.findIndex((sibling) => sibling.id === item.id);
  const swap = siblings[index + direction];
  if (!swap) return;
  await db
    .update(galleryAssets)
    .set({ sortOrder: swap.sortOrder })
    .where(eq(galleryAssets.id, item.id));
  await db
    .update(galleryAssets)
    .set({ sortOrder: item.sortOrder })
    .where(eq(galleryAssets.id, swap.id));
  revalidatePath(`/galleries/${item.galleryId}`);
}

export async function setDownloadTier(formData: FormData) {
  const ctx = await requireStaff();
  const tier = textField(formData.get("downloadTier"), 20);
  if (!["none", "web", "original"].includes(tier)) return;
  const [item] = await db
    .select()
    .from(galleryAssets)
    .where(
      and(
        eq(galleryAssets.id, textField(formData.get("id"), 80)),
        eq(galleryAssets.studioId, ctx.studio.id),
      ),
    )
    .limit(1);
  if (!item) return;
  await db
    .update(galleryAssets)
    .set({ downloadTier: tier })
    .where(
      and(
        eq(galleryAssets.id, item.id),
        eq(galleryAssets.studioId, ctx.studio.id),
      ),
    );
  revalidatePath(`/galleries/${item.galleryId}`);
}

export async function createGalleryLink(formData: FormData) {
  const ctx = await requireStaff();
  const galleryId = textField(formData.get("galleryId"), 80);
  const [gallery] = await db
    .select()
    .from(galleries)
    .where(
      and(eq(galleries.id, galleryId), eq(galleries.studioId, ctx.studio.id)),
    )
    .limit(1);
  if (!gallery) redirect("/galleries");
  const password = textField(formData.get("password"), 80);
  const expires = textField(formData.get("expires"), 10);
  await db.insert(galleryLinks).values({
    id: crypto.randomUUID(),
    studioId: ctx.studio.id,
    galleryId: gallery.id,
    token: randomBytes(24).toString("hex"),
    expiresAt: /^\d{4}-\d{2}-\d{2}$/.test(expires)
      ? new Date(`${expires}T23:59:59Z`)
      : null,
    passwordHash: password ? hashSecret(password) : null,
    logoKey: ctx.studio.logoKey,
    accentColor: hexColor(
      textField(formData.get("accentColor"), 7),
      ctx.studio.accentColor,
    ),
    displayName: textField(formData.get("displayName"), 120) || ctx.studio.name,
  });
  redirect(`/galleries/${gallery.id}`);
}

export async function deleteGalleryLink(formData: FormData) {
  const ctx = await requireStaff();
  const [link] = await db
    .select()
    .from(galleryLinks)
    .where(
      and(
        eq(galleryLinks.id, textField(formData.get("id"), 80)),
        eq(galleryLinks.studioId, ctx.studio.id),
      ),
    )
    .limit(1);
  if (!link) return;
  await db
    .delete(galleryLinks)
    .where(
      and(
        eq(galleryLinks.id, link.id),
        eq(galleryLinks.studioId, ctx.studio.id),
      ),
    );
  revalidatePath(`/galleries/${link.galleryId}`);
}

export async function unlockGallery(formData: FormData) {
  const token = textField(formData.get("token"), 80);
  const password = textField(formData.get("password"), 80);
  const limit = await consumeRateLimit(
    `unlock:${token}:${await clientIp()}`,
    10,
    60 * 60 * 1000,
  );
  if (!limit.ok) redirect(`/g/${token}?error=rate`);
  const [link] = await db
    .select()
    .from(galleryLinks)
    .where(eq(galleryLinks.token, token))
    .limit(1);
  if (!link?.passwordHash || !verifySecret(password, link.passwordHash))
    redirect(`/g/${token}?error=password`);
  const jar = await cookies();
  jar.set(galleryCookieName(token), signValue(token), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/g/${token}`,
    maxAge: 60 * 60 * 12,
  });
  redirect(`/g/${token}`);
}

export async function saveRecipe(input: {
  galleryId: string;
  assetId: string;
  recipe: unknown;
}) {
  const ctx = await requireStaff();
  const [item] = await db
    .select()
    .from(galleryAssets)
    .where(
      and(
        eq(galleryAssets.galleryId, input.galleryId),
        eq(galleryAssets.assetId, input.assetId),
        eq(galleryAssets.studioId, ctx.studio.id),
      ),
    )
    .limit(1);
  if (!item) return { error: "That photo is not in this gallery." };
  const recipe = sanitizeRecipe(input.recipe);
  const [existing] = await db
    .select()
    .from(editRecipes)
    .where(
      and(
        eq(editRecipes.studioId, ctx.studio.id),
        eq(editRecipes.galleryId, input.galleryId),
        eq(editRecipes.assetId, input.assetId),
      ),
    )
    .limit(1);
  const id = existing?.id ?? crypto.randomUUID();
  if (existing) {
    await db
      .update(editRecipes)
      .set({ recipe, status: "rendering", error: null, updatedAt: new Date() })
      .where(
        and(
          eq(editRecipes.id, existing.id),
          eq(editRecipes.studioId, ctx.studio.id),
        ),
      );
  } else {
    await db.insert(editRecipes).values({
      id,
      studioId: ctx.studio.id,
      assetId: input.assetId,
      galleryId: input.galleryId,
      recipe,
      status: "rendering",
    });
  }
  await enqueueJob({
    studioId: ctx.studio.id,
    type: "render",
    payload: { recipeId: id },
  });
  revalidatePath(`/galleries/${input.galleryId}`);
  return { ok: true as const };
}

export async function retryAsset(formData: FormData) {
  const ctx = await requireStaff();
  const [asset] = await db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.id, textField(formData.get("assetId"), 80)),
        eq(assets.studioId, ctx.studio.id),
      ),
    )
    .limit(1);
  if (!asset) return;
  await db
    .update(assets)
    .set({ status: "pending", error: null })
    .where(eq(assets.id, asset.id));
  await enqueueJob({
    studioId: ctx.studio.id,
    type: "derivatives",
    payload: { assetId: asset.id },
  });
  revalidatePath("/library");
}

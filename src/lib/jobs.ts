import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { jobs } from "@/db/schema";

export async function enqueueJob(input: {
  studioId: string;
  type: "derivatives" | "render";
  payload: Record<string, string>;
}) {
  const pending = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.studioId, input.studioId), eq(jobs.type, input.type), eq(jobs.status, "pending")));
  const duplicate = pending.find((job) => JSON.stringify(job.payload) === JSON.stringify(input.payload));
  if (duplicate) return duplicate;
  const [job] = await db
    .insert(jobs)
    .values({
      id: crypto.randomUUID(),
      studioId: input.studioId,
      type: input.type,
      payload: input.payload,
      status: "pending",
    })
    .returning();
  return job;
}

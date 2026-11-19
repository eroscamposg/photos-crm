import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { jobs } from "@/db/schema";
import { isStorageConfigured } from "@/lib/storage";
import { failAsset, failRecipe, processDerivatives, processRender } from "./process";

type JobRow = { id: string; type: string; payload: Record<string, string> };

async function claimJob() {
  const rows = await db.execute(sql`
    UPDATE jobs
    SET status = 'processing', updated_at = now()
    WHERE id = (
      SELECT id FROM jobs
      WHERE status = 'pending'
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, type, payload
  `);
  const list = (Array.isArray(rows) ? rows : []) as unknown as JobRow[];
  return list[0] ?? null;
}

async function runOnce() {
  if (!isStorageConfigured()) return;
  const job = await claimJob();
  if (!job) return;
  try {
    if (job.type === "derivatives") await processDerivatives(String(job.payload.assetId));
    else if (job.type === "render") await processRender(String(job.payload.recipeId));
    else throw new Error(`Unknown job type ${job.type}`);
    await db.update(jobs).set({ status: "done", updatedAt: new Date(), error: null }).where(eq(jobs.id, job.id));
    console.log(`[worker] ${job.type} ${job.id} done`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Job failed";
    console.error(`[worker] ${job.type} ${job.id} failed`, error);
    await db.update(jobs).set({ status: "failed", error: message, updatedAt: new Date() }).where(eq(jobs.id, job.id));
    if (job.type === "derivatives" && job.payload?.assetId) await failAsset(String(job.payload.assetId), message);
    if (job.type === "render" && job.payload?.recipeId) await failRecipe(String(job.payload.recipeId), message);
  }
}

async function loop() {
  console.log("[worker] listening for image jobs");
  if (!isStorageConfigured()) console.log("[worker] R2 is not configured. Jobs stay pending until the bucket env is set.");
  for (;;) {
    await runOnce();
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

loop().catch((error) => {
  console.error(error);
  process.exit(1);
});

import { isStorageConfigured, presignGet } from "@/lib/storage";

export async function signed(key: string | null | undefined, expires = 3600) {
  if (!key || !isStorageConfigured()) return null;
  try {
    return await presignGet(key, expires);
  } catch (error) {
    console.error("[media] sign failed", error);
    return null;
  }
}

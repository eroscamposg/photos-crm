import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashSecret(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifySecret(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 32);
  const previous = Buffer.from(hash, "hex");
  if (next.length !== previous.length) return false;
  return timingSafeEqual(next, previous);
}

export function signValue(value: string) {
  const secret = process.env.BETTER_AUTH_SECRET ?? "dev-only-atelier-secret-change-me-32";
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function galleryCookieName(token: string) {
  return `g_unlock_${token}`;
}

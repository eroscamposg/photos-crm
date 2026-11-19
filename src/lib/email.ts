import { Resend } from "resend";

export async function sendEmail(input: { to: string; subject: string; text: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log("[email] skipped because RESEND_API_KEY is missing", input);
    return { skipped: true as const };
  }
  const resend = new Resend(key);
  const from = process.env.RESEND_FROM ?? "Atelier North <bookings@example.com>";
  const result = await resend.emails.send({ from, to: input.to, subject: input.subject, text: input.text });
  return { skipped: false as const, result };
}

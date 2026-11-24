import Link from "next/link";
import { LoginForm } from "@/components/login-form";
export const dynamic = "force-dynamic";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="mx-auto grid min-h-screen max-w-md content-center px-6">
      <Link href="/" className="font-serif text-3xl">
        Atelier North
      </Link>
      <p className="mt-2 mb-8 text-sm text-muted">
        Staff sign in. Clients use a gallery link, not an account.
      </p>
      <LoginForm error={params.error} />
    </main>
  );
}

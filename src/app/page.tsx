import Link from "next/link";
import { getPublicStudio } from "@/lib/studio";
export const dynamic = "force-dynamic";
export default async function HomePage() {
  let studioName = "Atelier North";
  let tagline = "Portraits, families, and the quiet hours between.";
  let databaseReady = true;
  try {
    const studio = await getPublicStudio();
    if (studio) {
      studioName = studio.name;
      tagline = studio.tagline || tagline;
    }
  } catch {
    databaseReady = false;
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-between px-6 py-10">
      <header className="flex items-center justify-between text-sm">
        <span className="font-serif text-xl">{studioName}</span>
        <nav className="flex gap-4">
          <Link href="/portfolio">Portfolio</Link>
          <Link href="/book">Book</Link>
          <Link href="/login">Staff</Link>
        </nav>
      </header>
      <section className="max-w-2xl py-20">
        <p className="text-xs uppercase tracking-[0.22em] text-muted">
          Photographer studio
        </p>
        <h1 className="mt-4 font-serif text-6xl leading-[0.95]">{tagline}</h1>
        <p className="mt-6 max-w-xl text-lg text-stone-700">
          A working desk for one studio: the public portfolio, open dates, and
          private galleries clients can open without an account.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/portfolio"
            className="rounded-full bg-accent px-5 py-3 text-sm text-accent-foreground"
          >
            View the work
          </Link>
          <Link
            href="/book"
            className="rounded-full border border-line bg-card px-5 py-3 text-sm"
          >
            Request a session
          </Link>
        </div>
        {databaseReady ? null : (
          <p className="mt-6 text-sm text-amber-900">
            The database is not reachable yet. Start Postgres, then run
            migrations and the seed.
          </p>
        )}
      </section>
      <footer className="flex justify-between text-sm text-muted">
        <span>Health at /api/health</span>
        <Link href="/dashboard">Studio desk</Link>
      </footer>
    </main>
  );
}

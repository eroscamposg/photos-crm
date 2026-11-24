import Link from "next/link";
import { getPublicStudio } from "@/lib/studio";
export const dynamic = "force-dynamic";
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let name = "Atelier North";
  try {
    const studio = await getPublicStudio();
    if (studio) name = studio.name;
  } catch {
    name = "Atelier North";
  }
  return (
    <div>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 text-sm">
        <Link href="/" className="font-serif text-2xl">
          {name}
        </Link>
        <nav className="flex gap-4">
          <Link href="/portfolio">Portfolio</Link>
          <Link href="/book">Book</Link>
          <Link href="/login">Staff</Link>
        </nav>
      </header>
      <div className="mx-auto max-w-6xl px-6 pb-16">{children}</div>
    </div>
  );
}

import Link from "next/link";

import type { StaffContext } from "@/lib/studio";
import { signOut } from "@/server/actions";

const links = [
  ["/dashboard", "Dashboard"],
  ["/library", "Library"],
  ["/collections", "Portfolio"],
  ["/calendar", "Calendar"],
  ["/galleries", "Galleries"],
  ["/clients", "Clients"],
  ["/brand", "Brand"],
];

export function StudioShell({
  ctx,
  children,
}: {
  ctx: StaffContext;
  children: React.ReactNode;
}) {
  return (
    <div
      className="min-h-screen"
      style={{ ["--accent" as string]: ctx.studio.accentColor }}
    >
      <div className="mx-auto grid min-h-screen max-w-7xl md:grid-cols-[220px_1fr]">
        <aside className="border-b border-line bg-[#ebe4da] px-4 py-5 md:border-b-0 md:border-r">
          <Link href="/dashboard" className="font-serif text-2xl leading-none">
            {ctx.studio.name}
          </Link>
          <p className="mt-2 text-xs uppercase tracking-[0.16em] text-muted">
            {ctx.role}
          </p>
          <nav className="mt-6 flex gap-2 overflow-x-auto md:flex-col">
            {links.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                className="rounded-full px-3 py-2 text-sm hover:bg-white/70"
              >
                {label}
              </Link>
            ))}
          </nav>
          <form action={signOut} className="mt-6">
            <button
              className="text-sm text-muted underline-offset-4 hover:underline"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </aside>
        <div className="px-4 py-6 md:px-8">{children}</div>
      </div>
    </div>
  );
}

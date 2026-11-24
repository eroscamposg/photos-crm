import { StudioShell } from "@/components/studio-shell";
import { requireStaff } from "@/lib/studio";
export const dynamic = "force-dynamic";
export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireStaff();
  return <StudioShell ctx={ctx}>{children}</StudioShell>;
}

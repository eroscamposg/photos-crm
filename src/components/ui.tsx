import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

export function Button({
  variant = "solid",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "ghost" | "line";
}) {
  const styles = {
    solid: "bg-accent text-accent-foreground hover:opacity-90",
    ghost: "bg-transparent text-foreground hover:bg-stone-200/70",
    line: "border border-line bg-card hover:bg-white",
  }[variant];
  return (
    <button
      className={`inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium transition disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

export const fieldClass =
  "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none ring-accent/30 focus:ring-2";
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={fieldClass} {...props} />;
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${fieldClass} h-auto py-2`} {...props} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={fieldClass} {...props} />;
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium text-stone-700">{label}</span>
      {children}
    </label>
  );
}
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-line bg-card p-5 shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}
export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-stone-200/80 px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide text-stone-700">
      {children}
    </span>
  );
}

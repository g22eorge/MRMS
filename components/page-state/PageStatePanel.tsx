import type { ReactNode } from "react";

export function PageStatePanel({
  eyebrow,
  title,
  description,
  children,
  align = "center",
  className = "",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
  align?: "center" | "start";
  className?: string;
}) {
  return (
    <section
      className={`dc-card p-5 sm:p-6 ${
        align === "center" ? "text-center" : "text-left"
      } ${className}`}
    >
      {eyebrow ? (
        <p className="text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-[var(--ink-muted)]">{eyebrow}</p>
      ) : null}
      <h1 className={`${eyebrow ? "mt-1" : ""} text-xl font-semibold text-[var(--ink)]`}>{title}</h1>
      {description ? <p className="mt-2 text-sm text-[var(--ink-muted)]">{description}</p> : null}
      {children ? (
        <div className={`mt-4 flex flex-wrap gap-2 ${align === "center" ? "items-center justify-center" : ""}`}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

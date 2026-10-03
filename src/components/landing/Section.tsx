import type { ReactNode } from "react";

interface SectionHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  sub?: string;
  centered?: boolean;
}

export function SectionHeader({ eyebrow, title, sub, centered = true }: SectionHeaderProps) {
  return (
    <div className={`max-w-2xl ${centered ? "mx-auto text-center" : ""}`}>
      {eyebrow && (
        <p className="text-[11px] font-bold tracking-widest text-highlight uppercase">{eyebrow}</p>
      )}
      <h2 className="mt-2.5 font-display text-2xl font-extrabold tracking-tight sm:text-3xl md:text-4xl text-white">
        {title}
      </h2>
      {sub && (
        <p className="mt-2.5 text-xs sm:text-sm text-muted-foreground leading-relaxed">{sub}</p>
      )}
    </div>
  );
}

interface SectionProps {
  id?: string;
  children: ReactNode;
  className?: string;
  glow?: boolean;
}

export function Section({ id, children, className = "", glow = false }: SectionProps) {
  return (
    <section id={id} className={`relative scroll-mt-20 py-16 md:py-24 ${className}`}>
      {glow && (
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-[350px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[100px]"
          aria-hidden
        />
      )}
      <div className="relative mx-auto max-w-5xl px-5">{children}</div>
    </section>
  );
}

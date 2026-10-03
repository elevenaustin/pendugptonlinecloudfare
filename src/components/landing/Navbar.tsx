import { useEffect, useState } from "react";
import { Menu, X, Sparkles, Play } from "lucide-react";
import { track } from "@/lib/analytics";

const links = [
  { href: "#learn", label: "What You'll Learn" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

import { BrandLogo } from "@/components/common/BrandLogo";

export function Logo() {
  return <BrandLogo size="md" />;
}

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-200 ${
        scrolled
          ? "border-b border-border bg-background/80 backdrop-blur-xl py-3"
          : "bg-transparent py-4"
      }`}
    >
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-5">
        <Logo />

        {/* Desktop Links */}
        <div className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* Action Button */}
        <div className="hidden md:flex items-center">
          <a
            href="#training"
            onClick={() => track("cta_click", { location: "navbar" })}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-primary px-4 py-2 text-xs font-semibold text-white shadow-glow transition-all hover:opacity-95 hover:-translate-y-0.5 active:translate-y-0"
          >
            <Play className="h-3 w-3 fill-current" />
            <span>Start Learning</span>
          </a>
        </div>

        {/* Mobile menu button */}
        <button
          aria-label={open ? "Close menu" : "Open menu"}
          className="rounded-lg p-1.5 text-foreground md:hidden border border-border bg-surface"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </nav>

      {/* Mobile menu dropdown */}
      {open && (
        <div className="border-b border-border bg-background/95 px-5 pt-3 pb-5 backdrop-blur-2xl md:hidden animate-reveal">
          <div className="flex flex-col space-y-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-surface hover:text-foreground transition-colors"
              >
                {l.label}
              </a>
            ))}
          </div>
          <a
            href="#training"
            onClick={() => setOpen(false)}
            className="mt-3 flex items-center justify-center gap-2 rounded-full bg-gradient-primary py-2.5 text-center text-xs font-semibold text-white shadow-glow"
          >
            <Play className="h-3 w-3 fill-current" />
            <span>Start Learning</span>
          </a>
        </div>
      )}
    </header>
  );
}

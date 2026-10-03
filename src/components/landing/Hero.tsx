import { ArrowRight, Globe, Play, Sparkles, Wand2 } from "lucide-react";
import { track } from "@/lib/analytics";

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
      {/* Subtle Background Glow */}
      <div
        className="absolute -inset-4 rounded-3xl bg-primary/15 blur-2xl opacity-60"
        aria-hidden
      />

      {/* Browser Mockup */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-[#0f0f17] shadow-xl backdrop-blur-md">
        {/* Browser Top Bar */}
        <div className="flex items-center gap-2 border-b border-border bg-[#14141f] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
          <div className="ml-2 flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-0.5 text-[11px] font-mono text-muted-foreground">
            <Globe className="h-3 w-3 text-highlight" />
            <span>yourwebsite.com</span>
          </div>
        </div>

        {/* Website Preview Canvas */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <div className="h-3 w-20 rounded bg-foreground/80" />
            <div className="flex gap-2">
              <div className="h-2 w-10 rounded bg-muted-foreground/40" />
              <div className="h-2 w-10 rounded bg-muted-foreground/40" />
            </div>
          </div>

          <div className="space-y-2.5 pt-2">
            <div className="inline-block rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-semibold text-highlight">
              AI-GENERATED
            </div>
            <h4 className="text-lg font-bold text-white tracking-tight leading-snug">
              Modern Artisan Cafe & Store
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Crafted with responsive layouts, online menu ordering, and direct WhatsApp booking.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <div className="rounded-full bg-gradient-primary px-3.5 py-1.5 text-[11px] font-semibold text-white">
              Order Online
            </div>
            <div className="rounded-full border border-border bg-white/5 px-3 py-1.5 text-[11px] font-medium text-foreground/80">
              View Menu
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-3 gap-2.5 pt-2">
            {["Espresso", "Bakery", "Reservations"].map((item) => (
              <div
                key={item}
                className="rounded-xl border border-border/60 bg-white/[0.02] p-2.5 text-center"
              >
                <div className="mx-auto mb-1.5 h-1.5 w-6 rounded-full bg-primary/60" />
                <span className="text-[10px] font-medium text-muted-foreground block truncate">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between border-t border-border bg-[#12121c] px-4 py-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Ready to publish
          </span>
          <span>100% Responsive</span>
        </div>
      </div>

      {/* Floating Prompt Card */}
      <div className="glass-panel animate-float absolute -top-5 -left-4 hidden sm:flex items-start gap-2.5 rounded-xl p-3 shadow-lg max-w-xs">
        <Wand2 className="mt-0.5 h-4 w-4 shrink-0 text-highlight" />
        <p className="text-xs text-foreground/90 leading-snug">
          "Build a modern cafe website with online menu and WhatsApp booking."
        </p>
      </div>

      {/* Floating Bottom Badge */}
      <div className="glass-panel absolute -bottom-4 -right-3 hidden sm:flex items-center gap-2 rounded-xl px-3.5 py-2 shadow-lg">
        <Sparkles className="h-3.5 w-3.5 text-highlight" />
        <span className="text-xs font-semibold text-white">Generated in seconds</span>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-28 pb-20 md:pt-36 md:pb-28">
      {/* Background Grids */}
      <div className="bg-grid absolute inset-0 opacity-60" aria-hidden />
      <div
        className="absolute left-1/2 top-0 h-[450px] w-[800px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px] -z-10"
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-5xl items-center gap-12 px-5 lg:grid-cols-12 lg:gap-8">
        {/* Text Content */}
        <div className="animate-reveal lg:col-span-7">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold tracking-wide text-highlight">
            <Sparkles className="h-3 w-3" /> AI Website Masterclass
          </span>

          <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] sm:text-5xl lg:text-6xl tracking-tight text-white">
            Build Stunning Websites <span className="text-gradient">with AI.</span>
          </h1>

          <p className="mt-5 max-w-lg text-base sm:text-lg text-muted-foreground leading-relaxed">
            Learn to design, build, and launch modern websites using AI tools — even without
            traditional coding experience.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
            <a
              href="#training"
              onClick={() => track("cta_click", { location: "hero_primary" })}
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-gradient-primary px-7 py-3.5 text-sm font-semibold text-white shadow-glow transition-all hover:-translate-y-0.5"
            >
              <Play className="h-4 w-4 fill-current transition-transform group-hover:scale-110" />
              <span>Watch Free Training</span>
            </a>

            <a
              href="#pricing"
              onClick={() => track("cta_click", { location: "hero_secondary" })}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-surface px-6 py-3.5 text-sm font-semibold text-foreground hover:bg-card hover:border-primary/40 transition-colors"
            >
              <span>Explore Masterclass</span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </a>
          </div>

          <p className="mt-5 text-xs text-muted-foreground">
            100% practical • Beginner friendly • Learn at your own pace
          </p>
        </div>

        {/* Visual Mockup */}
        <div className="lg:col-span-5">
          <HeroVisual />
        </div>
      </div>
    </section>
  );
}

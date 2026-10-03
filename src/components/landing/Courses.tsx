import { Check, Lock, PlayCircle, Radio } from "lucide-react";
import { siteConfig } from "@/config/site";
import { track } from "@/lib/analytics";
import { Section, SectionHeader } from "./Section";

type Interest = "recorded" | "live";

export function Courses({
  unlocked,
  onSelect,
}: {
  unlocked: boolean;
  onSelect: (i: Interest) => void;
}) {
  const { recorded, live } = siteConfig.courses;

  const handleSelect = (tier: Interest) => {
    track("course_select", { course: tier });
    if (tier === "recorded" && recorded.checkoutEnabled) {
      // Direct checkout integration
      onSelect("recorded");
    } else {
      onSelect(tier);
    }
  };

  return (
    <Section id="pricing" className="bg-surface/50 border-y border-border">
      <SectionHeader
        eyebrow="COURSE PRICING"
        title="Choose Your Learning Path."
        sub="Start learning with a format that works for you."
      />

      {!unlocked ? (
        <div className="mx-auto mt-12 max-w-md rounded-2xl border border-dashed border-border bg-card p-8 text-center shadow-lg">
          <Lock className="mx-auto h-7 w-7 text-highlight" />
          <h3 className="mt-4 font-display text-lg font-bold text-white">
            Course Options Unlock After Training
          </h3>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Watch the free training above to explore the workflow and unlock masterclass enrollment.
          </p>
          <a
            href="#training"
            className="mt-5 inline-block rounded-full bg-gradient-primary px-5 py-2.5 text-xs font-semibold text-white shadow-glow"
          >
            Go to Free Training
          </a>
        </div>
      ) : (
        <div className="mx-auto mt-12 grid max-w-3xl gap-6 sm:grid-cols-2">
          {/* Recorded Masterclass Card */}
          <div className="relative flex flex-col justify-between rounded-2xl border-2 border-primary/50 bg-card p-7 shadow-glow">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-highlight uppercase">
                <PlayCircle className="h-4 w-4" />
                <span>RECORDED MASTERCLASS</span>
              </div>

              <div className="mt-5 flex items-baseline gap-2">
                <span className="font-display text-4xl font-extrabold text-white">
                  {recorded.price}
                </span>
                <span className="text-xs text-muted-foreground">one-time</span>
              </div>

              <p className="mt-4 text-xs text-muted-foreground leading-relaxed">{recorded.desc}</p>

              <ul className="mt-6 space-y-2.5 border-t border-border pt-4">
                {recorded.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-xs text-foreground/90">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8">
              <button
                onClick={() => handleSelect("recorded")}
                className="w-full rounded-full bg-gradient-primary py-3 text-xs font-bold text-white shadow-glow transition-all hover:opacity-95 active:scale-98"
              >
                Get Recorded Access
              </button>
            </div>
          </div>

          {/* Live Masterclass Card */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-card/60 p-7">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                <Radio className="h-4 w-4 text-highlight" />
                <span>LIVE MASTERCLASS</span>
              </div>

              <div className="mt-5 flex items-baseline gap-2">
                <span className="font-display text-3xl font-extrabold text-white">
                  {live.price ?? "Coming soon"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {live.price ? "per batch" : "Dates and price to be announced"}
              </p>

              <p className="mt-4 text-xs text-muted-foreground leading-relaxed">{live.desc}</p>

              <ul className="mt-6 space-y-2.5 border-t border-border pt-4">
                {live.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8">
              <button
                onClick={() => handleSelect("live")}
                className="w-full rounded-full border border-border bg-surface py-3 text-xs font-semibold text-foreground hover:bg-card hover:border-primary/40 transition-colors"
              >
                {live.status === "open" ? "Explore Live Classes" : "Join Interest List"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

import { Check, Lock, PlayCircle } from "lucide-react";
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
  const { recorded } = siteConfig.courses;

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
        <div className="mx-auto mt-12 max-w-lg">
          {/* Masterclass Card */}
          <div className="relative flex flex-col justify-between rounded-2xl border-2 border-primary/50 bg-card p-7 shadow-glow">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-highlight uppercase">
                  <PlayCircle className="h-4 w-4" />
                  <span>AI WEBSITE MASTERCLASS</span>
                </div>
                <span className="rounded-lg border border-[#00F076]/40 bg-[#00F076]/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#00F076]">
                  {recorded.discount}
                </span>
              </div>

              <div className="mt-5 flex items-baseline gap-2.5 flex-wrap">
                <span className="font-display text-4xl font-extrabold text-white">
                  {recorded.price}
                </span>
                <span className="text-base line-through text-muted-foreground/60 font-semibold">
                  {recorded.originalPrice}
                </span>
                <span className="text-xs text-[#00F076] font-semibold bg-[#00F076]/10 px-2 py-0.5 rounded border border-[#00F076]/20">
                  Flat Fee
                </span>
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
                className="w-full rounded-full bg-gradient-primary py-3 text-xs font-bold text-white shadow-glow transition-all hover:opacity-95 active:scale-98 cursor-pointer"
              >
                Enroll Now — Flat {recorded.price}
              </button>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

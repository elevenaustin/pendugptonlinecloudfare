import { Play } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { siteConfig } from "@/config/site";
import { Section, SectionHeader } from "./Section";
import { Logo } from "./Navbar";
import { track } from "@/lib/analytics";

const faqs = [
  {
    q: "Do I need coding experience?",
    a: "No. The masterclass is designed for creators with no prior programming knowledge. You will learn visual prompt-driven workflows to generate clean website layouts.",
  },
  {
    q: "Is this suitable for beginners?",
    a: "Yes. Every lesson starts with fundamentals and builds progressively into full practical website projects.",
  },
  {
    q: "Which tools will I learn?",
    a: "You will learn modern AI website builders and prompting tools such as ChatGPT, Claude, Lovable, Bolt, and Cursor.",
  },
  {
    q: "What is included in the ₹997 masterclass?",
    a: "You get full recorded lessons, practical website-building workflows, prompt guides, and lifetime self-paced access.",
  },
  {
    q: "How do I get access after payment?",
    a: "Access details and resources are delivered immediately to your registered WhatsApp number and email.",
  },
  {
    q: "Can I build websites for clients after learning?",
    a: "Yes. You own 100% of the websites and code you create and can offer website design services to clients or local businesses.",
  },
];

export function FaqAndClosing() {
  return (
    <Section id="faq">
      <SectionHeader
        eyebrow="FREQUENTLY ASKED QUESTIONS"
        title="Questions, Answered."
        sub="Clear answers to common questions before you start."
      />

      {/* FAQ Accordion */}
      <div className="mx-auto mt-10 max-w-2xl">
        <Accordion type="single" collapsible className="space-y-2.5">
          {faqs.map((f, i) => (
            <AccordionItem
              key={f.q}
              value={`faq-${i}`}
              className="rounded-xl border border-border bg-card px-5 transition-colors data-[state=open]:border-primary/40"
            >
              <AccordionTrigger className="py-4 text-left text-sm font-semibold text-white hover:no-underline hover:text-highlight">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground leading-relaxed pb-4">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      {/* Merged Final CTA */}
      <div className="mx-auto mt-16 max-w-2xl text-center rounded-2xl border border-primary/30 bg-card p-8 sm:p-10 shadow-glow">
        <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
          Start Building with AI.
        </h3>
        <p className="mt-2 text-xs sm:text-sm text-muted-foreground">
          Watch the free training to see how easy it is to create your first website.
        </p>
        <a
          href="#training"
          onClick={() => track("cta_click", { location: "final_cta" })}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-primary px-7 py-3.5 text-xs font-bold text-white shadow-glow transition-all hover:-translate-y-0.5 active:translate-y-0"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          <span>Watch Free Training</span>
        </a>
      </div>
    </Section>
  );
}

import { SiteFooter } from "@/components/common/SiteFooter";

export function Footer() {
  return <SiteFooter />;
}

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Layout,
  MessageSquareCode,
  Palette,
  Rocket,
  Sparkles,
} from "lucide-react";
import { Section, SectionHeader } from "./Section";

export function WhatYouLearn() {
  const [expanded, setExpanded] = useState(false);

  const cards = [
    {
      icon: Layout,
      title: "AI Website Creation",
      desc: "Turn ideas into complete website layouts using AI.",
    },
    {
      icon: MessageSquareCode,
      title: "Prompt Engineering",
      desc: "Learn to guide AI with clear, effective instructions.",
    },
    {
      icon: Palette,
      title: "Customization",
      desc: "Improve website layouts, content, and design without starting over.",
    },
    {
      icon: Rocket,
      title: "Launch and Find Clients",
      desc: "Understand publishing basics and how to approach potential clients.",
    },
  ];

  const modules = [
    {
      num: "01",
      title: "Foundations of AI Web Architecture",
      desc: "Understanding how AI generates modern UI layouts and page structures.",
    },
    {
      num: "02",
      title: "Prompt Engineering for UI/UX",
      desc: "Writing clear, structured prompts for dark modes, typography, and responsive grids.",
    },
    {
      num: "03",
      title: "Building Multi-Page Sites & Funnels",
      desc: "Constructing multi-section landing pages, portfolios, and commercial sites.",
    },
    {
      num: "04",
      title: "Forms, Integrations & Interactivity",
      desc: "Connecting lead capture forms, WhatsApp direct ordering, and dynamic buttons.",
    },
    {
      num: "05",
      title: "Custom Domains, Free Hosting & SEO",
      desc: "Publishing live on custom domains with free cloud hosting and search optimization.",
    },
    {
      num: "06",
      title: "Freelance Client Acquisition & Delivery",
      desc: "Finding potential clients, presenting AI website prototypes, and project pricing.",
    },
  ];

  return (
    <Section id="learn">
      <SectionHeader
        eyebrow="WHAT YOU'LL LEARN"
        title="From Concept to Finished Website."
        sub="Four practical capabilities you will master to build real websites with confidence."
      />

      {/* 4 Minimal Core Cards */}
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.title}
            className="rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/40 hover:-translate-y-0.5"
          >
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-highlight">
              <c.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-5 font-display text-base font-bold text-white">{c.title}</h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{c.desc}</p>
          </div>
        ))}
      </div>

      {/* Optional Expandable Detailed Syllabus */}
      <div className="mt-10 text-center">
        <button
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-5 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <span>{expanded ? "Hide Detailed Curriculum" : "View Full Curriculum Breakdown"}</span>
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>

        {expanded && (
          <div className="mt-6 mx-auto max-w-3xl text-left border border-border rounded-2xl bg-card p-6 animate-reveal space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-highlight flex items-center gap-1.5 pb-2 border-b border-border">
              <Sparkles className="h-3.5 w-3.5" /> 6-Module Masterclass Syllabus
            </h4>
            <div className="grid gap-3 sm:grid-cols-2 pt-1">
              {modules.map((m) => (
                <div key={m.num} className="rounded-xl border border-border/50 bg-surface p-3.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-highlight">
                    <span>MODULE {m.num}</span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-white">{m.title}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{m.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

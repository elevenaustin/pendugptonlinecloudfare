import { createFileRoute, redirect } from "@tanstack/react-router";
import { NextStepScreen } from "@/components/funnel/NextStepScreen";
import { siteConfig } from "@/config/site";

export const Route = createFileRoute("/next-step")({
  beforeLoad: () => {
    throw redirect({ to: "/classfeesecrettunnel" });
  },
  head: () => ({
    meta: [
      { title: `Class Fee & Pricing Details — ${siteConfig.brand}` },
      { name: "description", content: "Masterclass enrollment options for verified learners." },
      { property: "og:title", content: `Class Fee & Pricing Details — ${siteConfig.brand}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: NextStepScreen,
});


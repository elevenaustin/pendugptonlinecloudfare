import { createFileRoute } from "@tanstack/react-router";
import { NextStepScreen } from "@/components/funnel/NextStepScreen";
import { siteConfig } from "@/config/site";

export const Route = createFileRoute("/next-step")({
  head: () => ({
    meta: [
      { title: `Enroll in Masterclass — ${siteConfig.brand}` },
      { name: "description", content: "Masterclass enrollment options for verified learners." },
      { property: "og:title", content: `Enroll in Masterclass — ${siteConfig.brand}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: NextStepScreen,
});

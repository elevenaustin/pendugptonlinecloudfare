import { createFileRoute } from "@tanstack/react-router";
import { TrainingScreen } from "@/components/funnel/TrainingScreen";
import { siteConfig } from "@/config/site";

export const Route = createFileRoute("/training")({
  head: () => ({
    meta: [
      { title: `Free Training — ${siteConfig.brand}` },
      { name: "description", content: "Watch the free AI website building masterclass." },
      { property: "og:title", content: `Free Training — ${siteConfig.brand}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TrainingScreen,
});

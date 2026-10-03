import { createFileRoute } from "@tanstack/react-router";
import { NextStepScreen } from "@/components/funnel/NextStepScreen";
import { siteConfig } from "@/config/site";
import { useEffect } from "react";

function SecretTestWrapper() {
  useEffect(() => {
    try {
      localStorage.setItem(
        siteConfig.video.registrationKey,
        JSON.stringify({ whatsapp: "9876543210", registered: true, isTester: true }),
      );
      localStorage.setItem(siteConfig.video.completionKey, "true");
      localStorage.setItem("pendugpt_secret_bypass", "true");
    } catch {
      /* ignore */
    }
  }, []);

  return <NextStepScreen />;
}

export const Route = createFileRoute("/secret-test")({
  head: () => ({
    meta: [
      { title: `Tester Preview — ${siteConfig.brand}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SecretTestWrapper,
});

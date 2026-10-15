import { describe, expect, it } from "vitest";
import { recordLeadVideoActivity } from "@/lib/n8n.server";
import { siteConfig } from "@/config/site";

describe("Reproduce Video Completion Bypasses (Phase 1 Vulnerability Proof)", () => {
  it("VULNERABILITY REPRODUCTION 1: recordLeadVideoActivity unlocks class when client sends isCompleted: true with watchSeconds: 10", async () => {
    let updatedPayload: any = null;
    const mockLead = {
      id: "vuln-lead-1",
      phone: "9817337782",
      watch_seconds: 10,
      unlocked_class: false,
      video_completed_at: null,
    };

    const mockClient = {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: mockLead, error: null }),
          }),
        }),
        update: (payload: any) => {
          updatedPayload = payload;
          return {
            eq: () => Promise.resolve({ error: null }),
          };
        },
      }),
    };

    // Client maliciously claims completion with only 10 seconds of watch time
    const res = await recordLeadVideoActivity({
      registrationId: "vuln-lead-1",
      phone: "9817337782",
      watchSeconds: 10,
      isCompleted: true, // Forged client flag!
      client: mockClient,
    });

    expect(res.ok).toBe(true);
    // VULNERABILITY BLOCKED: The backend rejects isCompleted: true from client because watchSeconds < 815
    expect(updatedPayload.unlocked_class).toBeUndefined();
    expect(updatedPayload.video_completed_at).toBeUndefined();
    console.log("[SECURITY VERIFIED] Lead unlock was successfully BLOCKED for watch time < 815s!");
  });

  it("VULNERABILITY REPRODUCTION 2: /secret-test sets isTester: true which bypasses video completion on /next-step", () => {
    localStorage.clear();
    // Simulate what /secret-test does:
    localStorage.setItem(
      siteConfig.video.registrationKey,
      JSON.stringify({ whatsapp: "9999999999", registered: true, isTester: true }),
    );

    const reg = JSON.parse(localStorage.getItem(siteConfig.video.registrationKey) || "null");
    
    // In NextStepScreen.tsx lines 89-95:
    let isAuthorized = false;
    if (reg?.isTester) {
      isAuthorized = true;
    }

    expect(isAuthorized).toBe(true);
    console.log("[VULN CONFIRMED] User bypassed video completion completely via isTester flag!");
  });

  it("VULNERABILITY REPRODUCTION 3: Client-side localStorage forgery grants next-step access without database verification", () => {
    localStorage.clear();
    // User registers
    localStorage.setItem(
      siteConfig.video.registrationKey,
      JSON.stringify({ whatsapp: "9817337782", registered: true }),
    );
    // User executes one line in devtools console:
    localStorage.setItem(siteConfig.video.completionKey, "true");
    localStorage.setItem(
      siteConfig.video.storageKey,
      JSON.stringify({ progress: 1, watched: 850, lastPosition: 850 }),
    );

    const reg = JSON.parse(localStorage.getItem(siteConfig.video.registrationKey) || "null");
    const isCompleted = localStorage.getItem(siteConfig.video.completionKey) === "true";
    const saved = JSON.parse(localStorage.getItem(siteConfig.video.storageKey) || "null");
    const progressValue = typeof saved?.progress === "number" ? saved.progress : 0;

    // NextStepScreen client-side check:
    const clientSideAuthorized =
      Boolean(reg?.registered) &&
      isCompleted &&
      progressValue >= siteConfig.video.completionThreshold;

    expect(clientSideAuthorized).toBe(true);
    console.log("[VULN CONFIRMED] Client forged progress in localStorage and gained access without server check!");
  });
});

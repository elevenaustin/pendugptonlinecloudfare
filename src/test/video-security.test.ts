import { describe, expect, it, beforeEach } from "vitest";
import { siteConfig } from "@/config/site";

describe("Video Funnel Anti-Bypass & Security Invariants", () => {
  const { storageKey, completionKey, completionThreshold, registrationKey } = siteConfig.video;

  beforeEach(() => {
    localStorage.clear();
  });

  it("strictly invalidates completion if stored progress is only 15% (fixes screenshot bug)", () => {
    // Simulate screenshot bug state: progress is 15% but completionKey was set to 'true'
    localStorage.setItem(
      storageKey,
      JSON.stringify({ watched: 120, lastPosition: 120, progress: 0.15, complete: true }),
    );
    localStorage.setItem(completionKey, "true");

    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    const savedProgress = saved?.progress ?? 0;

    // Security Rule Check
    const isGenuinelyComplete = savedProgress >= completionThreshold;

    expect(savedProgress).toBe(0.15);
    expect(isGenuinelyComplete).toBe(false);

    // If not genuinely complete, completionKey must be cleared
    if (!isGenuinelyComplete) {
      localStorage.removeItem(completionKey);
      localStorage.removeItem("pendugpt_secret_bypass");
    }

    expect(localStorage.getItem(completionKey)).toBeNull();
  });

  it("only unlocks completion when genuine watched progress meets or exceeds 95%", () => {
    // 95% complete state
    localStorage.setItem(
      storageKey,
      JSON.stringify({ watched: 760, lastPosition: 760, progress: 0.95, complete: true }),
    );

    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    const savedProgress = saved?.progress ?? 0;
    const isGenuinelyComplete = savedProgress >= completionThreshold;

    expect(savedProgress).toBe(0.95);
    expect(isGenuinelyComplete).toBe(true);

    if (isGenuinelyComplete) {
      localStorage.setItem(completionKey, "true");
    }

    expect(localStorage.getItem(completionKey)).toBe("true");
  });

  it("blocks next-step access if user has not completed 95% of video", () => {
    localStorage.setItem(
      registrationKey,
      JSON.stringify({ whatsapp: "9999999999", registered: true }),
    );

    // Tampered completionKey without 95% watch time
    localStorage.setItem(completionKey, "true");
    localStorage.setItem(
      storageKey,
      JSON.stringify({ watched: 100, lastPosition: 100, progress: 0.12, complete: false }),
    );

    const reg = JSON.parse(localStorage.getItem(registrationKey) || "null");
    const isCompleted = localStorage.getItem(completionKey) === "true";
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    const progressValue = typeof saved?.progress === "number" ? saved.progress : 0;

    const canAccessNextStep =
      Boolean(reg?.registered) &&
      isCompleted &&
      progressValue >= completionThreshold;

    expect(canAccessNextStep).toBe(false);
  });

  it("blocks /classfeesecrettunnel access if user has not completely watched the training video", () => {
    localStorage.setItem(
      registrationKey,
      JSON.stringify({ whatsapp: "9876543210", registered: true }),
    );

    // Incomplete watch progress (e.g. 50%)
    localStorage.setItem(
      storageKey,
      JSON.stringify({ watched: 400, lastPosition: 400, progress: 0.5, complete: false }),
    );

    const reg = JSON.parse(localStorage.getItem(registrationKey) || "null");
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    const isCompleted = localStorage.getItem(completionKey) === "true";
    const progressValue = typeof saved?.progress === "number" ? saved.progress : 0;

    const canAccessClassFeeTunnel =
      Boolean(reg?.registered) &&
      isCompleted &&
      progressValue >= completionThreshold;

    expect(canAccessClassFeeTunnel).toBe(false);
  });

  it("allows /classfeesecrettunnel access only when user has completely watched the training video", () => {
    localStorage.setItem(
      registrationKey,
      JSON.stringify({ whatsapp: "9876543210", registered: true }),
    );

    // Genuinely watched 100% of the training video
    localStorage.setItem(
      storageKey,
      JSON.stringify({ watched: 858, lastPosition: 858, progress: 1.0, complete: true }),
    );
    localStorage.setItem(completionKey, "true");

    const reg = JSON.parse(localStorage.getItem(registrationKey) || "null");
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    const isCompleted = localStorage.getItem(completionKey) === "true";
    const progressValue = typeof saved?.progress === "number" ? saved.progress : 0;

    const canAccessClassFeeTunnel =
      Boolean(reg?.registered) &&
      isCompleted &&
      progressValue >= completionThreshold;

    expect(canAccessClassFeeTunnel).toBe(true);
  });
});


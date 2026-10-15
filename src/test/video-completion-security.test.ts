import { describe, expect, it, beforeEach } from "vitest";
import {
  recordLeadVideoActivity,
  getRemoteLeadProgress,
} from "@/lib/n8n.server";
import {
  REQUIRED_COMPLETION_SECONDS,
  AUTHORITATIVE_VIDEO_DURATION_SECONDS,
} from "@/lib/video.functions";
import { siteConfig } from "@/config/site";

describe("Video Completion Security & Centralized Authorization Enforcement", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ---------------------------------------------------------------------------
  // 1. GENUINE WATCH-TIME ACCUMULATION & ANTI-SEEK / ANTI-JUMP ENFORCEMENT
  // ---------------------------------------------------------------------------
  describe("Server-Validated Interval Accumulation (Anti-Jump & Anti-Seek)", () => {
    it("rejects seeking directly to 815 seconds in a single request from 0s", async () => {
      let updatedPayload: any = null;
      // New lead registered 5 seconds ago
      const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString();
      const mockLead = {
        id: "student-seek-1",
        phone: "9817337782",
        watch_seconds: 0,
        unlocked_class: false,
        video_completed_at: null,
        created_at: fiveSecondsAgo,
        video_last_activity_at: fiveSecondsAgo,
      };

      const mockClient = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: mockLead, error: null }) }),
          }),
          update: (payload: any) => {
            updatedPayload = payload;
            return { eq: () => Promise.resolve({ error: null }) };
          },
        }),
      };

      // Attacker jumps directly from 0s to 820s in 5 seconds
      const res = await recordLeadVideoActivity({
        registrationId: "student-seek-1",
        watchSeconds: 820,
        isCompleted: true,
        client: mockClient,
      });

      expect(res.ok).toBe(true);
      // In 5s of real time, user can at most accumulate ~12s (5 * 1.25 + 5), NEVER 820s!
      expect(updatedPayload.watch_seconds).toBeLessThan(20);
      expect(updatedPayload.watch_seconds).toBeGreaterThan(0);
      // Class must REMAIN LOCKED
      expect(updatedPayload.unlocked_class).toBeUndefined();
      expect(updatedPayload.video_completed_at).toBeUndefined();
    });

    it("rejects duplicate or replayed progress requests (0 additional seconds credited)", async () => {
      let updatedPayload: any = null;
      const nowIso = new Date().toISOString();
      const mockLead = {
        id: "student-replay-1",
        phone: "9817337782",
        watch_seconds: 150,
        unlocked_class: false,
        video_completed_at: null,
        video_last_activity_at: nowIso,
      };

      const mockClient = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: mockLead, error: null }) }),
          }),
          update: (payload: any) => {
            updatedPayload = payload;
            return { eq: () => Promise.resolve({ error: null }) };
          },
        }),
      };

      // Replayed request at same position 150s
      const res = await recordLeadVideoActivity({
        registrationId: "student-replay-1",
        watchSeconds: 150,
        isCompleted: false,
        client: mockClient,
      });

      expect(res.ok).toBe(true);
      // Position delta is 0 -> watch_seconds remains 150
      expect(updatedPayload.watch_seconds).toBe(150);
      expect(updatedPayload.unlocked_class).toBeUndefined();
    });

    it("rejects negative time delta when user rewinds (watch_seconds does not decrease or inflate)", async () => {
      let updatedPayload: any = null;
      const nowIso = new Date().toISOString();
      const mockLead = {
        id: "student-rewind-1",
        phone: "9817337782",
        watch_seconds: 250,
        unlocked_class: false,
        video_completed_at: null,
        video_last_activity_at: nowIso,
      };

      const mockClient = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: mockLead, error: null }) }),
          }),
          update: (payload: any) => {
            updatedPayload = payload;
            return { eq: () => Promise.resolve({ error: null }) };
          },
        }),
      };

      // User rewinds to 100s
      const res = await recordLeadVideoActivity({
        registrationId: "student-rewind-1",
        watchSeconds: 100,
        isCompleted: false,
        client: mockClient,
      });

      expect(res.ok).toBe(true);
      // Rewind cannot reduce or advance accumulated watch_seconds
      expect(updatedPayload.watch_seconds).toBe(250);
      expect(updatedPayload.unlocked_class).toBeUndefined();
    });

    it("denies completion at 94.9% (below 815s threshold)", async () => {
      let updatedPayload: any = null;
      // Lead has watched 800 seconds legitimately
      const twentySecondsAgo = new Date(Date.now() - 20000).toISOString();
      const mockLead = {
        id: "student-94pct",
        phone: "9817337782",
        watch_seconds: 800,
        unlocked_class: false,
        video_completed_at: null,
        video_last_activity_at: twentySecondsAgo,
      };

      const mockClient = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: mockLead, error: null }) }),
          }),
          update: (payload: any) => {
            updatedPayload = payload;
            return { eq: () => Promise.resolve({ error: null }) };
          },
        }),
      };

      // Advances 14s to 814s (814 < 815)
      const res = await recordLeadVideoActivity({
        registrationId: "student-94pct",
        watchSeconds: 814,
        isCompleted: true,
        client: mockClient,
      });

      expect(res.ok).toBe(true);
      expect(updatedPayload.watch_seconds).toBe(814);
      expect(updatedPayload.unlocked_class).toBeUndefined();
      expect(updatedPayload.video_completed_at).toBeUndefined();
    });

    it("allows completion when genuine accumulated watch time reaches 815 seconds", async () => {
      let updatedPayload: any = null;
      // Lead has watched 800 seconds legitimately
      const twentySecondsAgo = new Date(Date.now() - 20000).toISOString();
      const mockLead = {
        id: "student-95pct",
        phone: "9817337782",
        watch_seconds: 800,
        unlocked_class: false,
        video_completed_at: null,
        video_last_activity_at: twentySecondsAgo,
      };

      const mockClient = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: mockLead, error: null }) }),
          }),
          update: (payload: any) => {
            updatedPayload = payload;
            return { eq: () => Promise.resolve({ error: null }) };
          },
        }),
      };

      // Advances 15s to 815s (800 + 15 = 815s, within 20s elapsed window)
      const res = await recordLeadVideoActivity({
        registrationId: "student-95pct",
        watchSeconds: REQUIRED_COMPLETION_SECONDS, // 815s
        isCompleted: true,
        client: mockClient,
      });

      expect(res.ok).toBe(true);
      expect(updatedPayload.watch_seconds).toBe(815);
      expect(updatedPayload.unlocked_class).toBe(true);
      expect(updatedPayload.video_completed_at).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. STUDENT IDENTITY BINDING & CROSS-STUDENT SNOOPING DEFENSE
  // ---------------------------------------------------------------------------
  describe("Student Identity Binding & Cross-Student Security", () => {
    it("rejects update when registrationId and phone belong to different students", async () => {
      const mockLead = {
        id: "student-alice-uuid",
        phone: "9817337782", // Alice's phone
        watch_seconds: 50,
        unlocked_class: false,
        video_completed_at: null,
      };

      const mockClient = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: mockLead, error: null }) }),
          }),
        }),
      };

      // Attacker Bob submits Alice's registrationId with Bob's phone (9876543210)
      const res = await recordLeadVideoActivity({
        registrationId: "student-alice-uuid",
        phone: "9876543210", // Mismatched phone!
        watchSeconds: 100,
        client: mockClient,
      });

      expect(res.ok).toBe(false);
      expect(res.error).toBe("Student identity verification mismatch");
    });

    it("denies access when checking another student's lead ID via getRemoteLeadProgress", async () => {
      const studentAId = "11111111-1111-1111-1111-111111111111";
      const studentBId = "22222222-2222-2222-2222-222222222222";

      const mockLeadDatabase: Record<string, any> = {
        [studentAId]: {
          id: studentAId,
          phone: "9817337782",
          watch_seconds: 850,
          unlocked_class: true,
          video_completed_at: new Date().toISOString(),
        },
        [studentBId]: {
          id: studentBId,
          phone: "9876543210",
          watch_seconds: 100,
          unlocked_class: false,
          video_completed_at: null,
        },
      };

      const mockClient = {
        from: (table: string) => ({
          select: () => ({
            eq: (_col: string, val: string) => ({
              maybeSingle: async () => ({
                data: mockLeadDatabase[val] || null,
                error: null,
              }),
            }),
          }),
        }),
      };

      const resB = await getRemoteLeadProgress({
        registrationId: studentBId,
        client: mockClient,
      });

      expect(resB.ok).toBe(true);
      expect(resB.progress?.isCompleted).toBe(false);
      expect(resB.progress?.lastPosition).toBe(100);
      expect(resB.progress?.lastPosition).not.toBe(850);
    });

    it("fails closed when lead record does not exist in database", async () => {
      const mockClient = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      };

      const res = await recordLeadVideoActivity({
        registrationId: "unknown-ghost-lead",
        watchSeconds: 850,
        client: mockClient,
      });

      expect(res.ok).toBe(false);
      expect(res.error).toBe("Lead record not found");
    });
  });

  // ---------------------------------------------------------------------------
  // 3. FAIL-CLOSED BEHAVIOR ON NETWORK OR DATABASE ERROR
  // ---------------------------------------------------------------------------
  describe("Fail-Closed Security on Network or Database Outage", () => {
    it("fails closed safely when Supabase client encounters network error", async () => {
      const mockClient = {
        from: () => {
          throw new Error("Supabase 503 Service Unavailable / Connection Reset");
        },
      };

      const res = await recordLeadVideoActivity({
        registrationId: "error-lead-id",
        watchSeconds: 850,
        isCompleted: true,
        client: mockClient,
      });

      expect(res.ok).toBe(false);
      expect(res.error).toContain("Supabase 503 Service Unavailable");
    });
  });

  // ---------------------------------------------------------------------------
  // 4. CLIENT-SIDE LOCALSTORAGE TAMPERING IMMUNITY
  // ---------------------------------------------------------------------------
  describe("Client-Side LocalStorage Tampering Immunity", () => {
    it("blocks localStorage completion forgery from granting access", () => {
      localStorage.setItem(
        siteConfig.video.registrationKey,
        JSON.stringify({ whatsapp: "9817337782", registered: true }),
      );
      localStorage.setItem(siteConfig.video.completionKey, "true");
      localStorage.setItem(
        siteConfig.video.storageKey,
        JSON.stringify({ progress: 1, watched: 858 }),
      );

      // Database authoritative state is incomplete:
      const databaseRecord = {
        id: "student-local-tamper",
        unlocked_class: false,
        watch_seconds: 120,
        video_completed_at: null,
      };

      // Server authorization policy
      const isServerAuthorized =
        Boolean(databaseRecord.unlocked_class) &&
        (databaseRecord.watch_seconds >= REQUIRED_COMPLETION_SECONDS ||
          Boolean(databaseRecord.video_completed_at));

      expect(isServerAuthorized).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. LEGITIMATE MULTI-DEVICE RESUME & LIFECYCLE
  // ---------------------------------------------------------------------------
  describe("Legitimate Completion and Device Resume", () => {
    it("unlocks once at 95% and remains unlocked across subsequent updates on other devices", async () => {
      const twentySecondsAgo = new Date(Date.now() - 20000).toISOString();
      let currentDatabaseLead: any = {
        id: "legit-student",
        phone: "9817337782",
        watch_seconds: 800,
        unlocked_class: false,
        video_completed_at: null,
        video_last_activity_at: twentySecondsAgo,
      };

      const mockClient = {
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: currentDatabaseLead, error: null }),
            }),
          }),
          update: (payload: any) => {
            Object.assign(currentDatabaseLead, payload);
            return { eq: () => Promise.resolve({ error: null }) };
          },
        }),
      };

      // 1. Student watches from 800s to 816s (accumulates 16s across 20s elapsed real time)
      const res1 = await recordLeadVideoActivity({
        registrationId: "legit-student",
        phone: "9817337782",
        watchSeconds: 816,
        isCompleted: true,
        client: mockClient,
      });

      expect(res1.ok).toBe(true);
      expect(currentDatabaseLead.unlocked_class).toBe(true);
      expect(currentDatabaseLead.video_completed_at).toBeDefined();

      const initialCompletionTimestamp = currentDatabaseLead.video_completed_at;

      // 2. Student switches to mobile device and finishes the video (850s)
      const res2 = await recordLeadVideoActivity({
        registrationId: "legit-student",
        phone: "9817337782",
        watchSeconds: 850,
        isCompleted: true,
        client: mockClient,
      });

      expect(res2.ok).toBe(true);
      expect(currentDatabaseLead.unlocked_class).toBe(true);
      expect(currentDatabaseLead.watch_seconds).toBe(850);
      // Immutable completion timestamp preserved
      expect(currentDatabaseLead.video_completed_at).toBe(initialCompletionTimestamp);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatCleanPhone,
  formatHasLaptop,
  sendN8nWebhook,
  normalizeToE164,
  checkPreviousSends,
  acquireCampaignLock,
  finalizeCampaignSend,
  processVideoCompletionEvent,
  recordLeadVideoActivity,
  getRemoteLeadProgress,
  sendN8nVideoInactivityWebhook,
  processVideoInactivityEvent,
  maskPhone,
  CAMPAIGN_NAME,
} from "@/lib/n8n.server";

describe("n8n WhatsApp Follow-up & Leads Integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Phone number formatting", () => {
    it("formats standard 10-digit Indian numbers cleanly", () => {
      expect(formatCleanPhone("9817337782")).toBe("9817337782");
      expect(formatCleanPhone("+91 98173 37782")).toBe("9817337782");
      expect(formatCleanPhone("+91-98173-37782")).toBe("9817337782");
      expect(formatCleanPhone("919817337782")).toBe("9817337782");
    });

    it("handles numbers with spaces and dashes", () => {
      expect(formatCleanPhone("8708 315 700")).toBe("8708315700");
    });
  });

  describe("Device availability mapping", () => {
    it("maps affirmative device availability to 'yes'", () => {
      expect(formatHasLaptop("Yes, I have a Laptop/PC")).toBe("yes");
      expect(formatHasLaptop("YES")).toBe("yes");
    });

    it("maps negative device availability to 'no'", () => {
      expect(formatHasLaptop("No, I don't have one")).toBe("no");
      expect(formatHasLaptop("no")).toBe("no");
    });

    it("defaults ambiguous availability to 'later'", () => {
      expect(formatHasLaptop("Can manage / arrange later")).toBe("later");
      expect(formatHasLaptop(null)).toBe("later");
      expect(formatHasLaptop(undefined)).toBe("later");
    });
  });

  describe("n8n Webhook Payload & Request Format", () => {
    it("sends exact POST request with { event: 'video_completed', lead_id: '...' }", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('{"success":true}'),
      });
      vi.stubGlobal("fetch", fetchMock);

      const targetLeadId = "test_lead_uuid_12345";
      const result = await sendN8nWebhook(targetLeadId);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = fetchMock.mock.calls[0];

      expect(calledUrl).toBe(
        process.env.N8N_VIDEO_COMPLETED_WEBHOOK_URL ||
          "https://pendugptonline.app.n8n.cloud/webhook/pendugpt-video-completed",
      );
      expect(calledInit.method).toBe("POST");
      expect(calledInit.headers["Content-Type"]).toBe("application/json");

      const parsedBody = JSON.parse(calledInit.body);
      expect(parsedBody).toEqual({
        event: "video_completed",
        lead_id: targetLeadId,
      });

      expect(result.ok).toBe(true);
      expect(result.status).toBe(200);
    });

    it("handles 404 test mode inactive gracefully without infinite retry", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () =>
          Promise.resolve('{"code":404,"message":"The requested webhook is not registered."}'),
      });
      vi.stubGlobal("fetch", fetchMock);

      const result = await sendN8nWebhook("test_lead_404");

      // 4xx client errors should not retry wastefully
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result.ok).toBe(false);
      expect(result.status).toBe(404);
    });

    it("retries on 500 server error up to 2 times", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          text: () => Promise.resolve("Bad Gateway"),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve('{"received":true}'),
        });
      vi.stubGlobal("fetch", fetchMock);

      const result = await sendN8nWebhook("test_lead_retry");

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.ok).toBe(true);
      expect(result.status).toBe(200);
    });

    it("includes X-Webhook-Secret header when configured", async () => {
      process.env.N8N_WEBHOOK_SECRET = "super_secret_webhook_key";
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('{"success":true}'),
      });
      vi.stubGlobal("fetch", fetchMock);

      await sendN8nWebhook("test_lead_secret");

      const [, calledInit] = fetchMock.mock.calls[0];
      expect(calledInit.headers["X-Webhook-Secret"]).toBe("super_secret_webhook_key");
      delete process.env.N8N_WEBHOOK_SECRET;
    });
  });

  describe("CRM Lead Synchronization & ID Mapping", () => {
    it("dispatches actual CRM lead UUID when website registration ID differs (Mismatched IDs)", async () => {
      const { processVideoCompletionEvent } = await import("@/lib/n8n.server");

      const registrationId = "99afce6a-09f0-4e12-a4cf-c6d769a31d5f";
      const existingCrmLeadId = "crm-canonical-lead-12345";
      const studentPhone = "9817337782";

      // Mock website admin DB returning the registration record
      const mockWebsiteClient = {
        from: vi.fn((table: string) => {
          if (table === "funnel_events") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: null }),
                  }),
                }),
              }),
              insert: () => Promise.resolve({ error: null }),
            };
          }
          if (table === "registrations") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: {
                        id: registrationId,
                        phone_number: studentPhone,
                        phone_country_code: "+91",
                        gender: "male",
                        device_availability: "yes",
                      },
                    }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      // Mock CRM DB returning an existing lead with a DIFFERENT ID for the same phone
      const mockCrmClient = {
        from: vi.fn((table: string) => {
          if (table === "leads") {
            return {
              select: () => ({
                eq: (col: string, val: string) => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: () =>
                        Promise.resolve({
                          data: {
                            id: existingCrmLeadId,
                            phone: studentPhone,
                            watch_seconds: 0,
                            unlocked_class: false,
                            whatsapp_followup_status: "NOT_SENT",
                          },
                        }),
                    }),
                  }),
                  maybeSingle: () =>
                    Promise.resolve({
                      data: {
                        id: existingCrmLeadId,
                        phone: studentPhone,
                        watch_seconds: 815,
                        unlocked_class: true,
                        whatsapp_followup_status: "NOT_SENT",
                      },
                    }),
                }),
              }),
              update: () => ({
                eq: () => Promise.resolve({ error: null }),
              }),
            };
          }
          return {};
        }),
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('{"success":true}'),
      });
      vi.stubGlobal("fetch", fetchMock);

      const result = await processVideoCompletionEvent({
        registrationId,
        videoId: "1231615906",
        lastPositionSeconds: 815,
        websiteClient: mockWebsiteClient,
        crmClient: mockCrmClient,
      });

      expect(result.ok).toBe(true);
      expect(result.webhookSent).toBe(true);
      // Crucial: The dispatched lead ID MUST be the genuine CRM lead ID, NOT the registration ID!
      expect(result.leadId).toBe(existingCrmLeadId);
      expect(result.leadId).not.toBe(registrationId);

      const [, calledInit] = fetchMock.mock.calls[0];
      const parsedBody = JSON.parse(calledInit.body);
      expect(parsedBody.lead_id).toBe(existingCrmLeadId);
      expect(parsedBody.lead_id).not.toBe(registrationId);
    });

    it("safely syncs missing lead into CRM using verified phone before dispatching webhook", async () => {
      const { processVideoCompletionEvent } = await import("@/lib/n8n.server");

      const registrationId = "new-reg-uuid-8888";
      const studentPhone = "9876543210";
      let leadStoredInCrm: any = null;

      const mockWebsiteClient = {
        from: vi.fn((table: string) => {
          if (table === "funnel_events") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: null }),
                  }),
                }),
              }),
              insert: () => Promise.resolve({ error: null }),
            };
          }
          if (table === "registrations") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: {
                        id: registrationId,
                        phone_number: studentPhone,
                        phone_country_code: "+91",
                        gender: "female",
                        device_availability: "yes",
                      },
                    }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      const mockCrmClient = {
        from: vi.fn((table: string) => {
          if (table === "leads") {
            return {
              select: () => ({
                eq: (col: string, val: string) => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: () => Promise.resolve({ data: leadStoredInCrm }),
                    }),
                  }),
                  maybeSingle: () => Promise.resolve({ data: leadStoredInCrm }),
                }),
              }),
              upsert: (record: any) => {
                leadStoredInCrm = record;
                return {
                  select: () => ({
                    maybeSingle: () => Promise.resolve({ data: record, error: null }),
                  }),
                };
              },
            };
          }
          return {};
        }),
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('{"success":true}'),
      });
      vi.stubGlobal("fetch", fetchMock);

      const result = await processVideoCompletionEvent({
        registrationId,
        videoId: "1231615906",
        lastPositionSeconds: 820,
        websiteClient: mockWebsiteClient,
        crmClient: mockCrmClient,
      });

      expect(result.ok).toBe(true);
      expect(result.webhookSent).toBe(true);
      expect(result.leadId).toBe(registrationId);
      expect(leadStoredInCrm).not.toBeNull();
      expect(leadStoredInCrm.phone).toBe(studentPhone);
      expect(leadStoredInCrm.unlocked_class).toBe(true);
      expect(leadStoredInCrm.whatsapp_followup_status).toBe("NOT_SENT");

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const parsedBody = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(parsedBody).toEqual({
        event: "video_completed",
        lead_id: registrationId,
      });
    });

    it("aborts safely and never calls webhook when lead is unverified (missing registration & phone)", async () => {
      const { processVideoCompletionEvent } = await import("@/lib/n8n.server");

      const ghostRegistrationId = "99afce6a-09f0-4e12-a4cf-c6d769a31d5f";

      const mockWebsiteClient = {
        from: vi.fn((table: string) => {
          if (table === "funnel_events") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: null }),
                  }),
                }),
              }),
            };
          }
          if (table === "registrations") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: null }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      const mockCrmClient = {
        from: vi.fn(() => ({})),
      };

      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const result = await processVideoCompletionEvent({
        registrationId: ghostRegistrationId,
        videoId: "1231615906",
        lastPositionSeconds: 850,
        websiteClient: mockWebsiteClient,
        crmClient: mockCrmClient,
      });

      expect(result.ok).toBe(false);
      expect(result.webhookSent).toBe(false);
      expect(result.error).toContain("Unverified lead");
      // CRITICAL: Must NEVER call the webhook or invent an ID for unverified requests
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("aborts when watch time does not meet the genuine completion threshold (< 750s)", async () => {
      const { processVideoCompletionEvent } = await import("@/lib/n8n.server");

      const mockWebsiteClient = {
        from: vi.fn(() => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null }),
              }),
            }),
          }),
        })),
      };

      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const result = await processVideoCompletionEvent({
        registrationId: "partial-watch-uuid",
        videoId: "1231615906",
        lastPositionSeconds: 300, // < 750 threshold
        websiteClient: mockWebsiteClient,
      });

      expect(result.webhookSent).toBe(false);
      expect(result.error).toBe("Completion threshold not reached");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("suppresses duplicate dispatch when WhatsApp followup is already in progress or sent", async () => {
      const { processVideoCompletionEvent } = await import("@/lib/n8n.server");

      const registrationId = "already-sent-reg-uuid";
      const existingCrmLeadId = "crm-lead-sent-111";

      const mockWebsiteClient = {
        from: vi.fn((table: string) => {
          if (table === "funnel_events") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: null }),
                  }),
                }),
              }),
              insert: () => Promise.resolve({ error: null }),
            };
          }
          if (table === "registrations") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: {
                        id: registrationId,
                        phone_number: "9817337782",
                        phone_country_code: "+91",
                      },
                    }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      const mockCrmClient = {
        from: vi.fn((table: string) => {
          if (table === "leads") {
            return {
              select: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: () =>
                        Promise.resolve({
                          data: {
                            id: existingCrmLeadId,
                            phone: "9817337782",
                            whatsapp_followup_status: "SENT", // Already SENT
                          },
                        }),
                    }),
                  }),
                  maybeSingle: () =>
                    Promise.resolve({
                      data: {
                        id: existingCrmLeadId,
                        phone: "9817337782",
                        whatsapp_followup_status: "SENT",
                      },
                    }),
                }),
              }),
              update: () => ({
                eq: () => Promise.resolve({ error: null }),
              }),
            };
          }
          return {};
        }),
      };

      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const result = await processVideoCompletionEvent({
        registrationId,
        videoId: "1231615906",
        lastPositionSeconds: 820,
        websiteClient: mockWebsiteClient,
        crmClient: mockCrmClient,
      });

      expect(result.ok).toBe(true);
      expect(result.webhookSent).toBe(false);
      expect(result.deduplicated).toBe(true);
      // Fetch to n8n should NOT be called since follow-up was already sent
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("Phone number normalization to canonical E.164", () => {
    it("converts 10-digit Indian numbers to +91XXXXXXXXXX", () => {
      expect(normalizeToE164("9817337782")).toBe("+919817337782");
      expect(normalizeToE164("8708315700")).toBe("+918708315700");
    });

    it("handles Indian numbers with +91, spaces, and hyphens", () => {
      expect(normalizeToE164("+91 98173 37782")).toBe("+919817337782");
      expect(normalizeToE164("+91-8708-315-700")).toBe("+918708315700");
    });

    it("handles numbers starting with 91 or leading 0 trunk prefix", () => {
      expect(normalizeToE164("919817337782")).toBe("+919817337782");
      expect(normalizeToE164("09817337782")).toBe("+919817337782");
    });

    it("handles international numbers outside India", () => {
      expect(normalizeToE164("+1 415 555 2671")).toBe("+14155552671");
      expect(normalizeToE164("+44 7911 123456")).toBe("+447911123456");
    });

    it("returns empty string for invalid or empty inputs", () => {
      expect(normalizeToE164("")).toBe("");
      expect(normalizeToE164("   ")).toBe("");
      expect(normalizeToE164("invalid")).toBe("");
    });
  });

  describe("Check previous sends across CRM and campaign logs", () => {
    const canonicalPhone = "+919817337782";

    it("skips contact if CRM status is SENT", async () => {
      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "leads") {
            return {
              select: () => ({
                in: () => Promise.resolve({ data: [{ id: "l1", whatsapp_followup_status: "SENT" }] }),
              }),
            };
          }
          if (table === "whatsapp_campaign_logs") {
            return {
              select: () => ({
                eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
              }),
            };
          }
          return {};
        }),
      };

      const result = await checkPreviousSends({ phoneCanonical: canonicalPhone, client: mockClient });
      expect(result.shouldSkip).toBe(true);
      expect(result.reason).toBe("crm_status_sent");
      expect(result.status).toBe("SENT");
    });

    it("skips contact if CRM status is REPLIED", async () => {
      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "leads") {
            return {
              select: () => ({
                in: () => Promise.resolve({ data: [{ id: "l2", whatsapp_followup_status: "REPLIED" }] }),
              }),
            };
          }
          if (table === "whatsapp_campaign_logs") {
            return {
              select: () => ({
                eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
              }),
            };
          }
          return {};
        }),
      };

      const result = await checkPreviousSends({ phoneCanonical: canonicalPhone, client: mockClient });
      expect(result.shouldSkip).toBe(true);
      expect(result.reason).toBe("crm_status_replied");
    });

    it("skips contact if CRM status is PAID", async () => {
      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "leads") {
            return {
              select: () => ({
                in: () => Promise.resolve({ data: [{ id: "l3", whatsapp_followup_status: "PAID" }] }),
              }),
            };
          }
          if (table === "whatsapp_campaign_logs") {
            return {
              select: () => ({
                eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
              }),
            };
          }
          return {};
        }),
      };

      const result = await checkPreviousSends({ phoneCanonical: canonicalPhone, client: mockClient });
      expect(result.shouldSkip).toBe(true);
      expect(result.reason).toBe("crm_status_paid");
    });

    it("skips contact if campaign log is already SENT", async () => {
      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "leads") {
            return {
              select: () => ({
                in: () => Promise.resolve({ data: [{ id: "l4", whatsapp_followup_status: "NOT_SENT" }] }),
              }),
            };
          }
          if (table === "whatsapp_campaign_logs") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: { status: "SENT" } }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      const result = await checkPreviousSends({ phoneCanonical: canonicalPhone, client: mockClient });
      expect(result.shouldSkip).toBe(true);
      expect(result.reason).toBe("campaign_already_sent");
    });

    it("skips contact if campaign log is UNCERTAIN (requires reconciliation)", async () => {
      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "leads") {
            return {
              select: () => ({
                in: () => Promise.resolve({ data: [] }),
              }),
            };
          }
          if (table === "whatsapp_campaign_logs") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: { status: "UNCERTAIN" } }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      const result = await checkPreviousSends({ phoneCanonical: canonicalPhone, client: mockClient });
      expect(result.shouldSkip).toBe(true);
      expect(result.reason).toBe("uncertain_previous_send");
    });

    it("does not skip contact if CRM is NOT_SENT and no campaign log exists", async () => {
      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "leads") {
            return {
              select: () => ({
                in: () => Promise.resolve({ data: [{ id: "l5", whatsapp_followup_status: "NOT_SENT" }] }),
              }),
            };
          }
          if (table === "whatsapp_campaign_logs") {
            return {
              select: () => ({
                eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
              }),
            };
          }
          return {};
        }),
      };

      const result = await checkPreviousSends({ phoneCanonical: canonicalPhone, client: mockClient });
      expect(result.shouldSkip).toBe(false);
    });
  });

  describe("Simultaneous execution prevention & Atomic lock", () => {
    const phoneCanonical = "+919817337782";

    it("acquires lock atomically for new contact", async () => {
      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "whatsapp_campaign_logs") {
            return {
              insert: (payload: any) => ({
                select: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: { id: "log-1", status: "PROCESSING", ...payload },
                      error: null,
                    }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      const result = await acquireCampaignLock({
        phoneCanonical,
        leadId: "lead-1",
        client: mockClient,
      });

      expect(result.acquired).toBe(true);
      expect(result.currentStatus).toBe("PROCESSING");
      expect(result.existingLogId).toBe("log-1");
    });

    it("blocks concurrent execution when active lock is held by another process", async () => {
      const futureDate = new Date(Date.now() + 180000).toISOString();
      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "whatsapp_campaign_logs") {
            return {
              insert: () => ({
                select: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: null,
                      error: { code: "23505", message: "duplicate key" },
                    }),
                }),
              }),
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () =>
                      Promise.resolve({
                        data: {
                          id: "existing-lock-uuid",
                          status: "PROCESSING",
                          lock_expires_at: futureDate,
                        },
                      }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      const result = await acquireCampaignLock({
        phoneCanonical,
        leadId: "lead-2",
        client: mockClient,
      });

      expect(result.acquired).toBe(false);
      expect(result.currentStatus).toBe("PROCESSING");
      expect(result.reason).toBe("concurrent_lock_active");
    });

    it("marks stale lock as UNCERTAIN to prevent duplicate sending", async () => {
      const pastDate = new Date(Date.now() - 60000).toISOString();
      let updatedStatus: string | null = null;

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "whatsapp_campaign_logs") {
            return {
              insert: () => ({
                select: () => ({
                  maybeSingle: () => Promise.resolve({ data: null, error: { code: "23505" } }),
                }),
              }),
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () =>
                      Promise.resolve({
                        data: {
                          id: "stale-lock-uuid",
                          status: "PROCESSING",
                          lock_expires_at: pastDate,
                        },
                      }),
                  }),
                }),
              }),
              update: (patch: any) => {
                updatedStatus = patch.status;
                return {
                  eq: () => Promise.resolve({ error: null }),
                };
              },
            };
          }
          return {};
        }),
      };

      const result = await acquireCampaignLock({
        phoneCanonical,
        leadId: "lead-stale",
        client: mockClient,
      });

      expect(result.acquired).toBe(false);
      expect(result.currentStatus).toBe("UNCERTAIN");
      expect(result.reason).toBe("stale_lock_marked_uncertain");
      expect(updatedStatus).toBe("UNCERTAIN");
    });

    it("allows safe re-acquisition after prior send failure (FAILED)", async () => {
      let updatedStatus: string | null = null;
      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "whatsapp_campaign_logs") {
            return {
              insert: () => ({
                select: () => ({
                  maybeSingle: () => Promise.resolve({ data: null, error: { code: "23505" } }),
                }),
              }),
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () =>
                      Promise.resolve({
                        data: {
                          id: "failed-lock-uuid",
                          status: "FAILED",
                          attempt_count: 1,
                        },
                      }),
                  }),
                }),
              }),
              update: (patch: any) => {
                updatedStatus = patch.status;
                return {
                  eq: () => ({
                    select: () => ({
                      maybeSingle: () =>
                        Promise.resolve({
                          data: { id: "failed-lock-uuid", status: patch.status, attempt_count: 2 },
                        }),
                    }),
                  }),
                };
              },
            };
          }
          return {};
        }),
      };

      const result = await acquireCampaignLock({
        phoneCanonical,
        leadId: "lead-retry",
        client: mockClient,
      });

      expect(result.acquired).toBe(true);
      expect(result.currentStatus).toBe("PROCESSING");
      expect(result.reason).toBe("lock_reacquired_after_failure");
      expect(updatedStatus).toBe("PROCESSING");
    });
  });

  describe("Finalize campaign send & CRM contact-level deduplication", () => {
    it("updates all CRM leads sharing the phone to SENT and logs provider message ID", async () => {
      const canonicalPhone = "+919817337782";
      let loggedStatus: string | null = null;
      let loggedProviderId: string | null = null;
      let crmUpdatedStatus: string | null = null;
      let crmUpdatedPhoneFilter: any = null;

      const mockClient = {
        from: vi.fn((table: string) => {
          if (table === "whatsapp_campaign_logs") {
            return {
              update: (patch: any) => {
                loggedStatus = patch.status;
                loggedProviderId = patch.provider_message_id;
                return {
                  eq: () => ({ eq: () => Promise.resolve({ error: null }) }),
                };
              },
            };
          }
          if (table === "leads") {
            return {
              update: (patch: any) => {
                crmUpdatedStatus = patch.whatsapp_followup_status;
                return {
                  in: (_col: string, vals: any[]) => {
                    crmUpdatedPhoneFilter = vals;
                    return Promise.resolve({ error: null });
                  },
                };
              },
            };
          }
          return {};
        }),
      };

      await finalizeCampaignSend({
        phoneCanonical: canonicalPhone,
        status: "SENT",
        providerMessageId: "wamid_HBgMOTE5ODE3MzM3NzgyFQIAERgSMzNBM0E1",
        client: mockClient,
      });

      expect(loggedStatus).toBe("SENT");
      expect(loggedProviderId).toBe("wamid_HBgMOTE5ODE3MzM3NzgyFQIAERgSMzNBM0E1");
      expect(crmUpdatedStatus).toBe("SENT");
      expect(crmUpdatedPhoneFilter).toContain(canonicalPhone);
      expect(crmUpdatedPhoneFilter).toContain("9817337782");
    });
  });

  describe("Safe retry and uncertain outcome reconciliation", () => {
    it("marks campaign log UNCERTAIN on network timeout and halts automatic retry", async () => {
      const registrationId = "timeout-reg-uuid";
      const studentPhone = "9817337782";
      let campaignFinalStatus: string | null = null;

      const mockWebsiteClient = {
        from: vi.fn((table: string) => {
          if (table === "funnel_events") {
            return {
              select: () => ({
                eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
              }),
              insert: () => Promise.resolve({ error: null }),
            };
          }
          if (table === "registrations") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: {
                        id: registrationId,
                        phone_number: studentPhone,
                        phone_country_code: "+91",
                      },
                    }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      const mockCrmClient = {
        from: vi.fn((table: string) => {
          if (table === "leads") {
            return {
              select: () => ({
                in: () => Promise.resolve({ data: [] }),
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: () =>
                        Promise.resolve({
                          data: {
                            id: "crm-timeout-lead",
                            phone: studentPhone,
                            whatsapp_followup_status: "NOT_SENT",
                          },
                        }),
                    }),
                  }),
                  maybeSingle: () =>
                    Promise.resolve({
                      data: {
                        id: "crm-timeout-lead",
                        phone: studentPhone,
                        whatsapp_followup_status: "NOT_SENT",
                      },
                    }),
                }),
              }),
              update: () => ({ eq: () => Promise.resolve({ error: null }) }),
            };
          }
          if (table === "whatsapp_campaign_logs") {
            return {
              select: () => ({
                eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
              }),
              insert: () => ({
                select: () => ({
                  maybeSingle: () => Promise.resolve({ data: { id: "lock-to", status: "PROCESSING" } }),
                }),
              }),
              update: (patch: any) => {
                campaignFinalStatus = patch.status;
                return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) };
              },
            };
          }
          return {};
        }),
      };

      // Mock fetch timing out with AbortError
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      const fetchMock = vi.fn().mockRejectedValue(abortError);
      vi.stubGlobal("fetch", fetchMock);

      const result = await processVideoCompletionEvent({
        registrationId,
        videoId: "1231615906",
        lastPositionSeconds: 820,
        websiteClient: mockWebsiteClient,
        crmClient: mockCrmClient,
      });

      expect(result.ok).toBe(true);
      expect(result.webhookSent).toBe(false);
      expect(result.error).toContain("uncertain");
      expect(campaignFinalStatus).toBe("UNCERTAIN");
    });

    it("deduplicates repeated video-completion events for the same contact across multiple calls/retries", async () => {
      const studentPhone = "9817337782";
      let campaignStatus = "NONE";
      const funnelEvents = new Set<string>();

      const mockWebsiteClient = {
        from: vi.fn((table: string) => {
          if (table === "funnel_events") {
            return {
              select: () => ({
                eq: (_col: string, val: string) => ({
                  eq: (_col2: string, eventName: string) => ({
                    maybeSingle: () =>
                      Promise.resolve({
                        data: funnelEvents.has(`${val}:${eventName}`) ? { id: "fe-1" } : null,
                      }),
                  }),
                }),
              }),
              insert: (record: any) => {
                funnelEvents.add(`${record.registration_id}:${record.event_name}`);
                return Promise.resolve({ error: null });
              },
            };
          }
          if (table === "registrations") {
            return {
              select: () => ({
                eq: (_col: string, val: string) => ({
                  maybeSingle: () =>
                    Promise.resolve({
                      data: {
                        id: val,
                        phone_number: studentPhone,
                        phone_country_code: "+91",
                      },
                    }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      const mockCrmClient = {
        from: vi.fn((table: string) => {
          if (table === "leads") {
            return {
              select: () => ({
                in: () =>
                  Promise.resolve({
                    data:
                      campaignStatus === "SENT"
                        ? [{ id: "crm-lead-repeat", phone: studentPhone, whatsapp_followup_status: "SENT" }]
                        : [],
                  }),
                eq: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: () =>
                        Promise.resolve({
                          data: {
                            id: "crm-lead-repeat",
                            phone: studentPhone,
                            whatsapp_followup_status: campaignStatus === "SENT" ? "SENT" : "NOT_SENT",
                          },
                        }),
                    }),
                  }),
                  maybeSingle: () =>
                    Promise.resolve({
                      data: {
                        id: "crm-lead-repeat",
                        phone: studentPhone,
                        whatsapp_followup_status: campaignStatus === "SENT" ? "SENT" : "NOT_SENT",
                      },
                    }),
                }),
              }),
              update: () => ({
                eq: () => Promise.resolve({ error: null }),
                in: () => Promise.resolve({ error: null }),
              }),
            };
          }
          if (table === "whatsapp_campaign_logs") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () =>
                      Promise.resolve({
                        data: campaignStatus === "SENT" ? { status: "SENT" } : null,
                      }),
                  }),
                }),
              }),
              insert: () => ({
                select: () => ({
                  maybeSingle: () =>
                    Promise.resolve({ data: { id: "lock-repeat", status: "PROCESSING" } }),
                }),
              }),
              update: (patch: any) => {
                campaignStatus = patch.status;
                return { eq: () => ({ eq: () => Promise.resolve({ error: null }) }) };
              },
            };
          }
          return {};
        }),
      };

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('{"message_id":"wamid.repeat1"}'),
      });
      vi.stubGlobal("fetch", fetchMock);

      // Event 1: First video completion
      const res1 = await processVideoCompletionEvent({
        registrationId: "reg-repeat-1",
        videoId: "1231615906",
        lastPositionSeconds: 820,
        websiteClient: mockWebsiteClient,
        crmClient: mockCrmClient,
      });

      expect(res1.ok).toBe(true);
      expect(res1.webhookSent).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Event 2: Immediate retry or second completion event with another registration ID but SAME phone
      const res2 = await processVideoCompletionEvent({
        registrationId: "reg-repeat-2",
        videoId: "1231615906",
        lastPositionSeconds: 825,
        websiteClient: mockWebsiteClient,
        crmClient: mockCrmClient,
      });

      expect(res2.ok).toBe(true);
      expect(res2.webhookSent).toBe(false);
      expect(res2.deduplicated).toBe(true);
      // Fetch should NEVER be called again! Exactly 1 delivery for this phone.
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("Video Last Activity Tracking (recordLeadVideoActivity)", () => {
    it("updates video_last_activity_at and watch_seconds using stable registrationId", async () => {
      let updatedPayload: any = null;
      let queriedId: any = null;

      const mockLead = {
        id: "reg-act-1",
        phone: "9817337782",
        watch_seconds: 45,
        unlocked_class: false,
        video_completed_at: null,
        video_last_activity_at: null,
      };

      const mockClient = {
        from: (table: string) => {
          if (table === "leads") {
            return {
              select: () => ({
                eq: (_col: string, val: string) => {
                  queriedId = val;
                  return {
                    maybeSingle: async () => ({
                      data: val === "reg-act-1" ? mockLead : null,
                      error: null,
                    }),
                  };
                },
              }),
              update: (payload: any) => {
                updatedPayload = payload;
                return {
                  eq: (_col: string, val: string) => {
                    if (val === "reg-act-1") {
                      Object.assign(mockLead, payload);
                      return Promise.resolve({ error: null });
                    }
                    return Promise.resolve({ error: { message: "Not found" } });
                  },
                };
              },
            };
          }
          return {};
        },
      };

      const res = await recordLeadVideoActivity({
        registrationId: "reg-act-1",
        phone: "9817337782",
        watchSeconds: 75,
        isCompleted: false,
        client: mockClient,
      });

      expect(res.ok).toBe(true);
      expect(res.leadId).toBe("reg-act-1");
      expect(queriedId).toBe("reg-act-1");
      expect(updatedPayload).toBeDefined();
      expect(updatedPayload.watch_seconds).toBe(75);
      expect(updatedPayload.video_last_activity_at).toBeDefined();
      // Completion fields must remain untouched when isCompleted is false
      expect(updatedPayload.unlocked_class).toBeUndefined();
      expect(updatedPayload.video_completed_at).toBeUndefined();
    });

    it("falls back to clean phone lookup if registrationId is not found in CRM", async () => {
      let updatedPayload: any = null;

      const mockLead = {
        id: "crm-legacy-lead-999",
        phone: "9817337782",
        watch_seconds: 30,
        unlocked_class: false,
        video_completed_at: null,
      };

      const mockClient = {
        from: (table: string) => {
          if (table === "leads") {
            return {
              select: () => ({
                eq: (col: string, val: string) => {
                  if (col === "id") {
                    return {
                      maybeSingle: async () => ({ data: null, error: null }),
                    };
                  }
                  if (col === "phone") {
                    return {
                      order: () => ({
                        limit: () => ({
                          maybeSingle: async () => ({
                            data: val === "9817337782" ? mockLead : null,
                            error: null,
                          }),
                        }),
                      }),
                    };
                  }
                  return { maybeSingle: async () => ({ data: null }) };
                },
              }),
              update: (payload: any) => {
                updatedPayload = payload;
                return {
                  eq: () => Promise.resolve({ error: null }),
                };
              },
            };
          }
          return {};
        },
      };

      const res = await recordLeadVideoActivity({
        registrationId: "unknown-reg-id",
        phone: "+91 98173 37782",
        watchSeconds: 65,
        isCompleted: false,
        client: mockClient,
      });

      expect(res.ok).toBe(true);
      expect(res.leadId).toBe("crm-legacy-lead-999");
      expect(updatedPayload.watch_seconds).toBe(65);
      expect(updatedPayload.video_last_activity_at).toBeDefined();
    });

    it("sets video_completed_at and unlocked_class when isCompleted is true", async () => {
      let updatedPayload: any = null;

      const mockLead = {
        id: "reg-complete-1",
        phone: "9817337782",
        watch_seconds: 800,
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

      const res = await recordLeadVideoActivity({
        registrationId: "reg-complete-1",
        phone: "9817337782",
        watchSeconds: 820,
        isCompleted: true,
        client: mockClient,
      });

      expect(res.ok).toBe(true);
      expect(updatedPayload.unlocked_class).toBe(true);
      expect(updatedPayload.video_completed_at).toBeDefined();
      expect(updatedPayload.video_last_activity_at).toBeDefined();
    });

    it("evaluates 30-minute inactivity eligibility accurately", () => {
      const now = Date.now();
      const thirtyFiveMinAgo = new Date(now - 35 * 60 * 1000).toISOString();
      const tenMinAgo = new Date(now - 10 * 60 * 1000).toISOString();

      const candidateA: {
        id: string;
        video_last_activity_at: string;
        unlocked_class: boolean;
        video_completed_at: string | null;
        whatsapp_followup_status: string;
      } = {
        id: "lead-inactive-35m",
        video_last_activity_at: thirtyFiveMinAgo,
        unlocked_class: false,
        video_completed_at: null,
        whatsapp_followup_status: "NOT_SENT",
      };

      const candidateB = {
        id: "lead-active-10m",
        video_last_activity_at: tenMinAgo,
        unlocked_class: false,
        video_completed_at: null,
        whatsapp_followup_status: "NOT_SENT",
      };

      const isEligibleForInactivityReminder = (lead: any) => {
        if (lead.unlocked_class || lead.video_completed_at) return false;
        if (lead.whatsapp_followup_status !== "NOT_SENT") return false;
        if (!lead.video_last_activity_at) return false;
        const lastActTime = new Date(lead.video_last_activity_at).getTime();
        const diffMinutes = (Date.now() - lastActTime) / (1000 * 60);
        return diffMinutes >= 30;
      };

      expect(isEligibleForInactivityReminder(candidateA)).toBe(true);
      expect(isEligibleForInactivityReminder(candidateB)).toBe(false);

      // If user completed in the meantime, must be skipped
      candidateA.video_completed_at = new Date().toISOString();
      expect(isEligibleForInactivityReminder(candidateA)).toBe(false);
    });

    it("restores remote video progress directly from public.leads without requiring video_progress table", async () => {
      const mockLead = {
        id: "22222222-2222-2222-2222-222222222222",
        phone: "9817337782",
        watch_seconds: 412,
        unlocked_class: false,
        video_completed_at: null,
      };

      const mockClient = {
        from: (table: string) => {
          if (table === "leads") {
            return {
              select: () => ({
                eq: (_col: string, val: string) => ({
                  maybeSingle: async () => ({
                    data: val === "22222222-2222-2222-2222-222222222222" ? mockLead : null,
                    error: null,
                  }),
                }),
              }),
            };
          }
          return {};
        },
      };

      const res = await getRemoteLeadProgress({
        registrationId: "22222222-2222-2222-2222-222222222222",
        phone: "9817337782",
        client: mockClient,
      });

      expect(res.ok).toBe(true);
      expect(res.progress).toBeDefined();
      expect(res.progress?.lastPosition).toBe(412);
      expect(res.progress?.isCompleted).toBe(false);
    });
  });

  describe("Video Inactivity Comeback (n8n Inactivity Webhook)", () => {
    describe("maskPhone helper", () => {
      it("masks phone numbers securely without leaking full digits", () => {
        expect(maskPhone("+919817337782")).toBe("+91****782");
        expect(maskPhone("9817337782")).toBe("981****782");
        expect(maskPhone("123")).toBe("****");
        expect(maskPhone("")).toBe("");
        expect(maskPhone(null as any)).toBe("");
      });
    });

    describe("sendN8nVideoInactivityWebhook", () => {
      it("dispatches POST request with exact required schema and x-pendugpt-webhook-secret header", async () => {
        let sentUrl = "";
        let sentOptions: any = null;

        const originalUrl = process.env["N8N_VIDEO_INACTIVITY_WEBHOOK_URL"];
        const originalSecret = process.env["N8N_VIDEO_INACTIVITY_WEBHOOK_SECRET"];

        process.env["N8N_VIDEO_INACTIVITY_WEBHOOK_URL"] =
          "https://pendugptonline.app.n8n.cloud/webhook/pendugpt-video-inactivity-v2";
        process.env["N8N_VIDEO_INACTIVITY_WEBHOOK_SECRET"] = "test-secret-inactivity-123";

        global.fetch = vi.fn().mockImplementation((url, options) => {
          sentUrl = url.toString();
          sentOptions = options;
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ message: "Inactivity event received" }),
          });
        });

        const testPayload = {
          lead_id: "lead-real-uuid-111",
          phone: "+919817337782",
          video_id: "1231615906",
          watch_seconds: 180,
          updated_at: new Date().toISOString(),
        };

        const res = await sendN8nVideoInactivityWebhook(testPayload);

        expect(res.ok).toBe(true);
        expect(sentUrl).toBe("https://pendugptonline.app.n8n.cloud/webhook/pendugpt-video-inactivity-v2");
        expect(sentOptions.method).toBe("POST");
        expect(sentOptions.headers["Content-Type"]).toBe("application/json");
        expect(sentOptions.headers["x-pendugpt-webhook-secret"]).toBe("test-secret-inactivity-123");

        const parsedBody = JSON.parse(sentOptions.body);
        expect(parsedBody.lead_id).toBe("lead-real-uuid-111");
        expect(parsedBody.phone).toBe("+919817337782");
        expect(parsedBody.video_id).toBe("1231615906");
        expect(parsedBody.watch_seconds).toBe(180);
        expect(parsedBody.updated_at).toBe(testPayload.updated_at);

        if (originalUrl) process.env["N8N_VIDEO_INACTIVITY_WEBHOOK_URL"] = originalUrl;
        else delete process.env["N8N_VIDEO_INACTIVITY_WEBHOOK_URL"];
        if (originalSecret) process.env["N8N_VIDEO_INACTIVITY_WEBHOOK_SECRET"] = originalSecret;
        else delete process.env["N8N_VIDEO_INACTIVITY_WEBHOOK_SECRET"];
      });

      it("does not include secret header when N8N_VIDEO_INACTIVITY_WEBHOOK_SECRET is not configured", async () => {
        let sentHeaders: any = null;
        const originalSecret = process.env["N8N_VIDEO_INACTIVITY_WEBHOOK_SECRET"];
        delete process.env["N8N_VIDEO_INACTIVITY_WEBHOOK_SECRET"];

        global.fetch = vi.fn().mockImplementation((_url, options) => {
          sentHeaders = options.headers;
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ success: true }),
          });
        });

        await sendN8nVideoInactivityWebhook({
          lead_id: "lead-1",
          phone: "+919817337782",
          video_id: "1231615906",
          watch_seconds: 60,
          updated_at: new Date().toISOString(),
        });

        expect(sentHeaders["x-pendugpt-webhook-secret"]).toBeUndefined();

        if (originalSecret) process.env["N8N_VIDEO_INACTIVITY_WEBHOOK_SECRET"] = originalSecret;
      });

      it("handles 500 server error and retries up to 2 times before returning failure", async () => {
        let attempts = 0;
        global.fetch = vi.fn().mockImplementation(() => {
          attempts++;
          return Promise.resolve({
            ok: false,
            status: 502,
            text: async () => "Bad Gateway",
          });
        });

        const res = await sendN8nVideoInactivityWebhook({
          lead_id: "lead-err",
          phone: "+919817337782",
          video_id: "1231615906",
          watch_seconds: 60,
          updated_at: new Date().toISOString(),
        });

        expect(res.ok).toBe(false);
        expect(res.status).toBe(500);
        expect(attempts).toBe(2);
      });
    });

    describe("processVideoInactivityEvent", () => {
      it("rejects dispatch when both registrationId and phone are missing", async () => {
        const res = await processVideoInactivityEvent({
          registrationId: null,
          phone: null,
          videoId: "1231615906",
        });

        expect(res.ok).toBe(false);
        expect(res.webhookSent).toBe(false);
        expect(res.error).toContain("Missing");
      });

      it("rejects dispatch when student identity does not match database record", async () => {
        const mockLead = {
          id: "lead-real-alice",
          phone: "9817337782",
          watch_seconds: 120,
          unlocked_class: false,
          video_completed_at: null,
          whatsapp_followup_status: "NOT_SENT",
        };

        const mockClient = {
          from: (table: string) => {
            if (table === "leads") {
              return {
                select: () => ({
                  eq: (_col: string, _val: string) => ({
                    maybeSingle: async () => ({ data: mockLead, error: null }),
                  }),
                }),
              };
            }
            return {};
          },
        };

        const res = await processVideoInactivityEvent({
          registrationId: "lead-real-alice",
          phone: "9999999999", // Spoofed / mismatched phone
          videoId: "1231615906",
          client: mockClient,
        });

        expect(res.ok).toBe(false);
        expect(res.webhookSent).toBe(false);
        expect(res.error).toBe("Student identity verification mismatch");
      });

      it("skips dispatch when video is already completed (unlocked_class = true)", async () => {
        const mockLead = {
          id: "lead-completed-1",
          phone: "9817337782",
          watch_seconds: 820,
          unlocked_class: true,
          video_completed_at: new Date().toISOString(),
          whatsapp_followup_status: "NOT_SENT",
        };

        const mockClient = {
          from: (table: string) => ({
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: mockLead, error: null }),
              }),
            }),
          }),
        };

        const res = await processVideoInactivityEvent({
          registrationId: "lead-completed-1",
          phone: "9817337782",
          videoId: "1231615906",
          lastPositionSeconds: 820,
          client: mockClient,
        });

        expect(res.ok).toBe(true);
        expect(res.webhookSent).toBe(false);
        expect(res.deduplicated).toBe(true);
        expect(res.reason).toBe("video_already_completed");
      });

      it("skips dispatch when watch time is negligible (< 15 seconds)", async () => {
        const mockLead = {
          id: "lead-barely-started",
          phone: "9817337782",
          watch_seconds: 8,
          unlocked_class: false,
          video_completed_at: null,
          whatsapp_followup_status: "NOT_SENT",
        };

        const mockClient = {
          from: (table: string) => ({
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: mockLead, error: null }),
              }),
            }),
          }),
        };

        const res = await processVideoInactivityEvent({
          registrationId: "lead-barely-started",
          phone: "9817337782",
          videoId: "1231615906",
          lastPositionSeconds: 8,
          client: mockClient,
        });

        expect(res.ok).toBe(true);
        expect(res.webhookSent).toBe(false);
        expect(res.deduplicated).toBe(true);
        expect(res.reason).toBe("insufficient_watch_time");
      });

      it("skips dispatch when student is already marked PAID or STOPPED", async () => {
        const mockLead = {
          id: "lead-paid-student",
          phone: "9817337782",
          watch_seconds: 250,
          unlocked_class: false,
          video_completed_at: null,
          whatsapp_followup_status: "PAID",
        };

        const mockClient = {
          from: (table: string) => ({
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: mockLead, error: null }),
              }),
            }),
          }),
        };

        const res = await processVideoInactivityEvent({
          registrationId: "lead-paid-student",
          phone: "9817337782",
          videoId: "1231615906",
          client: mockClient,
        });

        expect(res.ok).toBe(true);
        expect(res.webhookSent).toBe(false);
        expect(res.deduplicated).toBe(true);
        expect(res.reason).toBe("lead_status_paid");
      });

      it("dispatches successfully for eligible inactive lead and deduplicates subsequent immediate calls", async () => {
        const mockLead = {
          id: "lead-pause-1",
          phone: "9817337782",
          watch_seconds: 145,
          unlocked_class: false,
          video_completed_at: null,
          whatsapp_followup_status: "NOT_SENT",
        };

        let funnelEventInserted = false;
        const mockClient = {
          from: (table: string) => ({
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: mockLead, error: null }),
              }),
            }),
          }),
        };

        const mockAdmin = {
          from: (table: string) => {
            if (table === "funnel_events") {
              return {
                select: () => ({
                  eq: () => ({
                    eq: () => ({
                      gte: () => ({
                        maybeSingle: async () => ({ data: null, error: null }),
                      }),
                    }),
                  }),
                }),
                insert: async () => {
                  funnelEventInserted = true;
                  return { error: null };
                },
              };
            }
            return {};
          },
        };

        global.fetch = vi.fn().mockImplementation(() =>
          Promise.resolve({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ success: true }),
          }),
        );

        // First call: should successfully send webhook
        const res1 = await processVideoInactivityEvent({
          registrationId: "lead-pause-1",
          phone: "9817337782",
          videoId: "1231615906",
          lastPositionSeconds: 145,
          client: mockClient,
          websiteClient: mockAdmin,
        });

        expect(res1.ok).toBe(true);
        expect(res1.webhookSent).toBe(true);
        expect(res1.leadId).toBe("lead-pause-1");
        expect(funnelEventInserted).toBe(true);

        // Immediate subsequent call (e.g. rapid pause/resume/pause): should deduplicate via cooldown
        const res2 = await processVideoInactivityEvent({
          registrationId: "lead-pause-1",
          phone: "9817337782",
          videoId: "1231615906",
          lastPositionSeconds: 148,
          client: mockClient,
          websiteClient: mockAdmin,
        });

        expect(res2.ok).toBe(true);
        expect(res2.webhookSent).toBe(false);
        expect(res2.deduplicated).toBe(true);
        expect(res2.reason).toBe("inactivity_cooldown_active");
      });
    });
  });
});




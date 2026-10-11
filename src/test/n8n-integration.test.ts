import { describe, it, expect, vi, beforeEach } from "vitest";
import { formatCleanPhone, formatHasLaptop, sendN8nWebhook } from "@/lib/n8n.server";

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
      expect(result.webhookSent).toBe(true);
      expect(result.deduplicated).toBe(true);
      // Fetch to n8n should NOT be called since follow-up was already sent
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});



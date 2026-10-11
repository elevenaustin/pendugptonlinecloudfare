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
});


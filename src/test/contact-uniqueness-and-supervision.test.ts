import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeCheckExistingContact } from "@/lib/leads.functions";
import { executeAdminSkipVideoWatch } from "@/lib/admin.functions";

// Mock Supabase admin and leads clients
vi.mock("@/integrations/supabase/client.server", () => {
  return {
    supabaseAdmin: {
      auth: {
        getUser: vi.fn(async (token: string) => {
          if (token === "valid-jwt-admin") {
            return {
              data: {
                user: { id: "admin-uuid", email: "admin@pendugpt.com", app_metadata: { role: "admin" } },
              },
              error: null,
            };
          }
          return { data: { user: null }, error: new Error("Invalid JWT token") };
        }),
      },
      from: vi.fn((table: string) => {
        if (table === "registrations") {
          return {
            select: vi.fn().mockReturnThis(),
            or: vi.fn((query: string) => {
              if (query.includes("9876543210")) {
                return {
                  order: vi.fn().mockReturnThis(),
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "reg-existing-uuid",
                        phone_country_code: "+91",
                        phone_number: "9876543210",
                        gender: "male",
                        device_availability: "yes",
                        video_progress: [
                          {
                            last_position_seconds: 320,
                            completion_status: false,
                          },
                        ],
                      },
                    ],
                  }),
                };
              }
              if (query.includes("9999999999")) {
                return {
                  order: vi.fn().mockReturnThis(),
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "reg-completed-uuid",
                        phone_country_code: "+91",
                        phone_number: "9999999999",
                        gender: "female",
                        device_availability: "laptop",
                        video_progress: [
                          {
                            last_position_seconds: 858,
                            completion_status: true,
                          },
                        ],
                      },
                    ],
                  }),
                };
              }
              // Not found
              return {
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue({ data: [] }),
              };
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: "new-reg-uuid" } }),
              }),
            }),
          };
        }
        if (table === "video_progress") {
          return {
            upsert: vi.fn().mockResolvedValue({ data: {}, error: null }),
          };
        }
        if (table === "funnel_events") {
          return {
            insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [] }),
        };
      }),
    },
  };
});

vi.mock("@/lib/n8n.server", () => {
  return {
    normalizeToE164: (phone: string, cc = "+91") => (phone.startsWith("+") ? phone : `${cc}${phone}`),
    formatCleanPhone: (phone: string) => phone.replace(/\D/g, "").slice(-10),
    getLeadsSupabaseClient: vi.fn(() => ({
      from: vi.fn((table: string) => {
        if (table === "leads") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn((field: string, values: string[]) => {
              if (values.includes("9876543210") || values.includes("+919876543210")) {
                return {
                  order: vi.fn().mockReturnThis(),
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "lead-existing-1",
                        phone: "9876543210",
                        watch_seconds: 320,
                        unlocked_class: false,
                        video_completed_at: null,
                      },
                    ],
                  }),
                };
              }
              if (values.includes("9999999999") || values.includes("+919999999999")) {
                return {
                  order: vi.fn().mockReturnThis(),
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "lead-completed-1",
                        phone: "9999999999",
                        watch_seconds: 858,
                        unlocked_class: true,
                        video_completed_at: new Date().toISOString(),
                      },
                    ],
                  }),
                };
              }
              return {
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue({ data: [] }),
              };
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
            }),
            insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
          };
        }
        return {};
      }),
    })),
  };
});

describe("Step 1 Unique Contact Verification & Session Resume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns exists: false when phone number has never registered", async () => {
    const res = await executeCheckExistingContact({
      countryCode: "+91",
      whatsapp: "9123456789",
    });

    expect(res).toBeDefined();
    expect(res.exists).toBe(false);
    expect(res.isCompleted).toBe(false);
    expect(res.lastPositionSeconds).toBe(0);
  });

  it("detects returning student with partial progress and returns lastPositionSeconds", async () => {
    const res = await executeCheckExistingContact({
      countryCode: "+91",
      whatsapp: "9876543210",
    });

    expect(res).toBeDefined();
    expect(res.exists).toBe(true);
    expect(res.registrationId).toBe("reg-existing-uuid");
    expect(res.lastPositionSeconds).toBe(320);
    expect(res.isCompleted).toBe(false);
    expect(res.message).toContain("Resuming your video training");
  });

  it("detects returning student with completed training and flags isCompleted: true", async () => {
    const res = await executeCheckExistingContact({
      countryCode: "+91",
      whatsapp: "9999999999",
    });

    expect(res).toBeDefined();
    expect(res.exists).toBe(true);
    expect(res.registrationId).toBe("reg-completed-uuid");
    expect(res.lastPositionSeconds).toBe(858);
    expect(res.isCompleted).toBe(true);
    expect(res.message).toContain("already completed the training video");
  });
});

describe("Admin Supervision Fast-Track & Skip Video Watch Tool", () => {
  it("rejects request if admin authentication token is missing or invalid", async () => {
    const res = await executeAdminSkipVideoWatch({
      authToken: "invalid-token",
      countryCode: "+91",
      phone: "9817337782",
    });

    expect(res.ok).toBe(false);
    expect(res.error).toBeDefined();
  });

  it("successfully marks video as 100% watched (858s) and unlocked for master admin", async () => {
    const res = await executeAdminSkipVideoWatch({
      authToken: "PenduGPT2026",
      countryCode: "+91",
      phone: "9817337782",
    });

    expect(res).toBeDefined();
    expect(res.ok).toBe(true);
    expect(res.watchSeconds).toBe(858);
    expect(res.unlockedClass).toBe(true);
    expect(res.message).toContain("100% watched (858s)");
  });
});

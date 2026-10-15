import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const videoProgressSchema = z.object({
  registrationId: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  videoId: z.string().min(1),
  lastPositionSeconds: z.number().min(0),
  completionStatus: z.boolean().default(false),
});

export type VideoProgressInput = z.infer<typeof videoProgressSchema>;

/**
 * Server function to record playback progress, activity timestamp, and completion in Supabase.
 * Primary store: public.leads in the Landing Page Supabase (gifxzzrbpukpxsvmhokj).
 * Secondary/optional store: public.video_progress (gracefully ignored if table does not exist).
 */
export const saveVideoProgress = createServerFn({ method: "POST" })
  .validator((data: unknown) => videoProgressSchema.parse(data))
  .handler(async ({ data }) => {
    if (!data.registrationId && !data.phone) {
      return { ok: true, saved: false, reason: "anonymous_session" };
    }

    try {
      const { recordLeadVideoActivity } = await import("./n8n.server");

      // SERVER-SIDE 95% VIDEO COMPLETION POLICY:
      // Minimum completion threshold is 95% of authoritative 858s video duration (815s).
      // A client request cannot declare completionStatus = true if lastPositionSeconds < 815!
      const genuineCompleted = Boolean(data.completionStatus && data.lastPositionSeconds >= 815);

      // 1. Primary write: record activity timestamp & watch position in Landing Page public.leads
      const activityResult = await recordLeadVideoActivity({
        registrationId: data.registrationId ?? null,
        phone: data.phone ?? null,
        watchSeconds: data.lastPositionSeconds,
        isCompleted: genuineCompleted,
      });

      if (!activityResult.ok) {
        return {
          ok: false,
          saved: false,
          leadId: activityResult.leadId,
          error: activityResult.error || "Failed to record lead video activity",
        };
      }

      // 2. Compatibility write: if video_progress exists in DB, update it without assuming it exists
      if (data.registrationId) {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const nowIso = new Date().toISOString();
          await supabaseAdmin
            .from("video_progress")
            .upsert(
              {
                registration_id: data.registrationId,
                video_id: data.videoId,
                last_position_seconds: Math.round(data.lastPositionSeconds * 100) / 100,
                completion_status: genuineCompleted,
                video_last_activity_at: nowIso,
                updated_at: nowIso,
              },
              {
                onConflict: "registration_id,video_id",
              },
            );
        } catch {
          // Gracefully ignore: video_progress table is optional and may not exist in Landing Page DB
        }
      }

      // 3. Completion handling (only executed if verified genuine completion threshold >= 815s is met)
      if (genuineCompleted && data.registrationId) {
        // Optional funnel_events tracking
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: existingEvent } = await supabaseAdmin
            .from("funnel_events")
            .select("id")
            .eq("registration_id", data.registrationId)
            .eq("event_name", "training_video_completed")
            .maybeSingle();

          if (!existingEvent) {
            await supabaseAdmin.from("funnel_events").insert({
              registration_id: data.registrationId,
              event_name: "training_video_completed",
            });
          }
        } catch {
          // funnel_events may not exist in Landing Page DB
        }

        // Trigger secure server-side n8n webhook & update Landing Page Leads record
        const { processVideoCompletionEvent } = await import("./n8n.server");
        const webhookResult = await processVideoCompletionEvent({
          registrationId: data.registrationId,
          phone: data.phone ?? null,
          videoId: data.videoId,
          lastPositionSeconds: data.lastPositionSeconds,
        });

        if (!webhookResult.ok) {
          return {
            ok: false,
            saved: false,
            leadId: webhookResult.leadId,
            error: webhookResult.error || "Video completion processing failed",
          };
        }

        return {
          ok: true,
          saved: true,
          leadId: webhookResult.leadId,
          webhookSent: webhookResult.webhookSent,
          deduplicated: webhookResult.deduplicated,
        };
      }

      return { ok: true, saved: true, leadId: activityResult.leadId };
    } catch (err: any) {
      console.warn("saveVideoProgress error:", err);
      return { ok: false, saved: false, error: err?.message || String(err) };
    }
  });

/**
 * Server function to fetch remote saved playback progress.
 * Queries public.leads in the Landing Page Supabase (gifxzzrbpukpxsvmhokj) first.
 * Gracefully falls back to public.video_progress if available.
 */
export const fetchRemoteVideoProgress = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        registrationId: z.string().optional().nullable(),
        phone: z.string().optional().nullable(),
        videoId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    if (!data.registrationId && !data.phone) return { ok: false, progress: null };

    try {
      // 1. Primary check: Query public.leads in Landing Page Supabase
      const { getRemoteLeadProgress } = await import("./n8n.server");
      const leadProgress = await getRemoteLeadProgress({
        registrationId: data.registrationId ?? null,
        phone: data.phone ?? null,
      });

      if (leadProgress.ok && leadProgress.progress) {
        return leadProgress;
      }

      // 2. Compatibility fallback: check public.video_progress if it exists
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        if (data.registrationId) {
          const { data: row, error } = await supabaseAdmin
            .from("video_progress")
            .select("last_position_seconds, completion_status")
            .eq("registration_id", data.registrationId)
            .eq("video_id", data.videoId)
            .maybeSingle();

          if (!error && row) {
            return {
              ok: true,
              progress: {
                lastPosition: Number(row.last_position_seconds) || 0,
                isCompleted: Boolean(row.completion_status),
              },
            };
          }
        }
      } catch {
        // video_progress table may not exist
      }

      return { ok: false, progress: null };
    } catch {
      return { ok: false, progress: null };
    }
  });

/**
 * Server function to explicitly retry video completion webhook for a registration.
 */
export const retryVideoCompletionWebhook = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        registrationId: z.string().min(1),
        phone: z.string().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    try {
      const { retryVideoCompletion } = await import("./n8n.server");
      return await retryVideoCompletion({
        registrationId: data.registrationId,
        phone: data.phone ?? null,
      });
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });

export const AUTHORITATIVE_VIDEO_DURATION_SECONDS = 858;
export const REQUIRED_COMPLETION_PERCENT = 0.95;
export const REQUIRED_COMPLETION_SECONDS = 815; // 858 * 0.95 = 815.1

export const verifyNextStepAccessSchema = z.object({
  registrationId: z.string().uuid().optional().nullable(),
  phone: z.string().optional().nullable(),
});

export type VerifyNextStepAccessInput = z.infer<typeof verifyNextStepAccessSchema>;

export interface VerifyNextStepAccessResult {
  authorized: boolean;
  leadId?: string | null;
  reason?: string;
  watchedSeconds?: number;
}

/**
 * Central Server Authorization Function for /next-step access and checkout.
 * Denies access by default. Validates authoritative video completion against public.leads in Supabase.
 * Fails closed on database errors, missing identity, or insufficient watch time (< 815s / 95%).
 */
export const verifyNextStepAccess = createServerFn({ method: "POST" })
  .validator((data: unknown) => verifyNextStepAccessSchema.parse(data))
  .handler(async ({ data }): Promise<VerifyNextStepAccessResult> => {
    if (!data.registrationId && !data.phone) {
      return { authorized: false, reason: "missing_credentials", watchedSeconds: 0 };
    }

    try {
      const { getLeadsSupabaseClient, formatCleanPhone } = await import("./n8n.server");
      const client = getLeadsSupabaseClient();

      let lead: any = null;

      // 1. Primary lookup by registrationId in public.leads
      if (data.registrationId) {
        const { data: byId } = await client
          .from("leads")
          .select("id, phone, watch_seconds, unlocked_class, video_completed_at")
          .eq("id", data.registrationId)
          .maybeSingle();

        if (byId) {
          lead = byId;
        }
      }

      // 2. Secondary lookup by clean phone only if not found by registrationId
      if (!lead && data.phone) {
        const cleanPhone = formatCleanPhone(data.phone);
        if (cleanPhone) {
          const { data: byPhone } = await client
            .from("leads")
            .select("id, phone, watch_seconds, unlocked_class, video_completed_at")
            .eq("phone", cleanPhone)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (byPhone) {
            lead = byPhone;
          }
        }
      }

      if (!lead) {
        return { authorized: false, reason: "lead_not_found", watchedSeconds: 0 };
      }

      // 3. Student Identity Binding: verify registrationId and phone belong to the same student lead
      if (lead && data.phone && data.registrationId) {
        const cleanPhone = formatCleanPhone(data.phone);
        const leadPhone = formatCleanPhone(lead.phone);
        if (cleanPhone && leadPhone && cleanPhone !== leadPhone) {
          console.warn("[Security] verifyNextStepAccess: identity mismatch between registrationId and phone");
          return { authorized: false, reason: "identity_mismatch", watchedSeconds: 0 };
        }
      }

      const watchSeconds = Number(lead.watch_seconds) || 0;
      // Authoritative Policy: Must have unlocked_class AND at least 815s (95%) watch time or genuine completion timestamp
      const hasWatchedThreshold = watchSeconds >= REQUIRED_COMPLETION_SECONDS;
      const isCompleted = Boolean(lead.unlocked_class) && (hasWatchedThreshold || Boolean(lead.video_completed_at));

      if (!isCompleted) {
        return {
          authorized: false,
          leadId: lead.id,
          reason: "video_incomplete",
          watchedSeconds: watchSeconds,
        };
      }

      return {
        authorized: true,
        leadId: lead.id,
        watchedSeconds: watchSeconds,
      };
    } catch (err: any) {
      console.error("[verifyNextStepAccess] Verification exception:", err);
      // Deny by default / fail closed
      return { authorized: false, reason: "server_verification_error", watchedSeconds: 0 };
    }
  });

export const videoInactivitySchema = z.object({
  registrationId: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  videoId: z.string().min(1),
  lastPositionSeconds: z.number().min(0).optional(),
  reason: z.enum(["pause", "pagehide", "visibilitychange", "manual"]).optional(),
});

export type VideoInactivityInput = z.infer<typeof videoInactivitySchema>;

/**
 * Server function to report playback pause or abandonment for inactivity reminders.
 * Primary store: public.leads in the Landing Page Supabase (gifxzzrbpukpxsvmhokj).
 * Dispatches to production n8n webhook only on genuine pause/exit when video is incomplete.
 */
export const reportVideoInactivity = createServerFn({ method: "POST" })
  .validator((data: unknown) => videoInactivitySchema.parse(data))
  .handler(async ({ data }) => {
    if (!data.registrationId && !data.phone) {
      return { ok: true, reported: false, reason: "anonymous_session" };
    }

    try {
      // 1. Record latest activity timestamp & position in public.leads first
      const { recordLeadVideoActivity } = await import("./n8n.server");
      await recordLeadVideoActivity({
        registrationId: data.registrationId ?? null,
        phone: data.phone ?? null,
        watchSeconds: typeof data.lastPositionSeconds === "number" ? data.lastPositionSeconds : 0,
        isCompleted: false,
      });

      // 2. Process inactivity event and dispatch to n8n if eligible
      const { processVideoInactivityEvent } = await import("./n8n.server");
      const result = await processVideoInactivityEvent({
        registrationId: data.registrationId ?? null,
        phone: data.phone ?? null,
        videoId: data.videoId,
        lastPositionSeconds: data.lastPositionSeconds,
        reason: data.reason,
      });

      return {
        ok: result.ok,
        reported: result.webhookSent,
        leadId: result.leadId,
        deduplicated: result.deduplicated,
        reason: result.reason,
        error: result.error,
      };
    } catch (err: any) {
      console.warn("[video.functions] reportVideoInactivity notice:", err?.message);
      return { ok: false, reported: false, error: err?.message || String(err) };
    }
  });


import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const videoProgressSchema = z.object({
  registrationId: z.string().uuid().optional().nullable(),
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

      // 1. Primary write: record activity timestamp & watch position in Landing Page public.leads
      const activityResult = await recordLeadVideoActivity({
        registrationId: data.registrationId ?? null,
        phone: data.phone ?? null,
        watchSeconds: data.lastPositionSeconds,
        isCompleted: data.completionStatus,
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
                completion_status: data.completionStatus,
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

      // 3. Completion handling
      if (data.completionStatus && data.registrationId) {
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
        registrationId: z.string().uuid().optional().nullable(),
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
        registrationId: z.string().uuid(),
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

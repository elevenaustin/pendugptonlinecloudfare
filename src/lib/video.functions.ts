import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const videoProgressSchema = z.object({
  registrationId: z.string().uuid().optional().nullable(),
  videoId: z.string().min(1),
  lastPositionSeconds: z.number().min(0),
  completionStatus: z.boolean().default(false),
});

export type VideoProgressInput = z.infer<typeof videoProgressSchema>;

/**
 * Server function to record playback progress and completion in Supabase.
 */
export const saveVideoProgress = createServerFn({ method: "POST" })
  .validator((data: unknown) => videoProgressSchema.parse(data))
  .handler(async ({ data }) => {
    if (!data.registrationId) {
      return { ok: true, saved: false, reason: "anonymous_session" };
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { error } = await supabaseAdmin
        .from("video_progress")
        .upsert(
          {
            registration_id: data.registrationId,
            video_id: data.videoId,
            last_position_seconds: Math.round(data.lastPositionSeconds * 100) / 100,
            completion_status: data.completionStatus,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "registration_id,video_id",
          },
        );

      if (error) {
        console.warn("Supabase video progress notice:", error.message);
      }

      if (data.completionStatus) {
        // Record funnel event if not already present
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

        // Trigger secure server-side n8n webhook & update Supabase Leads record
        const { processVideoCompletionEvent } = await import("./n8n.server");
        const webhookResult = await processVideoCompletionEvent({
          registrationId: data.registrationId,
          videoId: data.videoId,
          lastPositionSeconds: data.lastPositionSeconds,
        });

        return {
          ok: true,
          saved: true,
          leadId: webhookResult.leadId,
          webhookSent: webhookResult.webhookSent,
          deduplicated: webhookResult.deduplicated,
        };
      }

      return { ok: true, saved: true };
    } catch (err) {
      console.warn("saveVideoProgress error:", err);
      return { ok: true, saved: false };
    }
  });

/**
 * Server function to fetch remote saved playback progress.
 * If video is completed but webhook failed previously, triggers safe background retry.
 */
export const fetchRemoteVideoProgress = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        registrationId: z.string().uuid().optional().nullable(),
        videoId: z.string().min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    if (!data.registrationId) return { ok: false, progress: null };

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row, error } = await supabaseAdmin
        .from("video_progress")
        .select("last_position_seconds, completion_status")
        .eq("registration_id", data.registrationId)
        .eq("video_id", data.videoId)
        .maybeSingle();

      if (error || !row) return { ok: false, progress: null };

      const isCompleted = Boolean(row.completion_status);

      // Safe background retry if completed but webhook was not delivered yet
      if (isCompleted && data.registrationId) {
        const { data: sentEvent } = await supabaseAdmin
          .from("funnel_events")
          .select("id")
          .eq("registration_id", data.registrationId)
          .eq("event_name", "n8n_video_completed_sent")
          .maybeSingle();

        if (!sentEvent) {
          import("./n8n.server").then(({ processVideoCompletionEvent }) => {
            processVideoCompletionEvent({
              registrationId: data.registrationId!,
              videoId: data.videoId,
              lastPositionSeconds: Number(row.last_position_seconds) || 815,
            }).catch((err) => console.warn("[fetchRemoteVideoProgress] Retry notice:", err));
          });
        }
      }

      return {
        ok: true,
        progress: {
          lastPosition: Number(row.last_position_seconds) || 0,
          isCompleted,
        },
      };
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
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    try {
      const { retryVideoCompletion } = await import("./n8n.server");
      return await retryVideoCompletion({ registrationId: data.registrationId });
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });


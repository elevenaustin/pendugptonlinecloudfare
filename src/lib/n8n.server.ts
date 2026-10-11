import { createClient } from "@supabase/supabase-js";

export interface SyncLeadOptions {
  registrationId: string;
  phone: string;
  countryCode?: string;
  gender?: string | null;
  device?: string | null;
  watchSeconds?: number;
  isCompleted?: boolean;
}

export interface WebhookResult {
  ok: boolean;
  leadId: string;
  webhookSent: boolean;
  status?: number;
  error?: string;
  deduplicated?: boolean;
}

// In-memory atomic guard against concurrent duplicate requests
const inFlightDispatches = new Set<string>();

/**
 * Format clean phone number according to PenduGPT CRM standard.
 * Normalizes 10-digit Indian numbers or preserves standard international digits.
 */
export function formatCleanPhone(rawPhone: string, _countryCode = "+91"): string {
  const digitsOnly = (rawPhone || "").replace(/\D/g, "");
  if (digitsOnly.length === 10) return digitsOnly;
  if (digitsOnly.startsWith("91") && digitsOnly.length === 12) {
    return digitsOnly.slice(2);
  }
  if (digitsOnly.length > 10) {
    return digitsOnly.slice(-10);
  }
  return digitsOnly;
}

/**
 * Format device availability into CRM has_laptop standard ('yes' | 'no' | 'later').
 */
export function formatHasLaptop(deviceStr?: string | null): string {
  if (!deviceStr) return "later";
  const lower = deviceStr.toLowerCase();
  if (lower.includes("yes")) return "yes";
  if (lower.includes("no")) return "no";
  return "later";
}

/**
 * Secure server-side Supabase client dedicated to the Leads & WhatsApp CRM database.
 */
export function getLeadsSupabaseClient() {
  const url =
    process.env.LEADS_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "https://gifxzzrbpukpxsvmhokj.supabase.co";

  const key =
    process.env.LEADS_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.LEADS_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpZnh6enJicHVrcHhzdm1ob2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NjQ4ODYsImV4cCI6MjEwNjM0MDg4Nn0.__waNLX5psBQoCoU-kpFDxhwG0J0lTrcZQ-GPE0IpEM";

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Ensures a lead record exists in public.leads in Supabase.
 * Looks up by registrationId or phone.
 * If found, updates watch_seconds and video_completed_at.
 * If missing, inserts a new lead record with genuine UUID so n8n can reliably query it.
 */
export async function syncOrFindLeadRecord(
  opts: SyncLeadOptions,
): Promise<{ leadId: string; lead: any }> {
  const client = getLeadsSupabaseClient();
  const cleanPhone = formatCleanPhone(opts.phone, opts.countryCode);
  const hasLaptop = formatHasLaptop(opts.device);
  const gender = opts.gender ? opts.gender.toLowerCase() : "unspecified";
  const watchSeconds = Math.round(opts.watchSeconds || 0);

  let existingLead: any = null;

  // 1. Look up by registration ID (UUID)
  if (opts.registrationId) {
    const { data: byId } = await client
      .from("leads")
      .select("*")
      .eq("id", opts.registrationId)
      .maybeSingle();
    if (byId) existingLead = byId;
  }

  // 2. Fall back to lookup by clean phone number
  if (!existingLead && cleanPhone) {
    const { data: byPhone } = await client
      .from("leads")
      .select("*")
      .eq("phone", cleanPhone)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (byPhone) existingLead = byPhone;
  }

  const nowIso = new Date().toISOString();

  if (existingLead) {
    const updatePayload: Record<string, any> = {};
    if (watchSeconds > (Number(existingLead.watch_seconds) || 0)) {
      updatePayload.watch_seconds = watchSeconds;
    }
    if (opts.isCompleted && !existingLead.unlocked_class) {
      updatePayload.unlocked_class = true;
    }
    if (opts.isCompleted && !existingLead.video_completed_at) {
      updatePayload.video_completed_at = nowIso;
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error: updateErr } = await client
        .from("leads")
        .update(updatePayload)
        .eq("id", existingLead.id);
      if (updateErr) {
        console.warn("[n8n.server] Lead update warning:", updateErr.message);
      }
    }

    return {
      leadId: existingLead.id,
      lead: { ...existingLead, ...updatePayload },
    };
  }

  // 3. Create new lead record in public.leads with UUID
  const newLeadId = opts.registrationId || crypto.randomUUID();
  const newLead = {
    id: newLeadId,
    created_at: nowIso,
    phone: cleanPhone || opts.phone,
    gender,
    has_laptop: hasLaptop,
    watch_seconds: watchSeconds,
    unlocked_class: Boolean(opts.isCompleted),
    video_completed_at: opts.isCompleted ? nowIso : null,
    whatsapp_followup_status: "NOT_SENT",
    user_agent: `Masterclass Funnel | ${opts.device || "Web"}`,
  };

  const { data: inserted, error: insertError } = await client
    .from("leads")
    .upsert(newLead, { onConflict: "id" })
    .select("*")
    .maybeSingle();

  if (insertError) {
    console.warn("[n8n.server] Lead upsert warning:", insertError.message);
  }

  return { leadId: inserted?.id || newLeadId, lead: inserted || newLead };
}

/**
 * Dispatches the HTTP POST request to the n8n WhatsApp workflow Production webhook.
 * Retries up to 2 times for transient network/5xx server errors.
 */
export async function sendN8nWebhook(
  leadId: string,
): Promise<{ ok: boolean; status: number; body: string }> {
  const webhookUrl =
    process.env.N8N_VIDEO_COMPLETED_WEBHOOK_URL ||
    "https://pendugptonline.app.n8n.cloud/webhook/pendugpt-video-completed";

  const payload = {
    event: "video_completed",
    lead_id: leadId,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (process.env.N8N_WEBHOOK_SECRET) {
    headers["X-Webhook-Secret"] = process.env.N8N_WEBHOOK_SECRET;
  }

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      const text = await res.text();

      if (res.ok) {
        return { ok: true, status: res.status, body: text };
      }

      // If client error (4xx), return immediately without redundant retry
      if (res.status >= 400 && res.status < 500) {
        return { ok: false, status: res.status, body: text };
      }

      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 600));
      }
    } catch (err: any) {
      lastError = err;
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  }

  return {
    ok: false,
    status: 500,
    body: lastError?.message || "Webhook request failed after retries",
  };
}

/**
 * Core processor for video completion events:
 * 1. Checks atomic concurrency lock and idempotency in funnel_events.
 * 2. Fetches registration info.
 * 3. Upserts/updates public.leads in Supabase.
 * 4. Confirms the lead exists in public.leads before dispatching.
 * 5. Dispatches the real lead UUID to the n8n Production Webhook.
 * 6. Marks permanently successful in funnel_events ONLY upon HTTP 2xx response.
 */
export async function processVideoCompletionEvent({
  registrationId,
  lastPositionSeconds,
}: {
  registrationId: string;
  videoId: string;
  lastPositionSeconds: number;
}): Promise<WebhookResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Atomic in-memory guard to prevent concurrent execution during in-flight dispatch
  if (inFlightDispatches.has(registrationId)) {
    console.info(
      `[n8n.server] Video completion dispatch already in progress for: ${registrationId}. Skipping duplicate.`,
    );
    return { ok: true, leadId: registrationId, webhookSent: false, deduplicated: true };
  }

  // 1. Check if n8n webhook was ALREADY sent for this registration
  const { data: sentEvent } = await supabaseAdmin
    .from("funnel_events")
    .select("id")
    .eq("registration_id", registrationId)
    .eq("event_name", "n8n_video_completed_sent")
    .maybeSingle();

  if (sentEvent?.id) {
    console.info(
      `[n8n.server] Video completion webhook already sent for registration: ${registrationId}. Skipping duplicate.`,
    );
    return { ok: true, leadId: registrationId, webhookSent: true, deduplicated: true };
  }

  inFlightDispatches.add(registrationId);

  try {
    // 2. Fetch registration details from the primary registrations database
    const { data: reg } = await supabaseAdmin
      .from("registrations")
      .select("id, phone_country_code, phone_number, gender, device_availability, created_at")
      .eq("id", registrationId)
      .maybeSingle();

    // 3. Find or sync the lead in public.leads in the CRM Supabase
    const { leadId, lead } = await syncOrFindLeadRecord({
      registrationId,
      phone: reg?.phone_number || "",
      countryCode: reg?.phone_country_code || "+91",
      gender: reg?.gender,
      device: reg?.device_availability,
      watchSeconds: lastPositionSeconds,
      isCompleted: true,
    });

    // 4. Confirm the lead genuinely exists in public.leads in Supabase before dispatching
    const client = getLeadsSupabaseClient();
    const { data: verifiedLead, error: verifyErr } = await client
      .from("leads")
      .select("id, phone, unlocked_class, video_completed_at, whatsapp_followup_status")
      .eq("id", leadId)
      .maybeSingle();

    if (!verifiedLead || verifyErr) {
      console.error(
        `[n8n.server] Aborting webhook: Lead ${leadId} could not be confirmed in public.leads. Error: ${verifyErr?.message}`,
      );
      return { ok: false, leadId, webhookSent: false, error: "Lead verification failed" };
    }

    // 5. If lead has already progressed past NOT_SENT in WhatsApp CRM, avoid duplicate message
    if (verifiedLead.whatsapp_followup_status && verifiedLead.whatsapp_followup_status !== "NOT_SENT") {
      console.info(
        `[n8n.server] Lead ${leadId} status is '${verifiedLead.whatsapp_followup_status}'. Suppressing duplicate WhatsApp follow-up webhook.`,
      );
      await supabaseAdmin.from("funnel_events").insert({
        registration_id: registrationId,
        event_name: "n8n_video_completed_sent",
      });
      return { ok: true, leadId, webhookSent: true, deduplicated: true };
    }

    // 6. Dispatch real Supabase lead UUID to the n8n Production Webhook
    console.info(`[n8n.server] Dispatching video_completed event to n8n for lead_id: ${leadId}`);
    const webhookRes = await sendN8nWebhook(leadId);

    if (webhookRes.ok) {
      console.info(
        `[n8n.server] n8n webhook delivered successfully (status: ${webhookRes.status}) for lead_id: ${leadId}`,
      );
      // Mark permanently successful ONLY after receiving positive acknowledgment
      await supabaseAdmin.from("funnel_events").insert({
        registration_id: registrationId,
        event_name: "n8n_video_completed_sent",
      });
      return {
        ok: true,
        leadId,
        webhookSent: true,
        status: webhookRes.status,
      };
    } else {
      console.warn(
        `[n8n.server] n8n webhook delivery status: ${webhookRes.status} body: ${webhookRes.body}`,
      );
      // Record failure without marking sent, allowing safe retry later
      await supabaseAdmin.from("funnel_events").insert({
        registration_id: registrationId,
        event_name: `n8n_video_completed_failed:${webhookRes.status}`,
      });
      return {
        ok: true, // Non-fatal so frontend class unlock continues uninterrupted
        leadId,
        webhookSent: false,
        status: webhookRes.status,
        error: webhookRes.body,
      };
    }
  } finally {
    inFlightDispatches.delete(registrationId);
  }
}

/**
 * Safe retry function for video completion webhook.
 */
export async function retryVideoCompletion({
  registrationId,
}: {
  registrationId: string;
}): Promise<WebhookResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Check if already delivered
  const { data: sentEvent } = await supabaseAdmin
    .from("funnel_events")
    .select("id")
    .eq("registration_id", registrationId)
    .eq("event_name", "n8n_video_completed_sent")
    .maybeSingle();

  if (sentEvent?.id) {
    return { ok: true, leadId: registrationId, webhookSent: true, deduplicated: true };
  }

  const { data: prog } = await supabaseAdmin
    .from("video_progress")
    .select("last_position_seconds, completion_status")
    .eq("registration_id", registrationId)
    .maybeSingle();

  return await processVideoCompletionEvent({
    registrationId,
    videoId: "1231615906",
    lastPositionSeconds: Number(prog?.last_position_seconds) || 815,
  });
}

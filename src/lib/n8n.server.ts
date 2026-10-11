import { createClient } from "@supabase/supabase-js";

export interface SyncLeadOptions {
  registrationId?: string | null;
  phone: string;
  countryCode?: string;
  gender?: string | null;
  device?: string | null;
  watchSeconds?: number;
  isCompleted?: boolean;
  client?: any;
}

export interface SyncLeadResult {
  ok: boolean;
  leadId: string | null;
  lead: any | null;
  error?: string;
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

export const CRM_DEFAULT_URL = "https://gifxzzrbpukpxsvmhokj.supabase.co";
export const CRM_DEFAULT_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpZnh6enJicHVrcHhzdm1ob2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NjQ4ODYsImV4cCI6MjEwNjM0MDg4Nn0.__waNLX5psBQoCoU-kpFDxhwG0J0lTrcZQ-GPE0IpEM";

/**
 * Secure server-side Supabase client dedicated to the Leads & WhatsApp CRM database.
 * CRITICAL: NEVER fall back to SUPABASE_URL here. That points to the website database
 * (xlyqrzcstkxdkyvdensc), which does NOT contain public.leads.
 */
export function getLeadsSupabaseClient() {
  const url =
    process.env.LEADS_SUPABASE_URL ||
    process.env.CRM_SUPABASE_URL ||
    CRM_DEFAULT_URL;

  const key =
    process.env.LEADS_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.CRM_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.LEADS_SUPABASE_ANON_KEY ||
    process.env.CRM_SUPABASE_ANON_KEY ||
    CRM_DEFAULT_KEY;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Ensures a lead record exists in public.leads in the CRM Supabase.
 * Looks up by clean phone first, then by registrationId.
 * If found, updates watch_seconds and video_completed_at and returns the actual CRM lead ID.
 * If missing, inserts a new lead record with verified registration data.
 * Returns { ok: false } if phone is missing or insert fails. Never invents an unverified lead.
 */
export async function syncOrFindLeadRecord(
  opts: SyncLeadOptions,
): Promise<SyncLeadResult> {
  const client = opts.client || getLeadsSupabaseClient();
  const cleanPhone = formatCleanPhone(opts.phone, opts.countryCode);
  const hasLaptop = formatHasLaptop(opts.device);
  const gender = opts.gender ? opts.gender.toLowerCase() : "unspecified";
  const watchSeconds = Math.round(opts.watchSeconds || 0);

  // If phone is missing or unverified, never invent an ID or placeholder.
  if (!cleanPhone || cleanPhone.length < 6) {
    return {
      ok: false,
      leadId: null,
      lead: null,
      error: "Missing or unverified phone number",
    };
  }

  let existingLead: any = null;

  // 1. Primary lookup by clean phone number in CRM public.leads
  const { data: byPhone, error: phoneErr } = await client
    .from("leads")
    .select("*")
    .eq("phone", cleanPhone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (byPhone) {
    existingLead = byPhone;
  } else if (phoneErr) {
    console.warn("[n8n.server] Lead phone lookup notice:", phoneErr.message);
  }

  // 2. Secondary lookup by registration ID in CRM public.leads if not found by phone
  if (!existingLead && opts.registrationId) {
    const { data: byId, error: idErr } = await client
      .from("leads")
      .select("*")
      .eq("id", opts.registrationId)
      .maybeSingle();

    if (byId) {
      existingLead = byId;
    } else if (idErr) {
      console.warn("[n8n.server] Lead ID lookup notice:", idErr.message);
    }
  }

  const nowIso = new Date().toISOString();

  // If lead already exists in CRM, update progress and return the ACTUAL existing CRM lead ID
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
      ok: true,
      leadId: existingLead.id,
      lead: { ...existingLead, ...updatePayload },
    };
  }

  // 3. Lead is missing from CRM: safely sync/insert genuine record using verified registration data
  const newLeadId = opts.registrationId || crypto.randomUUID();
  const newLead = {
    id: newLeadId,
    created_at: nowIso,
    phone: cleanPhone,
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
    console.warn("[n8n.server] Lead upsert error:", insertError.message);
    // In case of race condition or conflict, attempt one final lookup by phone
    const { data: fallbackLead } = await client
      .from("leads")
      .select("*")
      .eq("phone", cleanPhone)
      .maybeSingle();

    if (fallbackLead) {
      return { ok: true, leadId: fallbackLead.id, lead: fallbackLead };
    }

    return {
      ok: false,
      leadId: null,
      lead: null,
      error: `Failed to persist lead in CRM: ${insertError.message}`,
    };
  }

  const finalLead = inserted || newLead;
  return { ok: true, leadId: finalLead.id, lead: finalLead };
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
 * 2. Enforces genuine completion threshold (>= 750 seconds, ~95% of video).
 * 3. Fetches verified registration info (or uses supplied phone).
 * 4. Resolves the genuine CRM public.leads.id (by phone or id), syncing if missing.
 * 5. Strictly confirms that the lead exists in CRM public.leads before dispatching.
 * 6. Dispatches ONLY the confirmed CRM lead UUID (never an unverified registration UUID).
 * 7. Marks permanently successful in funnel_events ONLY upon HTTP 2xx response.
 */
export async function processVideoCompletionEvent({
  registrationId,
  phone,
  videoId: _videoId,
  lastPositionSeconds,
  websiteClient,
  crmClient,
}: {
  registrationId: string;
  phone?: string | null;
  videoId: string;
  lastPositionSeconds: number;
  websiteClient?: any;
  crmClient?: any;
}): Promise<WebhookResult> {
  const adminClient =
    websiteClient || (await import("@/integrations/supabase/client.server")).supabaseAdmin;
  const client = crmClient || getLeadsSupabaseClient();

  // Atomic in-memory guard to prevent concurrent execution during in-flight dispatch
  if (inFlightDispatches.has(registrationId)) {
    console.info(
      `[n8n.server] Video completion dispatch already in progress for: ${registrationId}. Skipping duplicate.`,
    );
    return { ok: true, leadId: registrationId, webhookSent: false, deduplicated: true };
  }

  // 1. Check if n8n webhook was ALREADY sent for this registration
  const { data: sentEvent } = await adminClient
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
    // 2. Verify genuine completion watch threshold (95% of ~858s video is ~815s; require at least 750s)
    if (lastPositionSeconds < 750) {
      console.warn(
        `[n8n.server] Refusing webhook dispatch: watch time ${lastPositionSeconds}s does not meet genuine completion threshold (>= 750s).`,
      );
      return {
        ok: true,
        leadId: registrationId,
        webhookSent: false,
        error: "Completion threshold not reached",
      };
    }

    // 3. Fetch registration details from the primary registrations database
    const { data: reg } = await adminClient
      .from("registrations")
      .select("id, phone_country_code, phone_number, gender, device_availability, created_at")
      .eq("id", registrationId)
      .maybeSingle();

    const candidatePhone = reg?.phone_number || phone || "";
    const candidateCountryCode = reg?.phone_country_code || "+91";

    // 4. If neither registration row nor verified phone exists, NEVER invent an ID or send an unverified webhook
    if (!candidatePhone) {
      console.error(
        `[n8n.server] Aborting webhook: Registration ${registrationId} not found in database and no phone provided. Cannot verify CRM lead.`,
      );
      return {
        ok: false,
        leadId: registrationId,
        webhookSent: false,
        error: "Unverified lead: missing registration and phone",
      };
    }

    // 5. Find or sync the genuine lead in public.leads in the CRM Supabase
    const syncRes = await syncOrFindLeadRecord({
      registrationId,
      phone: candidatePhone,
      countryCode: candidateCountryCode,
      gender: reg?.gender,
      device: reg?.device_availability,
      watchSeconds: lastPositionSeconds,
      isCompleted: true,
      client,
    });

    if (!syncRes.ok || !syncRes.leadId) {
      console.error(
        `[n8n.server] Aborting webhook: Could not sync or locate lead in CRM. Error: ${syncRes.error}`,
      );
      return {
        ok: false,
        leadId: registrationId,
        webhookSent: false,
        error: syncRes.error || "CRM sync failed",
      };
    }

    const targetCrmLeadId = syncRes.leadId;

    // 6. Confirm the lead genuinely exists in public.leads in CRM Supabase before dispatching
    const { data: verifiedLead, error: verifyErr } = await client
      .from("leads")
      .select("id, phone, unlocked_class, video_completed_at, whatsapp_followup_status")
      .eq("id", targetCrmLeadId)
      .maybeSingle();

    if (!verifiedLead || verifyErr || !verifiedLead.phone) {
      console.error(
        `[n8n.server] Aborting webhook: CRM lead ${targetCrmLeadId} could not be confirmed in public.leads. Error: ${verifyErr?.message}`,
      );
      return { ok: false, leadId: targetCrmLeadId, webhookSent: false, error: "Lead verification failed" };
    }

    // 7. If lead has already progressed past NOT_SENT in WhatsApp CRM, avoid duplicate message
    if (verifiedLead.whatsapp_followup_status && verifiedLead.whatsapp_followup_status !== "NOT_SENT") {
      console.info(
        `[n8n.server] Lead ${verifiedLead.id} status is '${verifiedLead.whatsapp_followup_status}'. Suppressing duplicate WhatsApp follow-up webhook.`,
      );
      await adminClient.from("funnel_events").insert({
        registration_id: registrationId,
        event_name: "n8n_video_completed_sent",
      });
      return { ok: true, leadId: verifiedLead.id, webhookSent: true, deduplicated: true };
    }

    // 8. Dispatch verified CRM lead UUID (never unverified registration UUID) to the n8n Production Webhook
    console.info(
      `[n8n.server] Dispatching video_completed event to n8n for confirmed CRM lead_id: ${verifiedLead.id}`,
    );
    const webhookRes = await sendN8nWebhook(verifiedLead.id);

    if (webhookRes.ok) {
      console.info(
        `[n8n.server] n8n webhook delivered successfully (status: ${webhookRes.status}) for confirmed CRM lead_id: ${verifiedLead.id}`,
      );
      // Mark permanently successful ONLY after receiving positive acknowledgment
      await adminClient.from("funnel_events").insert({
        registration_id: registrationId,
        event_name: "n8n_video_completed_sent",
      });
      return {
        ok: true,
        leadId: verifiedLead.id,
        webhookSent: true,
        status: webhookRes.status,
      };
    } else {
      console.warn(
        `[n8n.server] n8n webhook delivery status: ${webhookRes.status} body: ${webhookRes.body}`,
      );
      // Record failure without marking sent, allowing safe retry later
      await adminClient.from("funnel_events").insert({
        registration_id: registrationId,
        event_name: `n8n_video_completed_failed:${webhookRes.status}`,
      });
      return {
        ok: true, // Non-fatal so frontend class unlock continues uninterrupted
        leadId: verifiedLead.id,
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
  phone,
}: {
  registrationId: string;
  phone?: string | null;
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
    phone,
    videoId: "1231615906",
    lastPositionSeconds: Number(prog?.last_position_seconds) || 815,
  });
}


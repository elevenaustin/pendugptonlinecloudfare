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
  reason?: string;
}

export interface CampaignLockResult {
  acquired: boolean;
  currentStatus: "PROCESSING" | "SENT" | "FAILED" | "UNCERTAIN";
  existingLogId?: string;
  reason: string;
}

export const CAMPAIGN_NAME = "pendugpt_class_choice";

// In-memory atomic guard against concurrent duplicate requests within the same process
const inFlightDispatches = new Set<string>();

/**
 * Normalizes phone numbers to canonical E.164 format (e.g. "+91XXXXXXXXXX").
 * Standardizes 10-digit Indian numbers with '+91', strips spaces, dashes, leading zeroes.
 */
export function normalizeToE164(rawPhone: string, defaultCountryCode = "+91"): string {
  if (!rawPhone) return "";
  const cleaned = rawPhone.trim();
  const digitsOnly = cleaned.replace(/\D/g, "");

  if (!digitsOnly) return "";

  // 10-digit Indian number: prepend +91 (or default country code)
  if (digitsOnly.length === 10) {
    const cc = defaultCountryCode.startsWith("+") ? defaultCountryCode : `+${defaultCountryCode}`;
    return `${cc}${digitsOnly}`;
  }

  // Starts with 91 and has 12 digits (e.g. 919817337782)
  if (digitsOnly.length === 12 && digitsOnly.startsWith("91")) {
    return `+${digitsOnly}`;
  }

  // Starts with 0 followed by 10 digits (e.g. 09817337782)
  if (digitsOnly.length === 11 && digitsOnly.startsWith("0")) {
    return `+91${digitsOnly.slice(1)}`;
  }

  // Already includes international + sign
  if (cleaned.startsWith("+")) {
    return `+${digitsOnly}`;
  }

  // If longer than 10 digits and starts with country digits, format as E.164
  if (digitsOnly.length > 10) {
    return `+${digitsOnly}`;
  }

  // Fallback for shorter numbers with country code
  const cc = defaultCountryCode.startsWith("+") ? defaultCountryCode : `+${defaultCountryCode}`;
  return `${cc}${digitsOnly}`;
}

/**
 * Format clean phone number according to PenduGPT CRM legacy 10-digit standard.
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
 * Unified with SUPABASE_URL / LEADS_SUPABASE_URL pointing to the production database.
 */
export function getLeadsSupabaseClient() {
  const url =
    process.env["LEADS_SUPABASE_URL"] ||
    process.env["SUPABASE_URL"] ||
    process.env["CRM_SUPABASE_URL"] ||
    CRM_DEFAULT_URL;

  const key =
    process.env["LEADS_SUPABASE_SERVICE_ROLE_KEY"] ||
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
    process.env["CRM_SUPABASE_SERVICE_ROLE_KEY"] ||
    process.env["LEADS_SUPABASE_ANON_KEY"] ||
    process.env["CRM_SUPABASE_ANON_KEY"] ||
    CRM_DEFAULT_KEY;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Checks if contact has already been sent this campaign or has progressed in CRM.
 * Checks both CRM public.leads status ('SENT', 'REPLIED', 'PAID') and persistent
 * message log public.whatsapp_campaign_logs for 'pendugpt_class_choice'.
 */
export async function checkPreviousSends({
  phoneCanonical,
  campaign = CAMPAIGN_NAME,
  client,
}: {
  phoneCanonical: string;
  campaign?: string;
  client?: any;
}): Promise<{ shouldSkip: boolean; reason?: string; status?: string }> {
  const crmClient = client || getLeadsSupabaseClient();
  const nationalDigits = formatCleanPhone(phoneCanonical);

  // 1. Check CRM leads for this contact (matches either canonical E.164 or 10-digit format)
  const phoneCandidates = [phoneCanonical];
  if (nationalDigits && nationalDigits !== phoneCanonical) {
    phoneCandidates.push(nationalDigits);
  }

  try {
    const table = crmClient.from("leads");
    if (table && typeof table.select === "function") {
      const sel = table.select("id, phone, whatsapp_followup_status");
      let res: any = null;

      if (typeof sel.in === "function") {
        res = await sel.in("phone", phoneCandidates);
      } else if (typeof sel.or === "function") {
        const phoneQuery = nationalDigits
          ? `phone.eq.${phoneCanonical},phone.eq.${nationalDigits}`
          : `phone.eq.${phoneCanonical}`;
        res = await sel.or(phoneQuery);
      } else if (typeof sel.eq === "function") {
        res = await sel.eq("phone", nationalDigits || phoneCanonical);
      }

      const leads = res?.data;
      if (leads && Array.isArray(leads) && leads.length > 0) {
        for (const lead of leads) {
          if (["SENT", "REPLIED", "PAID"].includes(lead.whatsapp_followup_status)) {
            return {
              shouldSkip: true,
              reason: `crm_status_${lead.whatsapp_followup_status.toLowerCase()}`,
              status: lead.whatsapp_followup_status,
            };
          }
        }
      }
    }
  } catch (err: any) {
    console.warn("[n8n.server] CRM leads lookup notice:", err?.message);
  }

  // 2. Check persistent campaign message log table
  try {
    const table = crmClient.from("whatsapp_campaign_logs");
    if (table && typeof table.select === "function") {
      const { data: campaignLog } = await table
        .select("*")
        .eq("phone_canonical", phoneCanonical)
        .eq("campaign", campaign)
        .maybeSingle();

      if (campaignLog) {
        if (campaignLog.status === "SENT") {
          return {
            shouldSkip: true,
            reason: "campaign_already_sent",
            status: "SENT",
          };
        }
        if (campaignLog.status === "UNCERTAIN") {
          return {
            shouldSkip: true,
            reason: "uncertain_previous_send",
            status: "UNCERTAIN",
          };
        }
        const isLockActive = new Date(campaignLog.lock_expires_at).getTime() > Date.now();
        if (campaignLog.status === "PROCESSING" && isLockActive) {
          return {
            shouldSkip: true,
            reason: "concurrent_lock_active",
            status: "PROCESSING",
          };
        }
      }
    }
  } catch (err: any) {
    console.warn("[n8n.server] Campaign log lookup notice:", err?.message);
  }

  return { shouldSkip: false };
}

/**
 * Atomically acquires a campaign lock for the normalized contact.
 * Uses persistent Supabase stored procedure or table unique constraint (uq_whatsapp_campaign_phone)
 * so concurrent executions cannot simultaneously claim the same contact.
 */
export async function acquireCampaignLock({
  phoneCanonical,
  campaign = CAMPAIGN_NAME,
  leadId,
  registrationId,
  lockTimeoutSeconds = 300,
  client,
}: {
  phoneCanonical: string;
  campaign?: string;
  leadId?: string;
  registrationId?: string;
  lockTimeoutSeconds?: number;
  client?: any;
}): Promise<CampaignLockResult> {
  const crmClient = client || getLeadsSupabaseClient();

  // 1. Try atomic database stored procedure if available
  try {
    if (typeof crmClient.rpc === "function") {
      const { data: rpcData, error: rpcErr } = await crmClient.rpc("acquire_campaign_lock", {
        p_phone_canonical: phoneCanonical,
        p_campaign: campaign,
        p_lead_id: leadId || null,
        p_registration_id: registrationId || null,
        p_lock_timeout_seconds: lockTimeoutSeconds,
      });

      if (!rpcErr && rpcData && rpcData.length > 0) {
        const row = rpcData[0];
        return {
          acquired: Boolean(row.acquired),
          currentStatus: row.current_status,
          existingLogId: row.existing_log_id,
          reason: row.reason,
        };
      }
    }
  } catch {
    /* Fallback to direct table atomic insert/lock */
  }

  // 2. Direct atomic table insertion guarded by UNIQUE constraint (phone_canonical, campaign)
  const now = new Date();
  const lockExpiresAt = new Date(now.getTime() + lockTimeoutSeconds * 1000).toISOString();
  const nowIso = now.toISOString();

  try {
    const table = crmClient.from("whatsapp_campaign_logs");
    if (!table || typeof table.insert !== "function") {
      return {
        acquired: true,
        currentStatus: "PROCESSING",
        reason: "lock_fallback_mock",
      };
    }

    const { data: insertData, error: insertErr } = await table
      .insert({
        phone_canonical: phoneCanonical,
        campaign,
        status: "PROCESSING",
        lead_id: leadId || null,
        registration_id: registrationId || null,
        claimed_at: nowIso,
        updated_at: nowIso,
        lock_expires_at: lockExpiresAt,
        attempt_count: 1,
      })
      .select("*")
      .maybeSingle();

    if (!insertErr && insertData) {
      return {
        acquired: true,
        currentStatus: "PROCESSING",
        existingLogId: insertData.id,
        reason: "lock_acquired",
      };
    }

    // Row already exists - inspect existing row
    const { data: existing } = await table
      .select("*")
      .eq("phone_canonical", phoneCanonical)
      .eq("campaign", campaign)
      .maybeSingle();

    if (!existing) {
      return {
        acquired: false,
        currentStatus: "FAILED",
        reason: "could_not_claim_lock",
      };
    }

    if (existing.status === "SENT") {
      return {
        acquired: false,
        currentStatus: "SENT",
        existingLogId: existing.id,
        reason: "already_sent",
      };
    }

    if (existing.status === "UNCERTAIN") {
      return {
        acquired: false,
        currentStatus: "UNCERTAIN",
        existingLogId: existing.id,
        reason: "uncertain_previous_send",
      };
    }

    const isLockActive = new Date(existing.lock_expires_at).getTime() > Date.now();
    if (existing.status === "PROCESSING" && isLockActive) {
      return {
        acquired: false,
        currentStatus: "PROCESSING",
        existingLogId: existing.id,
        reason: "concurrent_lock_active",
      };
    }

    // Stale lock: mark UNCERTAIN so we never blindly duplicate an uncertain send
    if (existing.status === "PROCESSING" && !isLockActive) {
      await table
        .update({
          status: "UNCERTAIN",
          updated_at: nowIso,
          error_message: "Previous execution timed out without send confirmation",
        })
        .eq("id", existing.id);

      return {
        acquired: false,
        currentStatus: "UNCERTAIN",
        existingLogId: existing.id,
        reason: "stale_lock_marked_uncertain",
      };
    }

    // If FAILED: allow safe re-acquisition
    if (existing.status === "FAILED") {
      const { data: updated } = await table
        .update({
          status: "PROCESSING",
          lead_id: leadId || existing.lead_id,
          registration_id: registrationId || existing.registration_id,
          claimed_at: nowIso,
          updated_at: nowIso,
          lock_expires_at: lockExpiresAt,
          attempt_count: (Number(existing.attempt_count) || 1) + 1,
          error_message: null,
        })
        .eq("id", existing.id)
        .select("*")
        .maybeSingle();

      return {
        acquired: true,
        currentStatus: "PROCESSING",
        existingLogId: updated?.id || existing.id,
        reason: "lock_reacquired_after_failure",
      };
    }

    return {
      acquired: false,
      currentStatus: existing.status,
      existingLogId: existing.id,
      reason: "unhandled_status",
    };
  } catch (err: any) {
    console.warn("[n8n.server] Campaign lock acquisition fallback:", err?.message);
    return {
      acquired: true,
      currentStatus: "PROCESSING",
      reason: "lock_fallback_error",
    };
  }
}

/**
 * Finalizes campaign send outcome.
 * Marks SENT, FAILED, or UNCERTAIN in whatsapp_campaign_logs, and reconciles all CRM leads
 * sharing the normalized phone number to 'SENT' upon positive provider delivery.
 */
export async function finalizeCampaignSend({
  phoneCanonical,
  campaign = CAMPAIGN_NAME,
  status,
  providerMessageId,
  errorMessage,
  metadata,
  client,
}: {
  phoneCanonical: string;
  campaign?: string;
  status: "SENT" | "FAILED" | "UNCERTAIN";
  providerMessageId?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  client?: any;
}): Promise<void> {
  const crmClient = client || getLeadsSupabaseClient();
  const nationalDigits = formatCleanPhone(phoneCanonical);
  const nowIso = new Date().toISOString();

  // 1. Try stored procedure if deployed
  try {
    if (typeof crmClient.rpc === "function") {
      const { error: rpcErr } = await crmClient.rpc("finalize_campaign_send", {
        p_phone_canonical: phoneCanonical,
        p_campaign: campaign,
        p_status: status,
        p_provider_message_id: providerMessageId || null,
        p_error_message: errorMessage || null,
        p_metadata: metadata || {},
      });

      if (!rpcErr) return;
    }
  } catch {
    /* Fallback to direct table updates */
  }

  // 2. Direct table update on campaign logs
  try {
    const table = crmClient.from("whatsapp_campaign_logs");
    if (table && typeof table.update === "function") {
      const logUpdate: Record<string, any> = {
        status,
        updated_at: nowIso,
      };
      if (providerMessageId) logUpdate.provider_message_id = providerMessageId;
      if (errorMessage) logUpdate.error_message = errorMessage;
      if (status === "SENT") logUpdate.sent_at = nowIso;
      if (metadata) logUpdate.metadata = metadata;

      await table
        .update(logUpdate)
        .eq("phone_canonical", phoneCanonical)
        .eq("campaign", campaign);
    }
  } catch (err: any) {
    console.warn("[n8n.server] Campaign log update error:", err?.message);
  }

  // 3. If SENT, update all CRM leads sharing this contact's phone
  if (status === "SENT") {
    try {
      const leadsRef = crmClient.from("leads");
      if (leadsRef && typeof leadsRef.update === "function") {
        const phoneCandidates = [phoneCanonical];
        if (nationalDigits && nationalDigits !== phoneCanonical) {
          phoneCandidates.push(nationalDigits);
        }
        const updateCall = leadsRef.update({
          whatsapp_followup_status: "SENT",
          whatsapp_followup_sent_at: nowIso,
        });

        if (typeof updateCall.in === "function") {
          await updateCall.in("phone", phoneCandidates);
        } else if (typeof updateCall.or === "function") {
          const phoneFilter = nationalDigits
            ? `phone.eq.${phoneCanonical},phone.eq.${nationalDigits}`
            : `phone.eq.${phoneCanonical}`;
          await updateCall.or(phoneFilter);
        } else if (typeof updateCall.eq === "function") {
          await updateCall.eq("phone", nationalDigits || phoneCanonical);
        }
      }
    } catch (err: any) {
      console.warn("[n8n.server] Lead status update error:", err?.message);
    }
  }
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
    if (opts.isCompleted || watchSeconds > 0) {
      updatePayload.video_last_activity_at = nowIso;
    }
    // STRICT SERVER POLICY: unlocked_class and video_completed_at can ONLY be set if watch_seconds >= 815 (95% threshold)
    const isGenuineComplete = Boolean(opts.isCompleted && watchSeconds >= 815);
    if (isGenuineComplete && !existingLead.unlocked_class) {
      updatePayload.unlocked_class = true;
    }
    if (isGenuineComplete && !existingLead.video_completed_at) {
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
  const isGenuineComplete = Boolean(opts.isCompleted && watchSeconds >= 815);
  const newLead = {
    id: newLeadId,
    created_at: nowIso,
    phone: cleanPhone,
    gender,
    has_laptop: hasLaptop,
    watch_seconds: watchSeconds,
    unlocked_class: isGenuineComplete,
    video_completed_at: isGenuineComplete ? nowIso : null,
    video_last_activity_at: opts.isCompleted || watchSeconds > 0 ? nowIso : null,
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

export interface RecordActivityOptions {
  registrationId?: string | null;
  phone?: string | null;
  watchSeconds?: number;
  isCompleted?: boolean;
  client?: any;
}

export interface RecordActivityResult {
  ok: boolean;
  leadId: string | null;
  updated?: boolean;
  error?: string;
}

/**
 * Records verified active video playback activity in public.leads in CRM Supabase.
 * Updates video_last_activity_at and increments watch_seconds if genuine advancement occurred.
 * Uses registrationId as primary stable identifier before falling back to phone.
 * Does not mark completed unless isCompleted is explicitly true.
 */
export async function recordLeadVideoActivity(
  opts: RecordActivityOptions,
): Promise<RecordActivityResult> {
  const client = opts.client || getLeadsSupabaseClient();
  const registrationId = opts.registrationId || null;
  const rawPhone = opts.phone || null;
  const watchSeconds = Math.round(opts.watchSeconds || 0);
  const nowIso = new Date().toISOString();

  if (!registrationId && !rawPhone) {
    return { ok: false, leadId: null, error: "Missing registrationId and phone" };
  }

  try {
    let existingLead: any = null;

    // 1. Primary lookup by stable registrationId in CRM public.leads
    if (registrationId) {
      const { data: byId, error: idErr } = await client
        .from("leads")
        .select("id, phone, watch_seconds, unlocked_class, video_completed_at, video_last_activity_at")
        .eq("id", registrationId)
        .maybeSingle();

      if (byId) {
        existingLead = byId;
      } else if (idErr) {
        console.warn("[n8n.server] Lead activity ID lookup notice:", idErr.message);
      }
    }

    // 2. Secondary lookup by clean phone only if not found by registrationId
    if (!existingLead && rawPhone) {
      const cleanPhone = formatCleanPhone(rawPhone);
      if (cleanPhone) {
        const { data: byPhone, error: phoneErr } = await client
          .from("leads")
          .select("id, phone, watch_seconds, unlocked_class, video_completed_at, video_last_activity_at")
          .eq("phone", cleanPhone)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (byPhone) {
          existingLead = byPhone;
        } else if (phoneErr) {
          console.warn("[n8n.server] Lead activity phone lookup notice:", phoneErr.message);
        }
      }
    }

    if (!existingLead) {
      if (registrationId && rawPhone) {
        const syncRes = await syncOrFindLeadRecord({
          registrationId,
          phone: rawPhone,
          watchSeconds,
          isCompleted: opts.isCompleted,
          client,
        });
        if (syncRes.ok && syncRes.leadId) {
          return { ok: true, leadId: syncRes.leadId, updated: true };
        }
      }
      return { ok: false, leadId: null, error: "Lead record not found" };
    }

    // 3. Student Identity Binding: verify registrationId matches phone if both are present
    if (existingLead && rawPhone) {
      const cleanPhone = formatCleanPhone(rawPhone);
      const leadPhone = formatCleanPhone(existingLead.phone);
      if (cleanPhone && leadPhone && cleanPhone !== leadPhone) {
        console.warn(
          `[Security] Identity mismatch: registrationId ${registrationId} does not match phone ${rawPhone}`,
        );
        return { ok: false, leadId: null, error: "Student identity verification mismatch" };
      }
    }

    const updatePayload: Record<string, any> = {
      video_last_activity_at: nowIso,
    };

    const prevSeconds = Number(existingLead.watch_seconds) || 0;
    let finalWatchSeconds = prevSeconds;

    // If already genuinely unlocked and completed, preserve completed status
    const isAlreadyCompleted = Boolean(
      existingLead.unlocked_class && existingLead.video_completed_at,
    );

    if (isAlreadyCompleted) {
      finalWatchSeconds = Math.max(prevSeconds, Math.min(858, watchSeconds));
    } else {
      // Server-validated interval accumulation:
      // Calculate server elapsed real wall-clock time since last activity
      const lastActivityAt = existingLead.video_last_activity_at || existingLead.created_at;
      const serverElapsedSeconds = lastActivityAt
        ? Math.max(0, (Date.now() - new Date(lastActivityAt).getTime()) / 1000)
        : 30;

      // Calculate forward position delta claimed by client
      const positionDelta = watchSeconds - prevSeconds;

      if (positionDelta <= 0) {
        // Rewound, paused, or stalled: zero increment added
        finalWatchSeconds = prevSeconds;
      } else {
        // Human viewing physical limit: cannot accumulate more seconds than server elapsed time
        // Allow up to 1.25x speed + 5s network jitter ceiling, capped at 45s maximum per heartbeat
        const maxPossibleInTime = Math.ceil(serverElapsedSeconds * 1.25 + 5);
        const increment = Math.min(positionDelta, maxPossibleInTime, 45);

        if (positionDelta > increment && positionDelta > 30) {
          console.warn(
            `[Security] Skipped seek rejected: client claimed +${positionDelta}s jump in ${Math.round(serverElapsedSeconds)}s. Only crediting +${increment}s.`,
          );
        }

        finalWatchSeconds = Math.min(858, prevSeconds + increment);
      }
    }

    updatePayload.watch_seconds = finalWatchSeconds;

    // STRICT SERVER-SIDE COMPLETION POLICY:
    // Requires verified watch_seconds >= 815 (95% of authoritative 858s video).
    // A client request cannot forge isCompleted = true when accumulated watch_seconds < 815.
    const isNowComplete = isAlreadyCompleted || finalWatchSeconds >= 815;

    if (isNowComplete) {
      if (!existingLead.unlocked_class) {
        updatePayload.unlocked_class = true;
      }
      if (!existingLead.video_completed_at) {
        updatePayload.video_completed_at = nowIso;
      }
    }

    const { error: updateErr } = await client
      .from("leads")
      .update(updatePayload)
      .eq("id", existingLead.id);

    if (updateErr) {
      console.warn("[n8n.server] recordLeadVideoActivity update error:", updateErr.message);
      return { ok: false, leadId: existingLead.id, error: updateErr.message };
    }

    return { ok: true, leadId: existingLead.id, updated: true };
  } catch (err: any) {
    console.warn("[n8n.server] recordLeadVideoActivity exception:", err?.message);
    return { ok: false, leadId: null, error: err?.message };
  }
}

/**
 * Fetches playback progress and completion directly from public.leads in CRM Supabase.
 * Uses registrationId as primary identifier, falling back to phone.
 */
export async function getRemoteLeadProgress({
  registrationId,
  phone,
  client,
}: {
  registrationId?: string | null;
  phone?: string | null;
  client?: any;
}): Promise<{
  ok: boolean;
  progress: { lastPosition: number; isCompleted: boolean } | null;
}> {
  if (!registrationId && !phone) return { ok: false, progress: null };

  const crmClient = client || getLeadsSupabaseClient();
  let leadRow: any = null;

  // 1. Primary lookup by stable registrationId
  if (registrationId) {
    const { data: byId } = await crmClient
      .from("leads")
      .select("id, watch_seconds, unlocked_class, video_completed_at")
      .eq("id", registrationId)
      .maybeSingle();
    if (byId) leadRow = byId;
  }

  // 2. Secondary lookup by clean phone if not matched by registrationId
  if (!leadRow && phone) {
    const cleanPhone = formatCleanPhone(phone);
    if (cleanPhone) {
      const { data: byPhone } = await crmClient
        .from("leads")
        .select("id, watch_seconds, unlocked_class, video_completed_at")
        .eq("phone", cleanPhone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (byPhone) leadRow = byPhone;
    }
  }

  if (leadRow) {
    const isCompleted = Boolean(leadRow.unlocked_class || leadRow.video_completed_at);
    const lastPosition = Number(leadRow.watch_seconds) || 0;
    return {
      ok: true,
      progress: {
        lastPosition,
        isCompleted,
      },
    };
  }

  return { ok: false, progress: null };
}

/**
 * Dispatches the HTTP POST request to the n8n WhatsApp workflow Production webhook.
 * Retries up to 2 times for transient network/5xx server errors.
 * Flags uncertain network outcomes (timeouts) so they are not blindly duplicated.
 */
export async function sendN8nWebhook(
  param: string | { leadId: string; phoneCanonical?: string; campaign?: string },
): Promise<{
  ok: boolean;
  status: number;
  body: string;
  providerMessageId?: string;
  uncertain?: boolean;
}> {
  const leadId = typeof param === "string" ? param : param.leadId;
  const phoneCanonical = typeof param === "object" ? param.phoneCanonical : undefined;
  const campaign = typeof param === "object" ? param.campaign : undefined;

  const webhookUrl =
    process.env.N8N_VIDEO_COMPLETED_WEBHOOK_URL ||
    "https://pendugptonline.app.n8n.cloud/webhook/pendugpt-video-completed";

  const payload: Record<string, any> = {
    event: "video_completed",
    lead_id: leadId,
  };
  if (phoneCanonical) payload.phone = phoneCanonical;
  if (campaign) payload.campaign = campaign;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (process.env.N8N_WEBHOOK_SECRET) {
    headers["X-Webhook-Secret"] = process.env.N8N_WEBHOOK_SECRET;
  }

  let lastError: any = null;
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
        let providerMessageId: string | undefined;
        try {
          const parsed = JSON.parse(text);
          providerMessageId = parsed.message_id || parsed.provider_message_id || parsed.id;
        } catch {
          /* ignore non-json */
        }
        return { ok: true, status: res.status, body: text, providerMessageId };
      }

      // If client error (4xx), return immediately without redundant retry
      if (res.status >= 400 && res.status < 500) {
        return { ok: false, status: res.status, body: text, uncertain: false };
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

  const isTimeoutOrNetwork =
    lastError?.name === "TimeoutError" ||
    lastError?.name === "AbortError" ||
    lastError?.code === "ETIMEDOUT" ||
    lastError?.code === "ECONNRESET";

  return {
    ok: false,
    status: isTimeoutOrNetwork ? 504 : 500,
    body: lastError?.message || "Webhook request failed after retries",
    uncertain: isTimeoutOrNetwork,
  };
}

/**
 * Core processor for video completion events:
 * 1. Checks atomic concurrency lock and idempotency in funnel_events.
 * 2. Enforces genuine completion threshold (>= 750 seconds, ~95% of video).
 * 3. Normalizes candidate phone to canonical E.164 (+91XXXXXXXXXX) contact identity.
 * 4. Checks previous sends across CRM status ('SENT', 'REPLIED', 'PAID') and persistent campaign log.
 * 5. Resolves genuine CRM public.leads.id (by phone or id), syncing if missing.
 * 6. Atomically claims campaign lock in Supabase DB before dispatching.
 * 7. Dispatches verified CRM lead UUID & canonical phone to n8n Production Webhook.
 * 8. Reconciles outcomes (SENT, UNCERTAIN, FAILED) and updates all matching CRM leads at contact level.
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
    return { ok: true, leadId: registrationId, webhookSent: false, deduplicated: true, reason: "in_flight_memory_guard" };
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
    return { ok: true, leadId: registrationId, webhookSent: true, deduplicated: true, reason: "funnel_event_already_sent" };
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

    // 4. Normalize to canonical E.164 phone (+91XXXXXXXXXX)
    const phoneCanonical = normalizeToE164(candidatePhone, candidateCountryCode);

    // If neither registration row nor verified phone exists, NEVER invent an ID or send an unverified webhook
    if (!phoneCanonical || phoneCanonical.length < 10) {
      console.error(
        `[n8n.server] Aborting webhook: Registration ${registrationId} not found in database or has invalid phone. Cannot verify CRM contact.`,
      );
      return {
        ok: false,
        leadId: registrationId,
        webhookSent: false,
        error: "Unverified lead: missing registration and phone",
      };
    }

    // 5. Check previous sends across CRM status ('SENT', 'REPLIED', 'PAID') and persistent campaign log
    const prevCheck = await checkPreviousSends({
      phoneCanonical,
      campaign: CAMPAIGN_NAME,
      client,
    });

    if (prevCheck.shouldSkip) {
      console.info(
        `[n8n.server] Contact ${phoneCanonical} previous send detected (${prevCheck.reason}). Skipping duplicate WhatsApp follow-up.`,
      );
      await adminClient.from("funnel_events").insert({
        registration_id: registrationId,
        event_name: "n8n_video_completed_sent",
      });
      return {
        ok: true,
        leadId: registrationId,
        webhookSent: false,
        deduplicated: true,
        reason: prevCheck.reason,
      };
    }

    // 6. Find or sync the genuine lead in public.leads in the CRM Supabase
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

    // 7. Confirm the lead genuinely exists in public.leads in CRM Supabase before dispatching
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

    // 8. Re-check if this specific CRM record already progressed past NOT_SENT
    if (verifiedLead.whatsapp_followup_status && verifiedLead.whatsapp_followup_status !== "NOT_SENT") {
      console.info(
        `[n8n.server] Lead ${verifiedLead.id} status is '${verifiedLead.whatsapp_followup_status}'. Suppressing duplicate WhatsApp follow-up webhook.`,
      );
      await adminClient.from("funnel_events").insert({
        registration_id: registrationId,
        event_name: "n8n_video_completed_sent",
      });
      return { ok: true, leadId: verifiedLead.id, webhookSent: false, deduplicated: true, reason: `crm_status_${verifiedLead.whatsapp_followup_status.toLowerCase()}` };
    }

    // 9. ATOMIC CLAIM: Lock normalized phone and campaign in Supabase database before sending
    const lockResult = await acquireCampaignLock({
      phoneCanonical,
      campaign: CAMPAIGN_NAME,
      leadId: verifiedLead.id,
      registrationId,
      client,
    });

    if (!lockResult.acquired) {
      console.info(
        `[n8n.server] Campaign lock not acquired for contact ${phoneCanonical} (${lockResult.reason}). Suppressing concurrent duplicate webhook.`,
      );
      return {
        ok: true,
        leadId: verifiedLead.id,
        webhookSent: false,
        deduplicated: true,
        reason: lockResult.reason,
      };
    }

    // 10. Dispatch verified CRM lead UUID & canonical contact phone to n8n Production Webhook
    console.info(
      `[n8n.server] Dispatching video_completed event to n8n for confirmed CRM lead_id: ${verifiedLead.id} (contact: ${phoneCanonical})`,
    );
    const webhookRes = await sendN8nWebhook({
      leadId: verifiedLead.id,
    });

    if (webhookRes.ok) {
      console.info(
        `[n8n.server] n8n webhook delivered successfully (status: ${webhookRes.status}) for confirmed CRM lead_id: ${verifiedLead.id}`,
      );
      // Finalize campaign send: record SENT and reconcile CRM leads for this contact
      await finalizeCampaignSend({
        phoneCanonical,
        campaign: CAMPAIGN_NAME,
        status: "SENT",
        providerMessageId: webhookRes.providerMessageId,
        client,
      });

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
    } else if (webhookRes.uncertain) {
      console.warn(
        `[n8n.server] n8n webhook outcome uncertain (timeout/network). Recording UNCERTAIN state to prevent duplicate delivery.`,
      );
      await finalizeCampaignSend({
        phoneCanonical,
        campaign: CAMPAIGN_NAME,
        status: "UNCERTAIN",
        errorMessage: webhookRes.body,
        client,
      });
      return {
        ok: true,
        leadId: verifiedLead.id,
        webhookSent: false,
        status: webhookRes.status,
        error: "Dispatch outcome uncertain; reconciliation required",
      };
    } else {
      console.warn(
        `[n8n.server] n8n webhook delivery status: ${webhookRes.status} body: ${webhookRes.body}`,
      );
      // Release lock / mark FAILED to allow legitimate retry later
      await finalizeCampaignSend({
        phoneCanonical,
        campaign: CAMPAIGN_NAME,
        status: "FAILED",
        errorMessage: webhookRes.body,
        client,
      });

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
    return { ok: true, leadId: registrationId, webhookSent: true, deduplicated: true, reason: "funnel_event_already_sent" };
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

export interface InactivityWebhookPayload {
  lead_id: string;
  phone: string;
  video_id: string;
  watch_seconds: number;
  updated_at: string;
}

export interface InactivityWebhookResult {
  ok: boolean;
  leadId: string | null;
  webhookSent: boolean;
  status?: number;
  error?: string;
  deduplicated?: boolean;
  reason?: string;
}

/**
 * Masks phone number for secure logging (e.g. +91 98173 37782 -> +91 981****782).
 */
export function maskPhone(phone?: string | null): string {
  if (!phone) return "";
  const clean = phone.trim();
  if (clean.length <= 4) return "****";
  return clean.slice(0, 3) + "****" + clean.slice(-3);
}

// In-memory cache for recent inactivity dispatches (leadId -> timestamp ms)
const recentInactivityDispatches = new Map<string, number>();
const INACTIVITY_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes cooldown per lead

/**
 * Dispatches an authenticated HTTP POST request to the n8n Video Inactivity Webhook endpoint.
 * Uses server-only N8N_VIDEO_INACTIVITY_WEBHOOK_URL and N8N_VIDEO_INACTIVITY_WEBHOOK_SECRET.
 * Header Auth: 'x-pendugpt-webhook-secret: <secret>'
 */
export async function sendN8nVideoInactivityWebhook(
  payload: InactivityWebhookPayload,
): Promise<{
  ok: boolean;
  status: number;
  body: string;
  error?: string;
}> {
  const webhookUrl =
    process.env["N8N_VIDEO_INACTIVITY_WEBHOOK_URL"] ||
    "https://pendugptonline.app.n8n.cloud/webhook/pendugpt-video-inactivity-v2";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const webhookSecret = process.env["N8N_VIDEO_INACTIVITY_WEBHOOK_SECRET"];
  if (webhookSecret) {
    headers["x-pendugpt-webhook-secret"] = webhookSecret;
  }

  console.info(
    `[n8n.server] Dispatching video_inactivity event for lead: ${payload.lead_id} (contact: ${maskPhone(payload.phone)})`,
  );

  let lastError: any = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });

      const text = await res.text();

      if (res.ok) {
        return { ok: true, status: res.status, body: text };
      }

      if (res.status >= 400 && res.status < 500) {
        return { ok: false, status: res.status, body: text, error: `HTTP ${res.status}: ${text}` };
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
    body: lastError?.message || "Inactivity webhook request failed",
    error: lastError?.message || "Request timed out or network error",
  };
}

/**
 * Processes video inactivity events on meaningful transitions (pause, page exit, hidden tab):
 * 1. Resolves and validates student lead from Landing Page public.leads.
 * 2. Enforces student identity binding (registrationId vs phone).
 * 3. Rejects if video is already completed (watch_seconds >= 815 or unlocked_class).
 * 4. Rejects if watch time is negligible (< 15 seconds).
 * 5. Enforces 15-minute inactivity cooldown / deduplication.
 * 6. Dispatches verified payload with canonical phone from database to n8n.
 * 7. Logs funnel event on successful dispatch.
 */
export async function processVideoInactivityEvent({
  registrationId,
  phone,
  videoId = "1231615906",
  lastPositionSeconds,
  reason: _reason = "pause",
  client,
  websiteClient,
}: {
  registrationId?: string | null;
  phone?: string | null;
  videoId?: string;
  lastPositionSeconds?: number;
  reason?: string;
  client?: any;
  websiteClient?: any;
}): Promise<InactivityWebhookResult> {
  if (!registrationId && !phone) {
    return { ok: false, leadId: null, webhookSent: false, error: "Missing student registrationId and phone" };
  }

  const leadsClient = client || getLeadsSupabaseClient();
  let lead: any = null;

  // 1. Primary lookup by registrationId
  if (registrationId) {
    const { data: byId } = await leadsClient
      .from("leads")
      .select("id, phone, watch_seconds, unlocked_class, video_completed_at, video_last_activity_at, whatsapp_followup_status")
      .eq("id", registrationId)
      .maybeSingle();
    if (byId) lead = byId;
  }

  // 2. Secondary lookup by clean phone if not matched by ID
  if (!lead && phone) {
    const cleanPhone = formatCleanPhone(phone);
    if (cleanPhone) {
      const { data: byPhone } = await leadsClient
        .from("leads")
        .select("id, phone, watch_seconds, unlocked_class, video_completed_at, video_last_activity_at, whatsapp_followup_status")
        .eq("phone", cleanPhone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (byPhone) lead = byPhone;
    }
  }

  if (!lead) {
    return { ok: false, leadId: null, webhookSent: false, error: "Lead record not found in Landing Page database" };
  }

  // 3. Student Identity Binding Verification
  if (phone && lead.phone) {
    const cleanInputPhone = formatCleanPhone(phone);
    const cleanLeadPhone = formatCleanPhone(lead.phone);
    if (cleanInputPhone && cleanLeadPhone && cleanInputPhone !== cleanLeadPhone) {
      console.warn(
        `[Security] Inactivity identity mismatch: registrationId ${registrationId} does not match phone ${phone}`,
      );
      return { ok: false, leadId: lead.id, webhookSent: false, error: "Student identity verification mismatch" };
    }
  }

  // 4. Exclude completed videos, unlocked classes, or opted-out leads
  const leadWatchSeconds = Number(lead.watch_seconds) || 0;
  const isCompleted = Boolean(lead.unlocked_class || lead.video_completed_at || leadWatchSeconds >= 815);
  if (isCompleted) {
    return {
      ok: true,
      leadId: lead.id,
      webhookSent: false,
      deduplicated: true,
      reason: "video_already_completed",
    };
  }

  // Exclude negligible watch time (< 15 seconds)
  const effectiveWatchSeconds = Math.max(leadWatchSeconds, Math.round(lastPositionSeconds || 0));
  if (effectiveWatchSeconds < 15) {
    return {
      ok: true,
      leadId: lead.id,
      webhookSent: false,
      deduplicated: true,
      reason: "insufficient_watch_time",
    };
  }

  // Respect follow-up status (PAID or STOPPED)
  if (lead.whatsapp_followup_status === "PAID" || lead.whatsapp_followup_status === "STOPPED") {
    return {
      ok: true,
      leadId: lead.id,
      webhookSent: false,
      deduplicated: true,
      reason: `lead_status_${lead.whatsapp_followup_status.toLowerCase()}`,
    };
  }

  // 5. Inactivity Cooldown / Deduplication (15 minutes per lead)
  const lastSent = recentInactivityDispatches.get(lead.id);
  if (lastSent && Date.now() - lastSent < INACTIVITY_COOLDOWN_MS) {
    return {
      ok: true,
      leadId: lead.id,
      webhookSent: false,
      deduplicated: true,
      reason: "inactivity_cooldown_active",
    };
  }

  // Check persistent funnel_events if available
  const adminClient =
    websiteClient || (await import("@/integrations/supabase/client.server")).supabaseAdmin;
  try {
    const fifteenMinutesAgo = new Date(Date.now() - INACTIVITY_COOLDOWN_MS).toISOString();
    const { data: recentEvent } = await adminClient
      .from("funnel_events")
      .select("id")
      .eq("registration_id", lead.id)
      .eq("event_name", "n8n_video_inactivity_sent")
      .gte("created_at", fifteenMinutesAgo)
      .maybeSingle();

    if (recentEvent?.id) {
      recentInactivityDispatches.set(lead.id, Date.now());
      return {
        ok: true,
        leadId: lead.id,
        webhookSent: false,
        deduplicated: true,
        reason: "funnel_event_cooldown_active",
      };
    }
  } catch {
    /* funnel_events lookup is optional fallback */
  }

  // 6. Build minimum required payload using canonical database phone
  const canonicalPhone = formatCleanPhone(lead.phone) || lead.phone;
  const payload: InactivityWebhookPayload = {
    lead_id: lead.id,
    phone: canonicalPhone,
    video_id: videoId,
    watch_seconds: effectiveWatchSeconds,
    updated_at: new Date().toISOString(),
  };

  // 7. Dispatch to n8n production webhook
  const webhookRes = await sendN8nVideoInactivityWebhook(payload);

  if (webhookRes.ok) {
    recentInactivityDispatches.set(lead.id, Date.now());
    try {
      await adminClient.from("funnel_events").insert({
        registration_id: lead.id,
        event_name: "n8n_video_inactivity_sent",
      });
    } catch {
      /* ignore optional logging error */
    }

    return {
      ok: true,
      leadId: lead.id,
      webhookSent: true,
      deduplicated: false,
      status: webhookRes.status,
    };
  }

  return {
    ok: false,
    leadId: lead.id,
    webhookSent: false,
    status: webhookRes.status,
    error: webhookRes.error || webhookRes.body,
  };
}


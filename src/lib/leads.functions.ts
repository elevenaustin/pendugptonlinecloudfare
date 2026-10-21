import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Registration schema for Phase 1 funnel with international country code support.
 */
export const registrationSchema = z.object({
  countryCode: z.string().default("+91"),
  whatsapp: z
    .string()
    .trim()
    .transform((val) => val.replace(/\D/g, ""))
    .refine((val) => val.length >= 6 && val.length <= 15, {
      message: "Please enter a valid mobile number",
    }),
  gender: z.string().optional(),
  device: z.string().optional(),
  marketingConsent: z.boolean().default(false),
});

export type RegistrationInput = z.infer<typeof registrationSchema>;

export const checkExistingContactSchema = z.object({
  countryCode: z.string().default("+91"),
  whatsapp: z.string().trim().min(6, "Please enter a valid mobile number"),
});

export type CheckExistingContactInput = z.infer<typeof checkExistingContactSchema>;

/**
 * Core business logic to check if a contact is already registered and retrieve saved video progress.
 */
export async function executeCheckExistingContact({
  countryCode = "+91",
  whatsapp,
  supabaseClient,
  crmClientOverride,
}: {
  countryCode?: string;
  whatsapp: string;
  supabaseClient?: any;
  crmClientOverride?: any;
}) {
  const rawWhatsapp = (whatsapp || "").replace(/\D/g, "");
  if (!rawWhatsapp || rawWhatsapp.length < 6) {
    return { exists: false, lastPositionSeconds: 0, isCompleted: false };
  }

  try {
    const { normalizeToE164, formatCleanPhone, getLeadsSupabaseClient } = await import("./n8n.server");
    const canonicalPhone = normalizeToE164(rawWhatsapp, countryCode);
    const cleanPhone = formatCleanPhone(rawWhatsapp, countryCode);

    let supabaseAdmin = supabaseClient;
    if (!supabaseAdmin) {
      const dbModule = await import("@/integrations/supabase/client.server");
      supabaseAdmin = dbModule.supabaseAdmin;
    }

    // 1. Primary lookup in website registrations
    const phoneFilter = cleanPhone !== rawWhatsapp
      ? `phone_number.eq.${rawWhatsapp},phone_number.eq.${cleanPhone}`
      : `phone_number.eq.${rawWhatsapp}`;

    const { data: regRows } = await supabaseAdmin
      .from("registrations")
      .select("id, phone_country_code, phone_number, gender, device_availability, created_at, video_progress(last_position_seconds, completion_status)")
      .or(phoneFilter)
      .order("created_at", { ascending: false })
      .limit(1);

    const reg = regRows && regRows.length > 0 ? regRows[0] : null;

    // 2. Lookup in CRM public.leads
    let crmLead: any = null;
    try {
      const crmClient = crmClientOverride || getLeadsSupabaseClient();
      const phoneCandidates = Array.from(new Set([canonicalPhone, cleanPhone, rawWhatsapp])).filter(Boolean);
      const { data: leadRows } = await crmClient
        .from("leads")
        .select("id, phone, watch_seconds, unlocked_class, video_completed_at, gender, has_laptop")
        .in("phone", phoneCandidates)
        .order("created_at", { ascending: false })
        .limit(1);

      if (leadRows && leadRows.length > 0) {
        crmLead = leadRows[0];
      }
    } catch (crmErr) {
      console.warn("[checkExistingContact] CRM lead lookup notice:", crmErr);
    }

    // If either record was found, the contact is already registered
    if (reg || crmLead) {
      const vidProgress = reg?.video_progress
        ? Array.isArray(reg.video_progress)
          ? reg.video_progress[0]
          : reg.video_progress
        : null;

      const vidSec = Number(vidProgress?.last_position_seconds) || 0;
      const crmSec = Number(crmLead?.watch_seconds) || 0;
      const lastPositionSeconds = Math.max(vidSec, crmSec);

      const isCompleted = Boolean(
        vidProgress?.completion_status ||
        crmLead?.unlocked_class ||
        crmLead?.video_completed_at ||
        lastPositionSeconds >= 815,
      );

      return {
        exists: true,
        registrationId: reg?.id || crmLead?.id || null,
        lastPositionSeconds,
        isCompleted,
        gender: reg?.gender || crmLead?.gender || null,
        device: reg?.device_availability || crmLead?.has_laptop || null,
        message: isCompleted
          ? "You have already completed the training video! Redirecting to class fee options..."
          : "This contact is already registered. Resuming your video training where you left off...",
      };
    }

    return {
      exists: false,
      lastPositionSeconds: 0,
      isCompleted: false,
    };
  } catch (err: any) {
    console.warn("[checkExistingContact] Exception:", err?.message);
    return {
      exists: false,
      lastPositionSeconds: 0,
      isCompleted: false,
    };
  }
}

/**
 * Server function to check if a contact is already registered and retrieve saved video progress.
 * If contact exists, prevents duplicate detail submission and enables session resume.
 */
export const checkExistingContact = createServerFn({ method: "POST" })
  .validator((data: unknown) => checkExistingContactSchema.parse(data))
  .handler(async ({ data }) => {
    return executeCheckExistingContact(data);
  });

/**
 * Server function to register training attendees.
 */
export const submitRegistration = createServerFn({ method: "POST" })
  .validator((data: unknown) => registrationSchema.parse(data))
  .handler(async ({ data }) => {
    let registrationId: string | undefined;
    const countryCode = data.countryCode || "+91";
    const phone = data.whatsapp;

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // Check if registration already exists for this phone number to prevent duplicate clutter
      const { data: existing } = await supabaseAdmin
        .from("registrations")
        .select("id")
        .eq("phone_country_code", countryCode)
        .eq("phone_number", phone)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        registrationId = existing.id;
        // Update device or gender if provided
        await supabaseAdmin
          .from("registrations")
          .update({
            gender: data.gender || null,
            device_availability: data.device || null,
          })
          .eq("id", registrationId);
      } else {
        // Insert new registration
        const { data: regData, error } = await supabaseAdmin
          .from("registrations")
          .insert({
            phone_country_code: countryCode,
            phone_number: phone,
            gender: data.gender || null,
            device_availability: data.device || null,
          })
          .select("id")
          .single();

        if (error) {
          console.error("Supabase registration insert notice:", error.message);
        } else if (regData?.id) {
          registrationId = regData.id;
        }
      }

      // Log funnel event
      if (registrationId) {
        await supabaseAdmin.from("funnel_events").insert({
          registration_id: registrationId,
          event_name: "registration_completed",
        });

        // Ensure lead record is synced to public.leads in Supabase
        try {
          const { syncOrFindLeadRecord } = await import("./n8n.server");
          await syncOrFindLeadRecord({
            registrationId,
            phone,
            countryCode,
            gender: data.gender,
            device: data.device,
            watchSeconds: 0,
            isCompleted: false,
          });
        } catch (crmErr) {
          console.warn("[submitRegistration] CRM lead sync notice:", crmErr);
        }
      }
    } catch (err) {
      console.warn("Server registration handler notice:", err);
    }

    return {
      ok: true,
      registrationId,
      registeredAt: new Date().toISOString(),
      whatsappSuffix: data.whatsapp.slice(-4),
    };
  });

/**
 * General lead schema preserved for masterclass inquiries.
 */
export const leadSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your name").max(100),
  whatsapp: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{6,16}$/, "Enter a valid WhatsApp number"),
  email: z.string().trim().email("Enter a valid email").max(255).optional().or(z.literal("")),
  interest: z.enum(["recorded", "live", "general"]),
  consent: z.literal(true, { errorMap: () => ({ message: "Please tick the consent box" }) }),
});

export type LeadInput = z.infer<typeof leadSchema>;

export const submitLead = createServerFn({ method: "POST" })
  .validator((data: unknown) => leadSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.from("leads").insert({
        full_name: data.fullName,
        whatsapp: data.whatsapp.replace(/[\s-]/g, ""),
        email: data.email || null,
        interest: data.interest,
        consent: data.consent,
      });
      if (error) {
        console.error("Lead insertion failed:", error.message);
      }
    } catch (err) {
      console.warn("Submit lead running in preview/unconfigured mode:", err);
    }
    return { ok: true };
  });

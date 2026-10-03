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

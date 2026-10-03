import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const paymentRecordSchema = z.object({
  paymentId: z.string().min(1, "Payment ID is required"),
  orderId: z.string().optional(),
  signature: z.string().optional(),
  amount: z.string(),
  numericAmount: z.number(),
  track: z.enum(["live", "recorded"]),
  trackName: z.string(),
  fullName: z.string().default("PenduGPT Learner"),
  whatsapp: z.string().min(6, "Valid WhatsApp number is required"),
  email: z.string().optional(),
  timestamp: z.string(),
});

export type PaymentRecordInput = z.infer<typeof paymentRecordSchema>;

/**
 * Server function to record successfully captured Razorpay payments.
 */
export const recordPayment = createServerFn({ method: "POST" })
  .validator((data: unknown) => paymentRecordSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error } = await supabaseAdmin.from("leads").insert({
        full_name: data.fullName || "PenduGPT Paid Learner",
        whatsapp: data.whatsapp.replace(/[\s-]/g, ""),
        email: data.email || null,
        interest: `${data.track}_paid_${data.paymentId}_₹${data.numericAmount}`,
        consent: true,
      });

      if (error) {
        console.error("Supabase payment lead record error:", error.message);
      }
    } catch (err) {
      console.warn("Payment recording running in local/preview mode:", err);
    }

    return {
      ok: true,
      recordedAt: new Date().toISOString(),
      transactionId: data.paymentId,
    };
  });

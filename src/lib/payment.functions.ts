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

export const createOrderSchema = z.object({
  amountInPaise: z.number().positive(),
  track: z.enum(["live", "recorded"]),
  trackName: z.string(),
  phone: z.string(),
});

/**
 * Server function to securely create an official Razorpay Order ID.
 */
export const createRazorpayOrder = createServerFn({ method: "POST" })
  .validator((data: unknown) => createOrderSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      const { siteConfig } = await import("@/config/site");
      const keyId =
        process.env.RAZORPAY_KEY_ID ||
        process.env.VITE_RAZORPAY_KEY_ID ||
        siteConfig.razorpay.keyId;
      const secretKey =
        process.env.RAZORPAY_KEY_SECRET ||
        (siteConfig.razorpay as any).secretKey ||
        "1ofBzwOCAqLPn7M6iQG616hx";

      const auth = Buffer.from(`${keyId}:${secretKey}`).toString("base64");
      const receipt = `rcpt_${data.track}_${Date.now()}`.slice(0, 40);

      const res = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: data.amountInPaise,
          currency: "INR",
          receipt: receipt,
          notes: {
            course: data.track,
            courseName: data.trackName,
            phone: data.phone,
          },
        }),
      });

      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as any;
        console.error("Razorpay order API error:", errJson);
        return {
          ok: false,
          error: errJson.error?.description || "Order creation failed on Razorpay",
          orderId: undefined,
          keyId: keyId,
        };
      }

      const order = (await res.json()) as any;
      return {
        ok: true,
        orderId: order.id as string,
        amount: order.amount as number,
        currency: order.currency as string,
        keyId: keyId,
      };
    } catch (err: any) {
      console.error("createRazorpayOrder internal error:", err);
      return {
        ok: false,
        error: err.message || "Unable to contact Razorpay server",
        orderId: undefined,
        keyId: "rzp_live_TjWspxG8PkRKlr",
      };
    }
  });

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


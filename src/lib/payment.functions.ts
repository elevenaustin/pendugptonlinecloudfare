import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import crypto from "crypto";

export const paymentRecordSchema = z.object({
  registrationId: z.string().uuid().optional().nullable(),
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
  registrationId: z.string().uuid().optional().nullable(),
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
        process.env.RAZORPAY_KEY_SECRET || "1ofBzwOCAqLPn7M6iQG616hx";

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

      // Log pending order into Supabase
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("orders").insert({
          registration_id: data.registrationId || null,
          selected_option: data.track,
          amount: data.amountInPaise / 100,
          currency: "INR",
          razorpay_order_id: order.id,
          payment_status: "pending",
        });

        await supabaseAdmin.from("funnel_events").insert({
          registration_id: data.registrationId || null,
          event_name: `order_initiated_${data.track}`,
        });
      } catch (dbErr) {
        console.warn("Orders table logging notice:", dbErr);
      }

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
 * Server function to record and verify successfully captured Razorpay payments.
 * Strictly verifies cryptographic HMAC-SHA256 signature and/or Razorpay API status.
 */
export const recordPayment = createServerFn({ method: "POST" })
  .validator((data: unknown) => paymentRecordSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      const { siteConfig } = await import("@/config/site");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const keyId =
        process.env.RAZORPAY_KEY_ID ||
        process.env.VITE_RAZORPAY_KEY_ID ||
        siteConfig.razorpay.keyId;
      const secretKey =
        process.env.RAZORPAY_KEY_SECRET || "1ofBzwOCAqLPn7M6iQG616hx";

      // 1. Verify Payment Signature
      let isVerified = false;

      if (data.signature && data.orderId) {
        const expectedSignature = crypto
          .createHmac("sha256", secretKey)
          .update(`${data.orderId}|${data.paymentId}`)
          .digest("hex");

        try {
          isVerified = crypto.timingSafeEqual(
            Buffer.from(expectedSignature, "utf-8"),
            Buffer.from(data.signature, "utf-8"),
          );
        } catch {
          isVerified = false;
        }
      }

      // 2. Direct API verification fallback
      if (!isVerified) {
        try {
          const auth = Buffer.from(`${keyId}:${secretKey}`).toString("base64");
          const apiRes = await fetch(
            `https://api.razorpay.com/v1/payments/${encodeURIComponent(data.paymentId)}`,
            {
              headers: { Authorization: `Basic ${auth}` },
            },
          );

          if (apiRes.ok) {
            const paymentDetails = (await apiRes.json()) as any;
            if (
              (paymentDetails.status === "captured" || paymentDetails.status === "authorized") &&
              (data.orderId ? paymentDetails.order_id === data.orderId : true)
            ) {
              isVerified = true;
            }
          }
        } catch (apiErr) {
          console.warn("Direct Razorpay verification notice:", apiErr);
        }
      }

      if (!isVerified) {
        console.error("Payment signature verification failed for paymentId:", data.paymentId);
        return {
          ok: false,
          error: "Payment verification failed. Untrusted signature or unconfirmed transaction.",
        };
      }

      // 3. Update or Insert into public.orders table with captured status
      if (data.orderId) {
        await supabaseAdmin
          .from("orders")
          .update({
            registration_id: data.registrationId || undefined,
            razorpay_payment_id: data.paymentId,
            payment_status: "captured",
            updated_at: new Date().toISOString(),
          })
          .eq("razorpay_order_id", data.orderId);
      } else {
        await supabaseAdmin.from("orders").insert({
          registration_id: data.registrationId || null,
          selected_option: data.track,
          amount: data.numericAmount,
          currency: "INR",
          razorpay_payment_id: data.paymentId,
          payment_status: "captured",
        });
      }

      // 4. Log verified funnel event
      await supabaseAdmin.from("funnel_events").insert({
        registration_id: data.registrationId || null,
        event_name: `payment_captured_${data.track}`,
      });

      return {
        ok: true,
        recordedAt: new Date().toISOString(),
        transactionId: data.paymentId,
      };
    } catch (err: any) {
      console.warn("Payment recording error:", err);
      return {
        ok: false,
        error: err.message || "Failed to record payment verification",
      };
    }
  });

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

        // Resolve registration ID if missing
        let resolvedRegId = data.registrationId;
        if (!resolvedRegId && data.phone) {
          const cleanDigits = data.phone.replace(/\D/g, "");
          if (cleanDigits.length >= 6) {
            const { data: matchedReg } = await supabaseAdmin
              .from("registrations")
              .select("id")
              .ilike("phone_number", `%${cleanDigits.slice(-10)}%`)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (matchedReg?.id) {
              resolvedRegId = matchedReg.id;
            }
          }
        }

        await supabaseAdmin.from("orders").insert({
          registration_id: resolvedRegId || null,
          selected_option: data.track,
          amount: data.amountInPaise / 100,
          currency: "INR",
          razorpay_order_id: order.id,
          payment_status: "pending",
        });

        if (resolvedRegId) {
          await supabaseAdmin.from("funnel_events").insert({
            registration_id: resolvedRegId,
            event_name: `order_initiated_${data.track}`,
          });
        }
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
      let fetchedPaymentDetails: any = null;
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
            fetchedPaymentDetails = (await apiRes.json()) as any;
            if (
              fetchedPaymentDetails.status === "captured" ||
              fetchedPaymentDetails.status === "authorized"
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

      // 3. Resolve registration ID by phone number if not supplied directly
      let resolvedRegId = data.registrationId;
      if (!resolvedRegId) {
        const rawPhone = data.whatsapp || fetchedPaymentDetails?.contact || "";
        const cleanDigits = rawPhone.replace(/\D/g, "");
        if (cleanDigits.length >= 6) {
          const { data: matchedReg } = await supabaseAdmin
            .from("registrations")
            .select("id")
            .ilike("phone_number", `%${cleanDigits.slice(-10)}%`)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (matchedReg?.id) {
            resolvedRegId = matchedReg.id;
          }
        }
      }

      // 4. Update or Insert into public.orders table with captured status (UPSERT / FALLBACK)
      const { data: existingPayment } = await supabaseAdmin
        .from("orders")
        .select("id")
        .eq("razorpay_payment_id", data.paymentId)
        .maybeSingle();

      if (existingPayment?.id) {
        // Update existing row
        await supabaseAdmin
          .from("orders")
          .update({
            registration_id: resolvedRegId || undefined,
            selected_option: data.track,
            amount: data.numericAmount,
            payment_status: "captured",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingPayment.id);
      } else {
        // Check if pending order with order_id exists
        let updatedOrder = false;
        if (data.orderId) {
          const { data: matchedByOrder } = await supabaseAdmin
            .from("orders")
            .select("id")
            .eq("razorpay_order_id", data.orderId)
            .maybeSingle();

          if (matchedByOrder?.id) {
            await supabaseAdmin
              .from("orders")
              .update({
                registration_id: resolvedRegId || undefined,
                razorpay_payment_id: data.paymentId,
                payment_status: "captured",
                updated_at: new Date().toISOString(),
              })
              .eq("id", matchedByOrder.id);
            updatedOrder = true;
          }
        }

        // If not updated, INSERT as a new captured order
        if (!updatedOrder) {
          await supabaseAdmin.from("orders").insert({
            registration_id: resolvedRegId || null,
            selected_option: data.track,
            amount: data.numericAmount,
            currency: "INR",
            razorpay_order_id: data.orderId || null,
            razorpay_payment_id: data.paymentId,
            payment_status: "captured",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }

      // 5. Update Registration Lead Status to 'converted' & Log funnel events
      if (resolvedRegId) {
        try {
          await supabaseAdmin
            .from("registrations")
            .update({
              lead_status: "converted",
              is_read: true,
              last_contacted_at: new Date().toISOString(),
            })
            .eq("id", resolvedRegId);
        } catch {
          /* column fallback */
        }

        await supabaseAdmin.from("funnel_events").insert([
          {
            registration_id: resolvedRegId,
            event_name: `payment_captured_${data.track}`,
          },
          {
            registration_id: resolvedRegId,
            event_name: "admin_status:converted",
          },
        ]);
      }

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

/**
 * Server function to reconcile and sync all live captured payments from Razorpay (ADMIN ONLY).
 */
export const syncRazorpayPayments = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        authToken: z.string().min(1, "Authentication token is required"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    try {
      const { assertAdminAuth } = await import("@/lib/admin.functions");
      await assertAdminAuth(data.authToken);

      const { siteConfig } = await import("@/config/site");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const keyId =
        process.env.RAZORPAY_KEY_ID ||
        process.env.VITE_RAZORPAY_KEY_ID ||
        siteConfig.razorpay.keyId;
      const secretKey =
        process.env.RAZORPAY_KEY_SECRET || "1ofBzwOCAqLPn7M6iQG616hx";

      const auth = Buffer.from(`${keyId}:${secretKey}`).toString("base64");
      const res = await fetch("https://api.razorpay.com/v1/payments?count=50", {
        headers: { Authorization: `Basic ${auth}` },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch payments from Razorpay API");
      }

      const rzpData = (await res.json()) as any;
      const items = (rzpData.items || []).filter(
        (p: any) => p.status === "captured" || p.status === "authorized",
      );

      let syncedCount = 0;
      let newCount = 0;

      for (const p of items) {
        syncedCount++;
        const paymentId = p.id;
        const amountRupees = Number(p.amount) / 100;
        const contact = p.contact ? p.contact.replace(/\D/g, "") : "";
        const desc = (p.description || "").toLowerCase();

        let track: "live" | "recorded" = "recorded";
        if (amountRupees > 3000 || desc.includes("live") || desc.includes("option 1")) {
          track = "live";
        }

        // Check if already in orders table
        const { data: existing } = await supabaseAdmin
          .from("orders")
          .select("id, registration_id")
          .eq("razorpay_payment_id", paymentId)
          .maybeSingle();

        // Match registration by phone
        let regId: string | null = existing?.registration_id || null;
        if (!regId && contact.length >= 6) {
          const { data: matchedReg } = await supabaseAdmin
            .from("registrations")
            .select("id")
            .ilike("phone_number", `%${contact.slice(-10)}%`)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (matchedReg?.id) {
            regId = matchedReg.id;
          }
        }

        const createdAtIso = new Date(p.created_at * 1000).toISOString();

        if (existing?.id) {
          if (!existing.registration_id && regId) {
            await supabaseAdmin
              .from("orders")
              .update({ registration_id: regId })
              .eq("id", existing.id);
          }
        } else {
          newCount++;
          await supabaseAdmin.from("orders").insert({
            registration_id: regId,
            selected_option: track,
            amount: amountRupees,
            currency: p.currency || "INR",
            razorpay_order_id: p.order_id || null,
            razorpay_payment_id: paymentId,
            payment_status: "captured",
            created_at: createdAtIso,
            updated_at: new Date().toISOString(),
          });
        }

        // Update lead status to converted
        if (regId) {
          try {
            await supabaseAdmin
              .from("registrations")
              .update({
                lead_status: "converted",
                is_read: true,
              })
              .eq("id", regId);
          } catch {
            /* column fallback */
          }

          await supabaseAdmin.from("funnel_events").insert({
            registration_id: regId,
            event_name: `payment_captured_${track}`,
          });
        }
      }

      return {
        ok: true,
        syncedCount,
        newCount,
      };
    } catch (err: any) {
      console.error("Razorpay sync error:", err);
      return {
        ok: false,
        error: err.message || "Failed to sync Razorpay payments",
      };
    }
  });

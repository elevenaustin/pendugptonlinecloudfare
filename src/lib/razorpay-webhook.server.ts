import crypto from "crypto";
import { siteConfig } from "@/config/site";

/**
 * Server-side handler for Razorpay Webhooks.
 * Validates HMAC-SHA256 signatures, manages order statuses, and ensures idempotent handling.
 */
export async function handleRazorpayWebhook(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const signature = request.headers.get("x-razorpay-signature");
  if (!signature) {
    console.error("Razorpay webhook rejected: Missing x-razorpay-signature header");
    return new Response(JSON.stringify({ error: "Missing signature header" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawBody = await request.text();
  const webhookSecret =
    process.env.RAZORPAY_WEBHOOK_SECRET ||
    process.env.RAZORPAY_KEY_SECRET ||
    "1ofBzwOCAqLPn7M6iQG616hx";

  // 1. Verify HMAC-SHA256 Signature using timing-safe comparison
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  let isValid = false;
  try {
    isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "utf-8"),
      Buffer.from(signature, "utf-8"),
    );
  } catch {
    isValid = false;
  }

  if (!isValid) {
    console.error("Razorpay webhook rejected: Invalid signature verification failed");
    return new Response(JSON.stringify({ error: "Invalid webhook signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. Parse Webhook Event Payload
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const eventName = payload.event;
  const paymentEntity = payload.payload?.payment?.entity;
  const orderEntity = payload.payload?.order?.entity;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  try {
    // Event: payment.captured or order.paid
    if (eventName === "payment.captured" || eventName === "order.paid") {
      const orderId = paymentEntity?.order_id || orderEntity?.id || null;
      const paymentId = paymentEntity?.id;
      const amount = paymentEntity?.amount ? paymentEntity.amount / 100 : 2499;
      const contact = paymentEntity?.contact ? paymentEntity.contact.replace(/\D/g, "") : "";
      const desc = (paymentEntity?.description || "").toLowerCase();

      let track: "live" | "recorded" = "recorded";
      if (amount > 3000 || desc.includes("live") || desc.includes("option 1")) {
        track = "live";
      }

      // Check if registration exists by phone
      let regId: string | null = null;
      if (contact.length >= 6) {
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

      // Check if order already recorded by paymentId
      const { data: existingPayment } = await supabaseAdmin
        .from("orders")
        .select("id, payment_status")
        .eq("razorpay_payment_id", paymentId)
        .maybeSingle();

      if (existingPayment?.id) {
        // Idempotency: already marked as captured
        return new Response(JSON.stringify({ received: true, idempotent: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Check if pending order by order_id exists
      let updated = false;
      if (orderId) {
        const { data: existingOrder } = await supabaseAdmin
          .from("orders")
          .select("id")
          .eq("razorpay_order_id", orderId)
          .maybeSingle();

        if (existingOrder?.id) {
          await supabaseAdmin
            .from("orders")
            .update({
              registration_id: regId || undefined,
              razorpay_payment_id: paymentId,
              payment_status: "captured",
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingOrder.id);
          updated = true;
        }
      }

      // If not updated from pending, insert new captured order
      if (!updated) {
        await supabaseAdmin.from("orders").insert({
          registration_id: regId,
          selected_option: track,
          amount: amount,
          currency: paymentEntity?.currency || "INR",
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          payment_status: "captured",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      // Update lead status & log event
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

    // Event: payment.failed
    if (eventName === "payment.failed") {
      const orderId = paymentEntity?.order_id;
      if (orderId) {
        await supabaseAdmin
          .from("orders")
          .update({
            payment_status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("razorpay_order_id", orderId);

        await supabaseAdmin.from("funnel_events").insert({
          event_name: "webhook_payment_failed",
        });
      }
    }

    // Event: refund.created or refund.processed
    if (eventName === "refund.created" || eventName === "refund.processed") {
      const paymentId = payload.payload?.refund?.entity?.payment_id;
      if (paymentId) {
        await supabaseAdmin
          .from("orders")
          .update({
            payment_status: "refunded",
            updated_at: new Date().toISOString(),
          })
          .eq("razorpay_payment_id", paymentId);
      }
    }

    return new Response(JSON.stringify({ received: true, event: eventName }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (dbErr: any) {
    console.error("Razorpay webhook database error:", dbErr);
    return new Response(JSON.stringify({ error: "Internal processing error", detail: dbErr.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

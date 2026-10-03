import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Server function to fetch real-time overview metrics from Supabase.
 */
export const getAdminOverviewMetrics = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Total registrations
    const { count: totalRegistrations, error: regErr } = await supabaseAdmin
      .from("registrations")
      .select("*", { count: "exact", head: true });

    // 2. Training videos completed
    const { count: videosCompleted, error: vidErr } = await supabaseAdmin
      .from("video_progress")
      .select("*", { count: "exact", head: true })
      .eq("completion_status", true);

    // 3. Option selections (from orders / funnel_events)
    const { count: liveOptionSelected } = await supabaseAdmin
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("selected_option", "live");

    const { count: recordedOptionSelected } = await supabaseAdmin
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("selected_option", "recorded");

    // 4. Total orders created & captured
    const { count: totalOrderAttempts } = await supabaseAdmin
      .from("orders")
      .select("*", { count: "exact", head: true });

    const { data: capturedOrders, error: ordersErr } = await supabaseAdmin
      .from("orders")
      .select("amount")
      .eq("payment_status", "captured");

    const verifiedPaymentsCount = capturedOrders?.length || 0;
    const totalVerifiedRevenue =
      capturedOrders?.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) || 0;

    // 5. Recent 5 orders
    const { data: recentOrders } = await supabaseAdmin
      .from("orders")
      .select("id, selected_option, amount, currency, payment_status, created_at, razorpay_payment_id")
      .order("created_at", { ascending: false })
      .limit(5);

    // 6. Recent 5 registrations
    const { data: recentRegistrations } = await supabaseAdmin
      .from("registrations")
      .select("id, phone_country_code, phone_number, device_availability, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    return {
      ok: true,
      data: {
        totalRegistrations: totalRegistrations || 0,
        videosCompleted: videosCompleted || 0,
        liveOptionSelected: liveOptionSelected || 0,
        recordedOptionSelected: recordedOptionSelected || 0,
        totalOrderAttempts: totalOrderAttempts || 0,
        verifiedPaymentsCount,
        totalVerifiedRevenue,
        recentOrders: recentOrders || [],
        recentRegistrations: recentRegistrations || [],
      },
    };
  } catch (err: any) {
    console.error("Admin overview fetch error:", err);
    return {
      ok: false,
      error: err.message || "Unable to load dashboard overview",
      data: {
        totalRegistrations: 0,
        videosCompleted: 0,
        liveOptionSelected: 0,
        recordedOptionSelected: 0,
        totalOrderAttempts: 0,
        verifiedPaymentsCount: 0,
        totalVerifiedRevenue: 0,
        recentOrders: [],
        recentRegistrations: [],
      },
    };
  }
});

/**
 * Filter schema for registrations table query
 */
export const registrationsFilterSchema = z.object({
  search: z.string().optional(),
  completedOnly: z.enum(["all", "completed", "in_progress"]).default("all"),
  selectedOption: z.enum(["all", "live", "recorded", "none"]).default("all"),
  device: z.enum(["all", "laptop", "desktop", "mobile"]).default("all"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(5).max(100).default(20),
});

/**
 * Server function to fetch paginated & filtered registrations with joined video progress & orders.
 */
export const getAdminRegistrations = createServerFn({ method: "POST" })
  .validator((data: unknown) => registrationsFilterSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const offset = (data.page - 1) * data.pageSize;

      // Base query
      let query = supabaseAdmin.from("registrations").select(
        `
        id,
        phone_country_code,
        phone_number,
        gender,
        device_availability,
        created_at,
        video_progress(last_position_seconds, completion_status, updated_at),
        orders(id, selected_option, amount, payment_status, created_at, razorpay_payment_id)
      `,
        { count: "exact" },
      );

      // Search filter (phone number or ID)
      if (data.search?.trim()) {
        const s = data.search.trim().replace(/\D/g, "");
        if (s.length > 0) {
          query = query.ilike("phone_number", `%${s}%`);
        } else {
          query = query.ilike("id", `%${data.search.trim()}%`);
        }
      }

      // Device filter
      if (data.device !== "all") {
        query = query.ilike("device_availability", `%${data.device}%`);
      }

      // Order by created_at desc
      query = query.order("created_at", { ascending: false }).range(offset, offset + data.pageSize - 1);

      const { data: rows, count, error } = await query;
      if (error) throw error;

      // Post-process rows
      const items = (rows || []).map((r: any) => {
        const vid = Array.isArray(r.video_progress) ? r.video_progress[0] : r.video_progress;
        const ords = Array.isArray(r.orders) ? r.orders : r.orders ? [r.orders] : [];
        const latestOrder = ords.sort(
          (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )[0];

        return {
          id: r.id,
          phoneCountryCode: r.phone_country_code || "+91",
          phoneNumber: r.phone_number,
          fullPhone: `${r.phone_country_code || "+91"} ${r.phone_number}`,
          gender: r.gender || "—",
          deviceAvailability: r.device_availability || "—",
          createdAt: r.created_at,
          videoProgressSeconds: vid?.last_position_seconds || 0,
          videoCompleted: Boolean(vid?.completion_status),
          selectedOption: latestOrder?.selected_option || "—",
          paymentStatus: latestOrder?.payment_status || "—",
          amount: latestOrder?.amount || null,
          razorpayPaymentId: latestOrder?.razorpay_payment_id || null,
        };
      });

      return {
        ok: true,
        items,
        total: count || 0,
        page: data.page,
        pageSize: data.pageSize,
        totalPages: Math.ceil((count || 0) / data.pageSize) || 1,
      };
    } catch (err: any) {
      console.error("Registrations fetch error:", err);
      return {
        ok: false,
        error: err.message || "Failed to fetch registrations",
        items: [],
        total: 0,
        page: 1,
        pageSize: data.pageSize,
        totalPages: 1,
      };
    }
  });

/**
 * Filter schema for orders table query
 */
export const ordersFilterSchema = z.object({
  search: z.string().optional(),
  status: z.enum(["all", "captured", "pending", "failed"]).default("all"),
  selectedOption: z.enum(["all", "live", "recorded"]).default("all"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(5).max(100).default(20),
});

/**
 * Server function to fetch paginated & filtered orders.
 */
export const getAdminOrders = createServerFn({ method: "POST" })
  .validator((data: unknown) => ordersFilterSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const offset = (data.page - 1) * data.pageSize;

      let query = supabaseAdmin.from("orders").select(
        `
        id,
        registration_id,
        selected_option,
        amount,
        currency,
        razorpay_order_id,
        razorpay_payment_id,
        payment_status,
        created_at,
        updated_at,
        registrations(phone_country_code, phone_number, gender, device_availability)
      `,
        { count: "exact" },
      );

      // Status filter
      if (data.status !== "all") {
        query = query.eq("payment_status", data.status);
      }

      // Option filter
      if (data.selectedOption !== "all") {
        query = query.eq("selected_option", data.selectedOption);
      }

      // Search filter (Payment ID, Order ID, or Registration ID)
      if (data.search?.trim()) {
        const s = data.search.trim();
        query = query.or(
          `razorpay_payment_id.ilike.%${s}%,razorpay_order_id.ilike.%${s}%,id.ilike.%${s}%`,
        );
      }

      query = query.order("created_at", { ascending: false }).range(offset, offset + data.pageSize - 1);

      const { data: rows, count, error } = await query;
      if (error) throw error;

      const items = (rows || []).map((ord: any) => {
        const reg = Array.isArray(ord.registrations) ? ord.registrations[0] : ord.registrations;
        return {
          id: ord.id,
          registrationId: ord.registration_id,
          customerPhone: reg ? `${reg.phone_country_code || "+91"} ${reg.phone_number}` : "—",
          selectedOption: ord.selected_option,
          amount: ord.amount,
          currency: ord.currency || "INR",
          razorpayOrderId: ord.razorpay_order_id || "—",
          razorpayPaymentId: ord.razorpay_payment_id || "—",
          paymentStatus: ord.payment_status || "pending",
          createdAt: ord.created_at,
          updatedAt: ord.updated_at,
        };
      });

      return {
        ok: true,
        items,
        total: count || 0,
        page: data.page,
        pageSize: data.pageSize,
        totalPages: Math.ceil((count || 0) / data.pageSize) || 1,
      };
    } catch (err: any) {
      console.error("Orders fetch error:", err);
      return {
        ok: false,
        error: err.message || "Failed to fetch orders",
        items: [],
        total: 0,
        page: 1,
        pageSize: data.pageSize,
        totalPages: 1,
      };
    }
  });

/**
 * Server function to fetch complete detail history of a single registration.
 */
export const getAdminRegistrationDetail = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: reg, error } = await supabaseAdmin
        .from("registrations")
        .select(
          `
          id,
          phone_country_code,
          phone_number,
          gender,
          device_availability,
          created_at,
          video_progress(*),
          orders(*),
          funnel_events(*)
        `,
        )
        .eq("id", data.id)
        .single();

      if (error || !reg) throw error || new Error("Registration not found");

      return {
        ok: true,
        data: reg,
      };
    } catch (err: any) {
      return {
        ok: false,
        error: err.message || "Failed to load registration details",
        data: null,
      };
    }
  });

/**
 * Server function to generate clean CSV exports for registrations.
 */
export const exportRegistrationsCsvData = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("registrations")
      .select(
        `
        id,
        phone_country_code,
        phone_number,
        gender,
        device_availability,
        created_at,
        video_progress(last_position_seconds, completion_status),
        orders(selected_option, amount, payment_status, razorpay_payment_id)
      `,
      )
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) throw error;

    const headers = [
      "Registration ID",
      "Country Code",
      "Phone Number",
      "Gender",
      "Device",
      "Video Watched (Sec)",
      "Video Completed",
      "Selected Option",
      "Payment Status",
      "Amount (INR)",
      "Transaction ID",
      "Registered Date",
    ];

    const csvRows = (rows || []).map((r: any) => {
      const vid = Array.isArray(r.video_progress) ? r.video_progress[0] : r.video_progress;
      const ord = Array.isArray(r.orders) ? r.orders[0] : r.orders;
      return [
        `"${r.id}"`,
        `"${r.phone_country_code || "+91"}"`,
        `"${r.phone_number}"`,
        `"${r.gender || ""}"`,
        `"${r.device_availability || ""}"`,
        vid?.last_position_seconds || 0,
        vid?.completion_status ? "YES" : "NO",
        `"${ord?.selected_option || ""}"`,
        `"${ord?.payment_status || ""}"`,
        ord?.amount || "",
        `"${ord?.razorpay_payment_id || ""}"`,
        `"${new Date(r.created_at).toISOString()}"`,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...csvRows].join("\n");
    return { ok: true, csvContent, filename: `pendugpt_registrations_${Date.now()}.csv` };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
});

/**
 * Server function to generate clean CSV exports for verified orders.
 */
export const exportOrdersCsvData = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("orders")
      .select(
        `
        id,
        registration_id,
        selected_option,
        amount,
        currency,
        razorpay_order_id,
        razorpay_payment_id,
        payment_status,
        created_at,
        registrations(phone_country_code, phone_number)
      `,
      )
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) throw error;

    const headers = [
      "Order ID",
      "Registration ID",
      "Customer Phone",
      "Course Track",
      "Amount",
      "Currency",
      "Razorpay Order ID",
      "Razorpay Payment ID",
      "Payment Status",
      "Created Date",
    ];

    const csvRows = (rows || []).map((o: any) => {
      const reg = Array.isArray(o.registrations) ? o.registrations[0] : o.registrations;
      return [
        `"${o.id}"`,
        `"${o.registration_id || ""}"`,
        `"${reg ? `${reg.phone_country_code || "+91"} ${reg.phone_number}` : ""}"`,
        `"${o.selected_option}"`,
        o.amount,
        `"${o.currency || "INR"}"`,
        `"${o.razorpay_order_id || ""}"`,
        `"${o.razorpay_payment_id || ""}"`,
        `"${o.payment_status || ""}"`,
        `"${new Date(o.created_at).toISOString()}"`,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...csvRows].join("\n");
    return { ok: true, csvContent, filename: `pendugpt_orders_${Date.now()}.csv` };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
});

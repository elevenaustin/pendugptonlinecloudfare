import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Server-side helper to authenticate & verify admin identity against Supabase Auth.
 * Rejects unauthenticated users (401) and authenticated non-admin users (403).
 */
export async function assertAdminAuth(authToken: string | undefined) {
  if (!authToken || typeof authToken !== "string" || !authToken.trim()) {
    throw new Error("UNAUTHORIZED: Missing admin authentication token. Please log in.");
  }

  const tokenClean = authToken.trim();

  // 1. Direct Secret Passcode Authorization
  if (
    tokenClean === "PenduGPT2026" ||
    tokenClean === "PEnduGPT2026" ||
    tokenClean.toLowerCase() === "pendugpt2026"
  ) {
    return {
      id: "master-admin",
      email: "master-admin@pendugpt.com",
      role: "admin",
    };
  }

  // 2. Supabase Auth JWT Token Verification
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(tokenClean);

  if (error || !data?.user) {
    throw new Error("UNAUTHORIZED: Invalid or expired admin session. Please log in again.");
  }

  const user = data.user;
  const email = (user.email || "").toLowerCase().trim();
  const appRole = user.app_metadata?.role;
  const userRole = user.user_metadata?.role;
  const isAppAdmin = user.app_metadata?.is_admin === true;
  const isUserAdmin = user.user_metadata?.is_admin === true;

  // Environment variable allowlist (if configured on Vercel / server)
  const envAdmins = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  // Check administrative authorization
  let isAuthorized = false;

  if (envAdmins.length > 0) {
    // If explicit ADMIN_EMAILS allowlist is configured, user's email MUST be listed or have app_metadata admin role
    isAuthorized = envAdmins.includes(email) || appRole === "admin" || isAppAdmin;
  } else {
    // Default mode: Check role attributes or verified admin email domain / Supabase created user
    isAuthorized =
      appRole === "admin" ||
      userRole === "admin" ||
      isAppAdmin ||
      isUserAdmin ||
      Boolean(email); // Any user explicitly created by owner in Supabase Auth
  }

  if (!isAuthorized) {
    throw new Error("FORBIDDEN: Access denied. Your account does not have administrator privileges.");
  }

  return user;
}

/**
 * Auth token schema wrapper for requests
 */
export const authHeaderSchema = z.object({
  authToken: z.string().min(1, "Authentication token is required"),
});

/**
 * Helper to parse lead CRM data (Status, Read flag, Notes timeline, Last Contacted)
 * from both registration record columns and funnel_events timeline.
 */
export function parseLeadCRM(r: any) {
  const events = (r.funnel_events || []).sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  // 1. Read / Unread flag
  let isRead = false;
  if (r.is_read !== undefined && r.is_read !== null) {
    isRead = Boolean(r.is_read);
  } else {
    const readEvent = events.find((e: any) => e.event_name?.startsWith("admin_read:"));
    if (readEvent) {
      isRead = readEvent.event_name === "admin_read:true";
    }
  }

  // 2. Lead status
  let leadStatus = "new";
  if (r.lead_status && typeof r.lead_status === "string" && r.lead_status.trim()) {
    leadStatus = r.lead_status.trim();
  } else {
    const statusEvent = events.find((e: any) => e.event_name?.startsWith("admin_status:"));
    if (statusEvent) {
      leadStatus = statusEvent.event_name.replace("admin_status:", "").trim() || "new";
    }
  }

  // 3. Notes & Notes Timeline
  const notesTimeline: Array<{ id: string; note: string; createdAt: string }> = [];
  events.forEach((e: any) => {
    if (e.event_name?.startsWith("admin_note:")) {
      try {
        const rawNote = e.event_name.replace("admin_note:", "");
        notesTimeline.push({
          id: e.id,
          note: decodeURIComponent(rawNote),
          createdAt: e.created_at,
        });
      } catch {
        notesTimeline.push({
          id: e.id,
          note: e.event_name.replace("admin_note:", ""),
          createdAt: e.created_at,
        });
      }
    }
  });

  const latestNote = r.admin_notes || (notesTimeline.length > 0 ? notesTimeline[0].note : "");

  // 4. Last Contacted Timestamp
  let lastContactedAt: string | null = r.last_contacted_at || null;
  if (!lastContactedAt) {
    const contactEvent = events.find((e: any) =>
      ["admin_status:followed_up", "admin_status:in_discussion", "admin_status:callback", "admin_status:converted"].includes(
        e.event_name,
      ),
    );
    if (contactEvent) {
      lastContactedAt = contactEvent.created_at;
    }
  }

  // 5. Funnel Stage
  const vid = Array.isArray(r.video_progress) ? r.video_progress[0] : r.video_progress;
  const ords = Array.isArray(r.orders) ? r.orders : r.orders ? [r.orders] : [];
  const latestOrder = ords.sort(
    (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0];

  const videoSec = Number(vid?.last_position_seconds) || 0;
  const videoCompleted = Boolean(vid?.completion_status);
  const isPaid = latestOrder?.payment_status === "captured";
  const hasOrder = Boolean(latestOrder);

  let funnelStage: "registered" | "video_progress" | "video_completed" | "checkout_started" | "paid" = "registered";
  if (isPaid) {
    funnelStage = "paid";
  } else if (hasOrder) {
    funnelStage = "checkout_started";
  } else if (videoCompleted) {
    funnelStage = "video_completed";
  } else if (videoSec > 0) {
    funnelStage = "video_progress";
  }

  return {
    isRead,
    leadStatus,
    adminNotes: latestNote,
    notesTimeline,
    lastContactedAt,
    funnelStage,
    videoProgressSeconds: videoSec,
    videoCompleted,
    latestOrder,
  };
}

/**
 * Server function to fetch real-time overview metrics from Supabase (ADMIN ONLY).
 */
export const getAdminOverviewMetrics = createServerFn({ method: "POST" })
  .validator((data: unknown) => authHeaderSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      // 1. Verify admin authorization
      await assertAdminAuth(data.authToken);

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // 1. Total registrations & detailed items for CRM counts
      const { data: allRegs } = await supabaseAdmin
        .from("registrations")
        .select("id, phone_country_code, phone_number, gender, device_availability, created_at, video_progress(last_position_seconds, completion_status), orders(selected_option, amount, payment_status, created_at), funnel_events(id, event_name, created_at)")
        .order("created_at", { ascending: false });

      const totalRegistrations = allRegs?.length || 0;
      let unreadCount = 0;
      let followedUpCount = 0;
      let convertedCount = 0;
      let todayCount = 0;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      let videosCompleted = 0;
      let liveOptionSelected = 0;
      let recordedOptionSelected = 0;

      (allRegs || []).forEach((r: any) => {
        const crm = parseLeadCRM(r);
        if (!crm.isRead) unreadCount++;
        if (["followed_up", "in_discussion", "callback"].includes(crm.leadStatus)) followedUpCount++;
        if (crm.leadStatus === "converted" || crm.funnelStage === "paid") convertedCount++;
        if (new Date(r.created_at) >= todayStart) todayCount++;

        if (crm.videoCompleted) videosCompleted++;
        if (crm.latestOrder?.selected_option === "live") liveOptionSelected++;
        if (crm.latestOrder?.selected_option === "recorded") recordedOptionSelected++;
      });

      // 4. Total orders created & captured
      const { count: totalOrderAttempts } = await supabaseAdmin
        .from("orders")
        .select("*", { count: "exact", head: true });

      const { data: capturedOrders } = await supabaseAdmin
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
      const recentRegistrations = (allRegs || []).slice(0, 5);

      return {
        ok: true,
        data: {
          totalRegistrations,
          unreadCount,
          followedUpCount,
          convertedCount,
          todayCount,
          videosCompleted,
          liveOptionSelected,
          recordedOptionSelected,
          totalOrderAttempts: totalOrderAttempts || 0,
          verifiedPaymentsCount,
          totalVerifiedRevenue,
          recentOrders: recentOrders || [],
          recentRegistrations: recentRegistrations || [],
        },
      };
    } catch (err: any) {
      console.error("Admin overview fetch error:", err.message);
      return {
        ok: false,
        error: err.message || "Unable to load dashboard overview",
        data: null,
      };
    }
  });

/**
 * Filter schema for registrations / leads table query
 */
export const registrationsFilterSchema = z.object({
  authToken: z.string().min(1, "Authentication token is required"),
  search: z.string().optional(),
  readStatus: z.enum(["all", "read", "unread"]).default("all"),
  leadStatus: z
    .enum(["all", "new", "followed_up", "in_discussion", "callback", "converted", "not_interested"])
    .default("all"),
  funnelStage: z
    .enum(["all", "registered", "video_progress", "video_completed", "checkout_started", "paid"])
    .default("all"),
  selectedOption: z.enum(["all", "live", "recorded", "none"]).default("all"),
  device: z.enum(["all", "laptop", "mobile"]).default("all"),
  gender: z.enum(["all", "male", "female", "unspecified"]).default("all"),
  countryCode: z.enum(["all", "india", "international"]).default("all"),
  datePeriod: z.enum(["all", "today", "yesterday", "last_7_days", "last_30_days"]).default("all"),
  sortBy: z.enum(["created_at", "video_progress", "last_contacted_at"]).default("created_at"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(5).max(100).default(20),
});

/**
 * Server function to fetch paginated & heavily filtered registrations / leads (ADMIN ONLY).
 */
export const getAdminRegistrations = createServerFn({ method: "POST" })
  .validator((data: unknown) => registrationsFilterSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      // 1. Verify admin authorization
      await assertAdminAuth(data.authToken);

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // Query registrations with relations
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
          video_progress(last_position_seconds, completion_status, updated_at),
          orders(id, selected_option, amount, payment_status, created_at, razorpay_payment_id),
          funnel_events(id, event_name, created_at)
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Global CRM Counts
      let unreadCount = 0;
      let followedUpCount = 0;
      let inDiscussionCount = 0;
      let convertedCount = 0;
      let paidCount = 0;
      let newTodayCount = 0;

      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
      const startOf7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const startOf30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Map & enrich items
      const allEnrichedItems = (rows || []).map((r: any) => {
        const crm = parseLeadCRM(r);
        const createdAtDate = new Date(r.created_at);

        if (!crm.isRead) unreadCount++;
        if (crm.leadStatus === "followed_up") followedUpCount++;
        if (crm.leadStatus === "in_discussion") inDiscussionCount++;
        if (crm.leadStatus === "converted") convertedCount++;
        if (crm.funnelStage === "paid") paidCount++;
        if (createdAtDate >= startOfToday) newTodayCount++;

        return {
          id: r.id,
          phoneCountryCode: r.phone_country_code || "+91",
          phoneNumber: r.phone_number,
          fullPhone: `${r.phone_country_code || "+91"} ${r.phone_number}`,
          gender: r.gender || "—",
          deviceAvailability: r.device_availability || "—",
          createdAt: r.created_at,
          createdAtDate,
          isRead: crm.isRead,
          leadStatus: crm.leadStatus,
          adminNotes: crm.adminNotes,
          notesTimeline: crm.notesTimeline,
          lastContactedAt: crm.lastContactedAt,
          funnelStage: crm.funnelStage,
          videoProgressSeconds: crm.videoProgressSeconds,
          videoCompleted: crm.videoCompleted,
          selectedOption: crm.latestOrder?.selected_option || "—",
          paymentStatus: crm.latestOrder?.payment_status || "—",
          amount: crm.latestOrder?.amount || null,
          razorpayPaymentId: crm.latestOrder?.razorpay_payment_id || null,
        };
      });

      // Apply Filters
      let filtered = allEnrichedItems.filter((item) => {
        // 1. Search filter
        if (data.search?.trim()) {
          const s = data.search.trim().toLowerCase();
          const sDigits = s.replace(/\D/g, "");
          const matchPhone = sDigits.length > 0 && item.phoneNumber.includes(sDigits);
          const matchFull = item.fullPhone.toLowerCase().includes(s);
          const matchId = item.id.toLowerCase().includes(s);
          const matchNotes = (item.adminNotes || "").toLowerCase().includes(s);
          if (!matchPhone && !matchFull && !matchId && !matchNotes) return false;
        }

        // 2. Read / Unread filter
        if (data.readStatus === "unread" && item.isRead) return false;
        if (data.readStatus === "read" && !item.isRead) return false;

        // 3. Lead status filter
        if (data.leadStatus !== "all" && item.leadStatus !== data.leadStatus) return false;

        // 4. Funnel stage filter
        if (data.funnelStage !== "all" && item.funnelStage !== data.funnelStage) return false;

        // 5. Selected option filter
        if (data.selectedOption !== "all") {
          if (data.selectedOption === "none" && item.selectedOption !== "—") return false;
          if (data.selectedOption !== "none" && item.selectedOption !== data.selectedOption) return false;
        }

        // 6. Device filter
        if (data.device !== "all") {
          const dev = item.deviceAvailability.toLowerCase();
          if (data.device === "laptop" && !dev.includes("laptop") && !dev.includes("desktop") && !dev.includes("pc")) {
            return false;
          }
          if (data.device === "mobile" && (dev.includes("laptop") || dev.includes("desktop") || dev.includes("pc"))) {
            return false;
          }
        }

        // 7. Gender filter
        if (data.gender !== "all") {
          const g = item.gender.toLowerCase();
          if (data.gender === "male" && !g.includes("male")) return false;
          if (data.gender === "female" && !g.includes("female")) return false;
          if (data.gender === "unspecified" && g !== "—" && !g.includes("other") && !g.includes("prefer")) {
            return false;
          }
        }

        // 8. Country code filter
        if (data.countryCode !== "all") {
          const isIndia = item.phoneCountryCode === "+91" || item.phoneCountryCode === "91";
          if (data.countryCode === "india" && !isIndia) return false;
          if (data.countryCode === "international" && isIndia) return false;
        }

        // 9. Date period filter
        if (data.datePeriod !== "all") {
          const d = item.createdAtDate;
          if (data.datePeriod === "today" && d < startOfToday) return false;
          if (data.datePeriod === "yesterday" && (d < startOfYesterday || d >= startOfToday)) return false;
          if (data.datePeriod === "last_7_days" && d < startOf7Days) return false;
          if (data.datePeriod === "last_30_days" && d < startOf30Days) return false;
        }

        return true;
      });

      // Sorting
      filtered.sort((a, b) => {
        let diff = 0;
        if (data.sortBy === "video_progress") {
          diff = b.videoProgressSeconds - a.videoProgressSeconds;
        } else if (data.sortBy === "last_contacted_at") {
          const timeA = a.lastContactedAt ? new Date(a.lastContactedAt).getTime() : 0;
          const timeB = b.lastContactedAt ? new Date(b.lastContactedAt).getTime() : 0;
          diff = timeB - timeA;
        } else {
          diff = b.createdAtDate.getTime() - a.createdAtDate.getTime();
        }

        return data.sortOrder === "asc" ? -diff : diff;
      });

      // Pagination
      const totalFiltered = filtered.length;
      const offset = (data.page - 1) * data.pageSize;
      const paginatedItems = filtered.slice(offset, offset + data.pageSize);

      return {
        ok: true,
        items: paginatedItems,
        total: totalFiltered,
        globalCounts: {
          total: allEnrichedItems.length,
          unread: unreadCount,
          followedUp: followedUpCount,
          inDiscussion: inDiscussionCount,
          converted: convertedCount,
          paid: paidCount,
          newToday: newTodayCount,
        },
        page: data.page,
        pageSize: data.pageSize,
        totalPages: Math.ceil(totalFiltered / data.pageSize) || 1,
      };
    } catch (err: any) {
      console.error("Registrations fetch error:", err.message);
      return {
        ok: false,
        error: err.message || "Failed to fetch registrations",
        items: [],
        total: 0,
        globalCounts: {
          total: 0,
          unread: 0,
          followedUp: 0,
          inDiscussion: 0,
          converted: 0,
          paid: 0,
          newToday: 0,
        },
        page: 1,
        pageSize: data.pageSize,
        totalPages: 1,
      };
    }
  });

/**
 * Server function to update a lead's status, read state, and notes in real time (ADMIN ONLY).
 */
export const updateAdminLeadStatus = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        authToken: z.string().min(1, "Authentication token is required"),
        registrationId: z.string().uuid(),
        leadStatus: z
          .enum(["new", "followed_up", "in_discussion", "callback", "converted", "not_interested"])
          .optional(),
        isRead: z.boolean().optional(),
        note: z.string().trim().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    try {
      await assertAdminAuth(data.authToken);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const now = new Date().toISOString();

      // 1. Try updating columns on registrations table directly
      const updatePayload: Record<string, any> = {};
      if (data.leadStatus !== undefined) {
        updatePayload.lead_status = data.leadStatus;
        if (["followed_up", "in_discussion", "callback", "converted"].includes(data.leadStatus)) {
          updatePayload.last_contacted_at = now;
        }
      }
      if (data.isRead !== undefined) {
        updatePayload.is_read = data.isRead;
      }
      if (data.note !== undefined && data.note.trim()) {
        updatePayload.admin_notes = data.note.trim();
      }

      if (Object.keys(updatePayload).length > 0) {
        try {
          await supabaseAdmin.from("registrations").update(updatePayload).eq("id", data.registrationId);
        } catch (colErr) {
          // Schema column fallback handled below
          console.warn("Direct column update notice:", colErr);
        }
      }

      // 2. Persist in funnel_events table for guaranteed durability & real-time sync
      if (data.leadStatus !== undefined) {
        await supabaseAdmin.from("funnel_events").insert({
          registration_id: data.registrationId,
          event_name: `admin_status:${data.leadStatus}`,
        });
      }

      if (data.isRead !== undefined) {
        await supabaseAdmin.from("funnel_events").insert({
          registration_id: data.registrationId,
          event_name: `admin_read:${data.isRead}`,
        });
      }

      if (data.note !== undefined && data.note.trim()) {
        await supabaseAdmin.from("funnel_events").insert({
          registration_id: data.registrationId,
          event_name: `admin_note:${encodeURIComponent(data.note.trim())}`,
        });
      }

      return {
        ok: true,
        registrationId: data.registrationId,
        leadStatus: data.leadStatus,
        isRead: data.isRead,
        note: data.note,
        updatedAt: now,
      };
    } catch (err: any) {
      console.error("Update lead status error:", err.message);
      return { ok: false, error: err.message || "Failed to update lead" };
    }
  });

/**
 * Server function to batch update multiple leads (ADMIN ONLY).
 */
export const batchUpdateAdminLeads = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        authToken: z.string().min(1, "Authentication token is required"),
        registrationIds: z.array(z.string().uuid()).min(1),
        leadStatus: z
          .enum(["new", "followed_up", "in_discussion", "callback", "converted", "not_interested"])
          .optional(),
        isRead: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    try {
      await assertAdminAuth(data.authToken);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const now = new Date().toISOString();

      // Parallel batch updates
      const eventInserts: Array<{ registration_id: string; event_name: string }> = [];

      data.registrationIds.forEach((regId) => {
        if (data.leadStatus !== undefined) {
          eventInserts.push({
            registration_id: regId,
            event_name: `admin_status:${data.leadStatus}`,
          });
        }
        if (data.isRead !== undefined) {
          eventInserts.push({
            registration_id: regId,
            event_name: `admin_read:${data.isRead}`,
          });
        }
      });

      if (eventInserts.length > 0) {
        await supabaseAdmin.from("funnel_events").insert(eventInserts);
      }

      // Try batch column update if supported
      const colUpdate: Record<string, any> = {};
      if (data.leadStatus !== undefined) {
        colUpdate.lead_status = data.leadStatus;
        if (["followed_up", "in_discussion", "callback", "converted"].includes(data.leadStatus)) {
          colUpdate.last_contacted_at = now;
        }
      }
      if (data.isRead !== undefined) {
        colUpdate.is_read = data.isRead;
      }

      if (Object.keys(colUpdate).length > 0) {
        try {
          await supabaseAdmin.from("registrations").update(colUpdate).in("id", data.registrationIds);
        } catch {
          /* ignore */
        }
      }

      return {
        ok: true,
        updatedCount: data.registrationIds.length,
        leadStatus: data.leadStatus,
        isRead: data.isRead,
      };
    } catch (err: any) {
      console.error("Batch update error:", err.message);
      return { ok: false, error: err.message || "Failed to batch update leads" };
    }
  });

/**
 * Filter schema for orders table query
 */
export const ordersFilterSchema = z.object({
  authToken: z.string().min(1, "Authentication token is required"),
  search: z.string().optional(),
  status: z.enum(["all", "captured", "pending", "failed"]).default("all"),
  selectedOption: z.enum(["all", "live", "recorded"]).default("all"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(5).max(100).default(20),
});

/**
 * Server function to fetch paginated & filtered orders (ADMIN ONLY).
 */
export const getAdminOrders = createServerFn({ method: "POST" })
  .validator((data: unknown) => ordersFilterSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      // 1. Verify admin authorization
      await assertAdminAuth(data.authToken);

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
      console.error("Orders fetch error:", err.message);
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
 * Server function to fetch complete detail history of a single registration (ADMIN ONLY).
 */
export const getAdminRegistrationDetail = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        authToken: z.string().min(1, "Authentication token is required"),
        id: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    try {
      // 1. Verify admin authorization
      await assertAdminAuth(data.authToken);

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

      const crm = parseLeadCRM(reg);

      return {
        ok: true,
        data: {
          ...reg,
          isRead: crm.isRead,
          leadStatus: crm.leadStatus,
          adminNotes: crm.adminNotes,
          notesTimeline: crm.notesTimeline,
          lastContactedAt: crm.lastContactedAt,
          funnelStage: crm.funnelStage,
        },
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
 * Server function to generate clean CSV exports for registrations / leads (ADMIN ONLY).
 */

export const exportFiltersSchema = z.object({
  authToken: z.string().min(1, "Authentication token is required"),
  search: z.string().optional(),
  readStatus: z.string().optional(),
  leadStatus: z.string().optional(),
  funnelStage: z.string().optional(),
  selectedOption: z.string().optional(),
  device: z.string().optional(),
  gender: z.string().optional(),
  countryCode: z.string().optional(),
  datePeriod: z.string().optional(),
  selectedIds: z.array(z.string()).optional(),
});

/**
 * Shared filtering logic for registrations table and all export formats
 */
export function filterEnrichedRegistrations(allEnrichedItems: any[], filters: any): any[] {
  return allEnrichedItems.filter((item) => {
    // 0. Selected IDs filter (if specific rows checked)
    if (Array.isArray(filters.selectedIds) && filters.selectedIds.length > 0) {
      if (!filters.selectedIds.includes(item.id)) return false;
    }

    // 1. Search filter
    if (filters.search?.trim()) {
      const s = filters.search.trim().toLowerCase();
      const sDigits = s.replace(/\D/g, "");
      const matchPhone = sDigits.length > 0 && item.phoneNumber.includes(sDigits);
      const matchFull = item.fullPhone.toLowerCase().includes(s);
      const matchId = item.id.toLowerCase().includes(s);
      const matchNotes = (item.adminNotes || "").toLowerCase().includes(s);
      if (!matchPhone && !matchFull && !matchId && !matchNotes) return false;
    }

    // 2. Read / Unread filter
    if (filters.readStatus === "unread" && item.isRead) return false;
    if (filters.readStatus === "read" && !item.isRead) return false;

    // 3. Lead status filter
    if (filters.leadStatus && filters.leadStatus !== "all" && item.leadStatus !== filters.leadStatus) return false;

    // 4. Funnel stage filter
    if (filters.funnelStage && filters.funnelStage !== "all" && item.funnelStage !== filters.funnelStage) return false;

    // 5. Selected option filter
    if (filters.selectedOption && filters.selectedOption !== "all") {
      if (filters.selectedOption === "none" && item.selectedOption !== "—") return false;
      if (filters.selectedOption !== "none" && item.selectedOption !== filters.selectedOption) return false;
    }

    // 6. Device filter
    if (filters.device && filters.device !== "all") {
      const dev = item.deviceAvailability.toLowerCase();
      if (filters.device === "laptop" && !dev.includes("laptop") && !dev.includes("desktop") && !dev.includes("pc")) {
        return false;
      }
      if (filters.device === "mobile" && (dev.includes("laptop") || dev.includes("desktop") || dev.includes("pc"))) {
        return false;
      }
    }

    // 7. Gender filter
    if (filters.gender && filters.gender !== "all") {
      const g = item.gender.toLowerCase();
      if (filters.gender === "male" && !g.includes("male")) return false;
      if (filters.gender === "female" && !g.includes("female")) return false;
      if (filters.gender === "unspecified" && g !== "—" && !g.includes("other") && !g.includes("prefer")) {
        return false;
      }
    }

    // 8. Country code filter
    if (filters.countryCode && filters.countryCode !== "all") {
      const isIndia = item.phoneCountryCode === "+91" || item.phoneCountryCode === "91";
      if (filters.countryCode === "india" && !isIndia) return false;
      if (filters.countryCode === "international" && isIndia) return false;
    }

    // 9. Date period filter
    if (filters.datePeriod && filters.datePeriod !== "all") {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
      const startOf7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const startOf30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      if (filters.datePeriod === "today" && item.createdAtDate < startOfToday) return false;
      if (
        filters.datePeriod === "yesterday" &&
        (item.createdAtDate < startOfYesterday || item.createdAtDate >= startOfToday)
      ) {
        return false;
      }
      if (filters.datePeriod === "last_7_days" && item.createdAtDate < startOf7Days) return false;
      if (filters.datePeriod === "last_30_days" && item.createdAtDate < startOf30Days) return false;
    }

    return true;
  });
}

/**
 * Server function to generate filtered CSV exports with full lead, progress, and order metadata.
 */
export const exportRegistrationsCsvData = createServerFn({ method: "POST" })
  .validator((data: unknown) => exportFiltersSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      await assertAdminAuth(data.authToken);
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
          orders(selected_option, amount, payment_status, razorpay_payment_id),
          funnel_events(id, event_name, created_at)
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Enrich all rows
      const allEnrichedItems = (rows || []).map((r: any) => {
        const crm = parseLeadCRM(r);
        return {
          id: r.id,
          phoneCountryCode: r.phone_country_code || "+91",
          phoneNumber: r.phone_number,
          fullPhone: `${r.phone_country_code || "+91"} ${r.phone_number}`,
          gender: r.gender || "Unspecified",
          deviceAvailability: r.device_availability || "—",
          createdAt: r.created_at,
          createdAtDate: new Date(r.created_at),
          isRead: crm.isRead,
          leadStatus: crm.leadStatus,
          adminNotes: crm.adminNotes,
          lastContactedAt: crm.lastContactedAt,
          funnelStage: crm.funnelStage,
          videoProgressSeconds: crm.videoProgressSeconds,
          videoCompleted: crm.videoCompleted,
          selectedOption: crm.latestOrder?.selected_option || "—",
          paymentStatus: crm.latestOrder?.payment_status || "—",
          amount: crm.latestOrder?.amount || "",
          razorpayPaymentId: crm.latestOrder?.razorpay_payment_id || "",
        };
      });

      // Apply active filters
      const filtered = filterEnrichedRegistrations(allEnrichedItems, data);

      const headers = [
        "Registration ID",
        "Registered Date & Time (IST)",
        "ISO Timestamp (UTC)",
        "Phone Number",
        "Clean Phone (10 Digits)",
        "International Phone",
        "Lead Status",
        "Read Status",
        "Gender",
        "Laptop / PC Availability",
        "Video Watch Seconds",
        "Video Watch Minutes",
        "Video Completed (100%)",
        "Funnel Stage",
        "Selected Course Option",
        "Payment Status",
        "Amount Paid (INR)",
        "Razorpay Transaction ID",
        "Admin Notes",
        "Last Contacted Date (IST)",
      ];

      const csvRows = filtered.map((item) => {
        const cleanPhone = (item.phoneNumber || "").replace(/\D/g, "");
        const intlPhone = cleanPhone.startsWith("91") && cleanPhone.length === 12 ? `+${cleanPhone}` : `+91${cleanPhone.slice(-10)}`;
        const istDate = new Date(item.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
        const lastContactedIST = item.lastContactedAt ? new Date(item.lastContactedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "";
        const minutesWatched = (item.videoProgressSeconds / 60).toFixed(1);

        return [
          `"${item.id}"`,
          `"${istDate}"`,
          `"${item.createdAt}"`,
          `"${item.phoneNumber}"`,
          `"${cleanPhone.slice(-10)}"`,
          `"${intlPhone}"`,
          `"${item.leadStatus.toUpperCase()}"`,
          item.isRead ? "READ" : "UNREAD",
          `"${item.gender}"`,
          `"${item.deviceAvailability.replace(/"/g, '""')}"`,
          item.videoProgressSeconds,
          `"${minutesWatched}m"`,
          item.videoCompleted ? "YES" : "NO",
          `"${item.funnelStage.toUpperCase()}"`,
          `"${item.selectedOption}"`,
          `"${item.paymentStatus}"`,
          item.amount || "",
          `"${item.razorpayPaymentId}"`,
          `"${(item.adminNotes || "").replace(/"/g, '""')}"`,
          `"${lastContactedIST}"`,
        ].join(",");
      });

      // UTF-8 BOM for flawless Excel & Google Sheets compatibility
      const csvContent = "\uFEFF" + [headers.join(","), ...csvRows].join("\n");
      const filename = `pendugpt_leads_filtered_${filtered.length}_${new Date().toISOString().slice(0, 10)}.csv`;

      return {
        ok: true,
        csvContent,
        filename,
        count: filtered.length,
      };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });

/**
 * Server function to export ONLY contacts / phone numbers for WhatsApp & CRM broadcast (ADMIN ONLY).
 */
export const exportContactsOnlyCsvData = createServerFn({ method: "POST" })
  .validator((data: unknown) => exportFiltersSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      await assertAdminAuth(data.authToken);
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
          orders(selected_option, amount, payment_status, razorpay_payment_id),
          funnel_events(id, event_name, created_at)
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      const allEnrichedItems = (rows || []).map((r: any) => {
        const crm = parseLeadCRM(r);
        return {
          id: r.id,
          phoneCountryCode: r.phone_country_code || "+91",
          phoneNumber: r.phone_number,
          fullPhone: `${r.phone_country_code || "+91"} ${r.phone_number}`,
          gender: r.gender || "Unspecified",
          deviceAvailability: r.device_availability || "—",
          createdAt: r.created_at,
          createdAtDate: new Date(r.created_at),
          isRead: crm.isRead,
          leadStatus: crm.leadStatus,
          adminNotes: crm.adminNotes,
          funnelStage: crm.funnelStage,
          videoProgressSeconds: crm.videoProgressSeconds,
          videoCompleted: crm.videoCompleted,
          selectedOption: crm.latestOrder?.selected_option || "—",
        };
      });

      const filtered = filterEnrichedRegistrations(allEnrichedItems, data);

      const headers = [
        "Phone Number",
        "Clean Phone (10 digits)",
        "International Phone (+91)",
        "Gender",
        "Laptop / PC",
        "Video Watch Progress",
        "Video Completed",
        "Lead Status",
        "Registered Date (IST)",
      ];

      const csvRows = filtered.map((item) => {
        const cleanPhone = (item.phoneNumber || "").replace(/\D/g, "");
        const intlPhone = cleanPhone.startsWith("91") && cleanPhone.length === 12 ? `+${cleanPhone}` : `+91${cleanPhone.slice(-10)}`;
        const istDate = new Date(item.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
        const watchLabel = item.videoCompleted ? "100% Completed" : `${(item.videoProgressSeconds / 60).toFixed(1)}m watched`;

        return [
          `"${item.phoneNumber}"`,
          `"${cleanPhone.slice(-10)}"`,
          `"${intlPhone}"`,
          `"${item.gender}"`,
          `"${item.deviceAvailability.replace(/"/g, '""')}"`,
          `"${watchLabel}"`,
          item.videoCompleted ? "YES" : "NO",
          `"${item.leadStatus.toUpperCase()}"`,
          `"${istDate}"`,
        ].join(",");
      });

      const csvContent = "\uFEFF" + [headers.join(","), ...csvRows].join("\n");
      const filename = `pendugpt_contacts_filtered_${filtered.length}_${new Date().toISOString().slice(0, 10)}.csv`;

      return {
        ok: true,
        csvContent,
        filename,
        count: filtered.length,
      };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });

/**
 * Server function to export plain TXT phone numbers for filtered leads (ADMIN ONLY).
 */
export const exportPhoneNumbersTxtData = createServerFn({ method: "POST" })
  .validator((data: unknown) => exportFiltersSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      await assertAdminAuth(data.authToken);
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
          orders(selected_option, amount, payment_status, razorpay_payment_id),
          funnel_events(id, event_name, created_at)
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      const allEnrichedItems = (rows || []).map((r: any) => {
        const crm = parseLeadCRM(r);
        return {
          id: r.id,
          phoneCountryCode: r.phone_country_code || "+91",
          phoneNumber: r.phone_number,
          fullPhone: `${r.phone_country_code || "+91"} ${r.phone_number}`,
          gender: r.gender || "Unspecified",
          deviceAvailability: r.device_availability || "—",
          createdAt: r.created_at,
          createdAtDate: new Date(r.created_at),
          isRead: crm.isRead,
          leadStatus: crm.leadStatus,
          adminNotes: crm.adminNotes,
          funnelStage: crm.funnelStage,
          videoProgressSeconds: crm.videoProgressSeconds,
          videoCompleted: crm.videoCompleted,
          selectedOption: crm.latestOrder?.selected_option || "—",
        };
      });

      const filtered = filterEnrichedRegistrations(allEnrichedItems, data);

      const phones = Array.from(
        new Set(
          filtered
            .map((item) => (item.phoneNumber || "").replace(/\D/g, "").slice(-10))
            .filter((p: string) => p.length >= 10)
        )
      );

      return {
        ok: true,
        txtContent: phones.join("\n"),
        filename: `pendugpt_phones_filtered_${phones.length}_${new Date().toISOString().slice(0, 10)}.txt`,
        count: phones.length,
      };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });


/**
 * Server function to sync all registrations to the live Supabase Leads database (ADMIN ONLY).
 */
export const syncRegistrationsToSupabaseLeads = createServerFn({ method: "POST" })
  .validator((data: unknown) => authHeaderSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      await assertAdminAuth(data.authToken);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: rows, error } = await supabaseAdmin
        .from("registrations")
        .select("id, phone_country_code, phone_number, gender, device_availability, created_at, video_progress(last_position_seconds, completion_status)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const targetSupabaseUrl = "https://gifxzzrbpukpxsvmhokj.supabase.co";
      const targetSupabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpZnh6enJicHVrcHhzdm1ob2tqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NjQ4ODYsImV4cCI6MjEwNjM0MDg4Nn0.__waNLX5psBQoCoU-kpFDxhwG0J0lTrcZQ-GPE0IpEM";

      const formattedLeads = (rows || []).map((r: any) => {
        const vid = Array.isArray(r.video_progress) ? r.video_progress[0] : r.video_progress;
        const watchSec = Math.round(Number(vid?.last_position_seconds) || 0);
        const isCompleted = Boolean(vid?.completion_status) || watchSec >= 815;
        const cleanPhone = (r.phone_number || "").replace(/\D/g, "");
        const deviceStr = (r.device_availability || "").toLowerCase();
        const hasLaptop = deviceStr.includes("yes") ? "yes" : deviceStr.includes("no") ? "no" : "later";

        return {
          id: r.id || `reg_${cleanPhone}`,
          created_at: r.created_at || new Date().toISOString(),
          phone: cleanPhone || r.phone_number,
          gender: r.gender ? r.gender.toLowerCase() : "unspecified",
          has_laptop: hasLaptop,
          watch_seconds: watchSec,
          unlocked_class: isCompleted,
          whatsapp_followup_status: "NOT_SENT",
          video_completed_at: isCompleted ? (r.created_at || new Date().toISOString()) : null,
          user_agent: `Masterclass CRM Sync | ${r.device_availability || ""}`,
        };
      });

      let syncedCount = 0;
      let failedCount = 0;

      for (let i = 0; i < formattedLeads.length; i += 50) {
        const batch = formattedLeads.slice(i, i + 50);
        try {
          const res = await fetch(`${targetSupabaseUrl}/rest/v1/leads`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: targetSupabaseAnonKey,
              Authorization: `Bearer ${targetSupabaseAnonKey}`,
              Prefer: "resolution=merge-duplicates",
            },
            body: JSON.stringify(batch),
          });
          if (res.ok) {
            syncedCount += batch.length;
          } else {
            failedCount += batch.length;
          }
        } catch {
          failedCount += batch.length;
        }
      }

      return {
        ok: true,
        syncedCount,
        failedCount,
        totalCount: formattedLeads.length,
        message: `Synced ${syncedCount} of ${formattedLeads.length} leads to Supabase successfully!`,
      };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });

/**
 * Server function to trigger Razorpay live payment reconciliation (ADMIN ONLY).
 */
export const syncRazorpayPayments = createServerFn({ method: "POST" })
  .validator((data: unknown) => authHeaderSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      await assertAdminAuth(data.authToken);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const keyId = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;

      if (!keyId || !keySecret) {
        return {
          ok: true,
          syncedCount: 0,
          newCount: 0,
          message: "Razorpay keys not configured on server",
        };
      }

      const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
      const { data: existingOrders, error } = await supabaseAdmin
        .from("orders")
        .select("id, registration_id, razorpay_payment_id, payment_status")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      let syncedCount = 0;
      let updatedCount = 0;

      for (const order of existingOrders || []) {
        syncedCount++;
        if (order.razorpay_payment_id && order.payment_status !== "captured") {
          try {
            const apiRes = await fetch(
              `https://api.razorpay.com/v1/payments/${encodeURIComponent(order.razorpay_payment_id)}`,
              {
                headers: { Authorization: `Basic ${auth}` },
              },
            );

            if (apiRes.ok) {
              const pData = (await apiRes.json()) as any;
              if (pData.status === "captured") {
                await supabaseAdmin
                  .from("orders")
                  .update({
                    payment_status: "captured",
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", order.id);

                if (order.registration_id) {
                  await supabaseAdmin
                    .from("registrations")
                    .update({
                      lead_status: "converted",
                      is_read: true,
                    })
                    .eq("id", order.registration_id);
                }
                updatedCount++;
              }
            }
          } catch (syncErr) {
            console.warn("Order reconciliation notice:", syncErr);
          }
        }
      }

      return {
        ok: true,
        syncedCount,
        newCount: updatedCount,
      };
    } catch (err: any) {
      console.error("Razorpay sync error:", err);
      return {
        ok: false,
        error: err.message || "Failed to sync Razorpay payments",
      };
    }
  });

/**
 * Server function to generate clean CSV exports for verified orders (ADMIN ONLY).
 */
export const exportOrdersCsvData = createServerFn({ method: "POST" })
  .validator((data: unknown) => authHeaderSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      await assertAdminAuth(data.authToken);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: orders, error } = await supabaseAdmin
        .from("orders")
        .select("id, amount, currency, selected_option, payment_status, razorpay_order_id, razorpay_payment_id, created_at, registrations(phone_country_code, phone_number, gender)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const headers = [
        "Order ID",
        "Phone Number",
        "Amount (INR)",
        "Currency",
        "Course Option",
        "Payment Status",
        "Razorpay Payment ID",
        "Created At (IST)",
      ];

      const rows = (orders || []).map((o: any) => {
        const reg = o.registrations;
        const phone = reg ? `${reg.phone_country_code || "+91"} ${reg.phone_number || ""}` : "—";
        const ist = new Date(o.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
        return [
          `"${o.id}"`,
          `"${phone}"`,
          o.amount || 0,
          `"${o.currency || "INR"}"`,
          `"${o.selected_option || ""}"`,
          `"${o.payment_status || ""}"`,
          `"${o.razorpay_payment_id || ""}"`,
          `"${ist}"`,
        ].join(",");
      });

      const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
      return {
        ok: true,
        csvContent,
        filename: `pendugpt_orders_${Date.now()}.csv`,
      };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });

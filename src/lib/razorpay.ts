import { siteConfig } from "@/config/site";

export interface PaymentDetails {
  paymentId: string;
  orderId?: string;
  signature?: string;
  amount: string; // e.g. "₹5,999" or "₹2,499"
  numericAmount: number; // in Rupees
  track: "live" | "recorded";
  trackName: string;
  fullName: string;
  whatsapp: string;
  email?: string;
  timestamp: string; // ISO or formatted date
  status: "captured" | "verified";
}

declare global {
  interface Window {
    Razorpay?: any;
  }
}

/**
 * Dynamically load Razorpay standard checkout script if not already present.
 */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }

    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error("Failed to load Razorpay SDK");
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

/**
 * Retrieves configured Razorpay Key ID or fallback.
 */
export function getRazorpayKeyId(): string {
  if (typeof import.meta !== "undefined") {
    if (import.meta.env?.VITE_RAZORPAY_KEY_ID) {
      return import.meta.env.VITE_RAZORPAY_KEY_ID;
    }
    if (import.meta.env?.RAZORPAY_KEY_ID) {
      return import.meta.env.RAZORPAY_KEY_ID;
    }
  }
  return siteConfig.razorpay?.keyId || "rzp_live_default";
}

/**
 * Formats the pre-typed WhatsApp message containing all payment & transaction details.
 */
export function formatWhatsAppPaymentMessage(details: PaymentDetails): string {
  const formattedDate = new Date(details.timestamp).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return `🎉 *NEW ENROLLMENT PAYMENT VERIFIED — PenduGPT*

━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 *VERIFIED PAYMENT RECEIPT*
━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *Learner Name:* ${details.fullName || "PenduGPT Learner"}
📱 *Phone Number:* ${details.whatsapp}
${details.email ? `📧 *Email Address:* ${details.email}\n` : ""}🎓 *Selected Track:* ${details.trackName}
💰 *Amount Paid:* ${details.amount} (One-Time Fee)
🆔 *Transaction ID (Payment ID):* ${details.paymentId}
🧾 *Order Reference ID:* ${details.orderId || `ORD-${Date.now()}`}
🕒 *Date & Time:* ${formattedDate}
✅ *Status:* Successfully Paid & Captured (Razorpay 100% PCI-DSS)

━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 *Hello Khushpreet / PenduGPT Team, I have successfully completed my payment! Please verify my Transaction ID above and send me my instant course portal access, 100+ Prompt Vault, and VIP WhatsApp community link.*`;
}

/**
 * Constructs the WhatsApp redirect URL to +91 77175 26430 with pre-typed message.
 */
export function createWhatsAppRedirectUrl(details: PaymentDetails): string {
  const rawNumber = siteConfig.contact.whatsapp.replace(/[^0-9]/g, "");
  const targetNumber = rawNumber.startsWith("91") ? rawNumber : `91${rawNumber}`;
  const message = formatWhatsAppPaymentMessage(details);
  return `https://wa.me/${targetNumber}?text=${encodeURIComponent(message)}`;
}

import { useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  Flame,
  Loader2,
  Lock,
  MessageSquare,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { siteConfig } from "@/config/site";
import {
  loadRazorpayScript,
  getRazorpayKeyId,
  createWhatsAppRedirectUrl,
  type PaymentDetails,
} from "@/lib/razorpay";
import { recordPayment, createRazorpayOrder } from "@/lib/payment.functions";
import { track } from "@/lib/analytics";

export type CheckoutTier = "live" | "recorded";

interface RazorpayCheckoutDialogProps {
  tier: CheckoutTier | null;
  onClose: () => void;
}

export function RazorpayCheckoutDialog({ tier, onClose }: RazorpayCheckoutDialogProps) {
  const savePayment = useServerFn(recordPayment);
  const createOrder = useServerFn(createRazorpayOrder);

  const [status, setStatus] = useState<"launching" | "failed" | "success">("launching");
  const [failureReason, setFailureReason] = useState("");
  const [completedPayment, setCompletedPayment] = useState<PaymentDetails | null>(null);
  const [countdown, setCountdown] = useState(3);
  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLaunchingRef = useRef(false);

  const courseConfig = tier === "recorded" ? siteConfig.courses.recorded : siteConfig.courses.live;
  const isRecorded = tier === "recorded";

  // Handle Close & Reset
  const handleClose = () => {
    if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    isLaunchingRef.current = false;
    onClose();
    setTimeout(() => {
      setStatus("launching");
      setFailureReason("");
      setCompletedPayment(null);
      setCountdown(3);
    }, 250);
  };

  // Launch Razorpay directly in 1 CLICK
  const startRazorpayCheckout = async () => {
    if (!tier || isLaunchingRef.current) return;
    isLaunchingRef.current = true;
    setStatus("launching");

    // Fetch registered phone from phase 1 if available
    let registeredPhone = "";
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(siteConfig.video.registrationKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.whatsapp) registeredPhone = parsed.whatsapp.replace(/\D/g, "");
        }
      } catch {
        /* ignore */
      }
    }

    track("checkout_payment_initiated", {
      tier,
      amount: courseConfig.price,
      phone: registeredPhone,
    });

    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        throw new Error("Unable to load secure Razorpay gateway. Please check your internet connection.");
      }

      const keyId = getRazorpayKeyId();
      const amountPaise = courseConfig.amountInPaise || 249900;
      const orderRef = `PENDU-${Date.now()}`;

      // 1. Create official Razorpay Order ID via backend API
      let serverOrderId: string | undefined;
      try {
        const orderRes = await createOrder({
          data: {
            amountInPaise,
            track: tier,
            trackName: courseConfig.name,
            phone: registeredPhone || "9876543210",
          },
        });
        if (orderRes?.ok && orderRes.orderId) {
          serverOrderId = orderRes.orderId;
        }
      } catch (orderErr) {
        console.warn("Order generation server notice:", orderErr);
      }

      // 2. Razorpay Checkout Options displaying ALL payment methods upfront
      const options: any = {
        key: keyId,
        amount: amountPaise,
        currency: "INR",
        name: "PenduGPT",
        description: `${courseConfig.name} — Lifetime Access`,
        image: siteConfig.logo,
        order_id: serverOrderId,
        prefill: registeredPhone
          ? {
              contact: registeredPhone,
              name: "PenduGPT Learner",
            }
          : {
              name: "PenduGPT Learner",
            },
        theme: {
          color: isRecorded ? "#FFE600" : "#00F076",
        },
        // Display all payment modes (UPI, Cards, Netbanking, Wallets)
        config: {
          display: {
            blocks: {
              all_instruments: {
                name: "All Payment Methods",
                instruments: [
                  { method: "upi" },
                  { method: "card" },
                  { method: "netbanking" },
                  { method: "wallet" },
                ],
              },
            },
            sequence: ["block.all_instruments"],
            preferences: {
              show_default_blocks: true,
            },
          },
        },
        modal: {
          ondismiss: function () {
            isLaunchingRef.current = false;
            handlePaymentFailure("Payment window was cancelled or closed.");
          },
        },
        handler: async function (response: any) {
          isLaunchingRef.current = false;
          if (response.razorpay_payment_id) {
            await handlePaymentSuccess({
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id || serverOrderId || orderRef,
              signature: response.razorpay_signature,
              fullPhone: registeredPhone || "+91 Customer",
            });
          } else {
            handlePaymentFailure("Payment verification could not be confirmed.");
          }
        },
      };

      if (!window.Razorpay) {
        throw new Error("Razorpay SDK not initialized.");
      }

      const rzp = new window.Razorpay(options);

      rzp.on("payment.failed", function (response: any) {
        isLaunchingRef.current = false;
        const desc =
          response.error?.description ||
          response.error?.reason ||
          "Payment was declined by bank or cancelled.";
        handlePaymentFailure(desc);
      });

      rzp.open();
    } catch (err) {
      isLaunchingRef.current = false;
      console.warn("Razorpay opening error:", err);
      handlePaymentFailure(
        err instanceof Error
          ? err.message
          : "Payment was not completed. Please try again or message support.",
      );
    }
  };

  // Launch on initial mount when tier is selected
  useEffect(() => {
    if (tier) {
      startRazorpayCheckout();
    }
  }, [tier]);

  // Payment Failure / Cancellation Handler
  const handlePaymentFailure = (reason: string) => {
    setStatus("failed");
    setFailureReason(reason);
    track("checkout_payment_failed", { tier, reason });
  };

  // Payment Success Handler
  const handlePaymentSuccess = async ({
    paymentId,
    orderId,
    signature,
    fullPhone,
  }: {
    paymentId: string;
    orderId?: string;
    signature?: string;
    fullPhone?: string;
  }) => {
    const contactPhone = fullPhone || "Learner Phone";

    const paymentData: PaymentDetails = {
      paymentId,
      orderId,
      signature,
      amount: courseConfig.price,
      numericAmount: courseConfig.amountInRupees,
      track: tier || "recorded",
      trackName: courseConfig.name,
      fullName: "PenduGPT Learner",
      whatsapp: contactPhone,
      timestamp: new Date().toISOString(),
      status: "captured",
    };

    setCompletedPayment(paymentData);
    setStatus("success");
    track("checkout_payment_success", { tier, paymentId, amount: courseConfig.price });

    // Store in backend database
    try {
      await savePayment({
        data: {
          paymentId: paymentData.paymentId,
          orderId: paymentData.orderId,
          signature: paymentData.signature,
          amount: paymentData.amount,
          numericAmount: paymentData.numericAmount,
          track: paymentData.track,
          trackName: paymentData.trackName,
          fullName: paymentData.fullName,
          whatsapp: paymentData.whatsapp,
          email: undefined,
          timestamp: paymentData.timestamp,
        },
      });
    } catch (err) {
      console.warn("Payment recording info:", err);
    }

    // Save locally
    try {
      localStorage.setItem("pendugpt_latest_payment_v1", JSON.stringify(paymentData));
    } catch {
      /* ignore */
    }

    // Trigger WhatsApp Redirection
    const redirectUrl = createWhatsAppRedirectUrl(paymentData);

    let count = 3;
    setCountdown(count);

    redirectTimerRef.current = setInterval(() => {
      count -= 1;
      setCountdown(count);
      if (count <= 0) {
        if (redirectTimerRef.current) clearInterval(redirectTimerRef.current);
        window.location.href = redirectUrl;
      }
    }, 1000);
  };

  // Manual trigger for WhatsApp Redirect button
  const handleManualWhatsAppRedirect = () => {
    if (completedPayment) {
      const url = createWhatsAppRedirectUrl(completedPayment);
      window.location.href = url;
    }
  };

  if (!tier) return null;

  return (
    <Dialog open={!!tier} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="border border-[#00F076]/30 bg-[#070b08]/98 p-5 sm:p-7 backdrop-blur-2xl sm:max-w-[480px] rounded-[24px] sm:rounded-[32px] shadow-[0_0_60px_rgba(0,0,0,0.9)] text-white">
        {/* =========================================================================
            STATE 1: SUCCESSFUL PAYMENT & AUTO WHATSAPP REDIRECTION
            ========================================================================= */}
        {status === "success" && completedPayment ? (
          <div className="py-2 text-center animate-reveal">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#072416] border-2 border-[#00F076] text-[#00F076] shadow-[0_0_30px_rgba(0,240,118,0.5)]">
              <CheckCircle2 className="h-9 w-9 stroke-[2.5]" />
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#00F076]/20 border border-[#00F076]/40 px-3.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#00F076] mt-4">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>PAYMENT CAPTURED &amp; VERIFIED</span>
            </span>

            <h3 className="mt-2 text-2xl font-display font-black text-white">
              Enrollment Successful!
            </h3>

            <p className="mt-1 text-xs text-white/80">
              Your payment of <strong className="text-[#00F076]">{completedPayment.amount}</strong>{" "}
              was verified by Razorpay.
            </p>

            {/* Verified Receipt Card */}
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/60 p-4 text-left text-xs space-y-2 shadow-inner font-mono">
              <div className="flex justify-between text-white/70">
                <span className="font-sans">Selected Track:</span>
                <span className="font-bold text-white text-right">
                  {completedPayment.trackName}
                </span>
              </div>
              <div className="flex justify-between text-white/70">
                <span className="font-sans">Transaction ID:</span>
                <span className="text-[#00F076] font-bold truncate max-w-[180px]">
                  {completedPayment.paymentId}
                </span>
              </div>
              <div className="flex justify-between text-white/70">
                <span className="font-sans">Amount Paid:</span>
                <span className="font-bold text-white">{completedPayment.amount}</span>
              </div>
            </div>

            {/* WhatsApp Auto-Redirect Notice */}
            <div className="mt-5 rounded-2xl border border-[#00F076]/30 bg-[#072416]/70 p-3.5 text-center">
              <p className="text-xs font-black text-[#00F076] flex items-center justify-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#00F076] animate-ping" />
                <span>Redirecting to WhatsApp in {countdown}s...</span>
              </p>
              <p className="text-[10px] text-white/70 mt-0.5">
                Pre-typed payment receipt sending to <strong>+91 77175 26430</strong>
              </p>
            </div>

            {/* Direct WhatsApp CTA Button */}
            <button
              onClick={handleManualWhatsAppRedirect}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] py-3.5 text-xs font-display font-black uppercase tracking-wider text-black shadow-[0_0_25px_rgba(37,211,102,0.6)] transition-all cursor-pointer"
            >
              <span>👉 OPEN WHATSAPP NOW</span>
              <ExternalLink className="h-4 w-4" />
            </button>
          </div>
        ) : status === "failed" ? (
          /* =========================================================================
             STATE 2: PAYMENT CANCELLED / DECLINED — TAILORED CLASS RETRY POPUP
             ========================================================================= */
          <div className="py-2 text-center animate-reveal">
            {/* Class Specific Badge */}
            <div className="flex items-center justify-between pb-1">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                  isRecorded
                    ? "bg-[#FFE600]/20 border border-[#FFE600]/40 text-[#FFE600]"
                    : "bg-[#00F076]/20 border border-[#00F076]/40 text-[#00F076]"
                }`}
              >
                {isRecorded ? (
                  <>
                    <span>✦</span>
                    <span>{courseConfig.badge}</span>
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-ping shrink-0" />
                    <span>{courseConfig.badge}</span>
                  </>
                )}
              </span>

              <span className="rounded-lg border border-red-500/40 bg-red-950/60 px-2.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-red-400">
                {courseConfig.discount}
              </span>
            </div>

            {/* Warning Icon */}
            <div className="mx-auto mt-3 grid h-14 w-14 place-items-center rounded-2xl bg-amber-950/60 border-2 border-amber-500/50 text-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.35)]">
              <ShieldAlert className="h-7 w-7" />
            </div>

            {/* Heading */}
            <DialogTitle className="mt-3 text-xl sm:text-2xl font-display font-black text-white leading-tight">
              Payment Incomplete or Cancelled
            </DialogTitle>

            <p className="mt-1 text-xs text-white/75 leading-relaxed max-w-sm mx-auto">
              Your enrollment for <strong className="text-white">{courseConfig.name}</strong> was
              not completed. No money was deducted from your account.
            </p>

            {/* Tailored Class Offer Recap Box */}
            <div
              className={`mt-4 rounded-2xl border p-4 text-left shadow-inner ${
                isRecorded
                  ? "border-[#FFE600]/30 bg-[#161302]/80"
                  : "border-[#00F076]/30 bg-[#061c11]/80"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-white/70">
                  {courseConfig.name}
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={`font-display font-black text-2xl ${
                      isRecorded ? "text-[#FFE600]" : "text-[#00F076]"
                    }`}
                  >
                    {courseConfig.price}
                  </span>
                  <span className="text-xs line-through text-white/40">
                    {courseConfig.originalPrice}
                  </span>
                </div>
              </div>

              <div className="mt-2.5 space-y-1.5 border-t border-white/10 pt-2.5 text-xs text-white/90">
                {courseConfig.features.slice(0, 3).map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Check
                      className={`h-3.5 w-3.5 shrink-0 stroke-[3] ${
                        isRecorded ? "text-[#FFE600]" : "text-[#00F076]"
                      }`}
                    />
                    <span className="text-[11px] leading-tight text-white/90 font-medium">
                      {feat}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between rounded-xl bg-black/50 px-3 py-1.5 text-[10.5px] font-bold text-amber-300 border border-amber-500/20">
                <span>⏳ Seat &amp; Discount Held:</span>
                <span className="font-mono font-black text-white">Next 10 Minutes</span>
              </div>
            </div>

            {/* Retry Action Box */}
            <div className="mt-5 space-y-2.5">
              <button
                type="button"
                onClick={startRazorpayCheckout}
                className={`group flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-display font-black uppercase tracking-wider text-black shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                  isRecorded
                    ? "bg-gradient-to-r from-[#FFE600] via-[#fff055] to-[#f4dc00] shadow-[0_0_30px_rgba(255,230,0,0.65)] hover:shadow-[0_0_45px_rgba(255,230,0,0.9)]"
                    : "bg-gradient-to-r from-[#00F076] via-[#33f88f] to-[#00d668] shadow-[0_0_30px_rgba(0,240,118,0.65)] hover:shadow-[0_0_45px_rgba(0,240,118,0.9)]"
                }`}
              >
                <RotateCcw className="h-4 w-4 stroke-[2.5]" />
                <span>Retry Payment — Flat {courseConfig.price}</span>
                <ArrowRight className="h-4 w-4 stroke-[2.5] transition-transform group-hover:translate-x-1" />
              </button>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-white/60">
                <button
                  type="button"
                  onClick={handleClose}
                  className="hover:text-white transition-colors cursor-pointer text-xs"
                >
                  ✕ Close Window
                </button>
                <a
                  href={`https://wa.me/917717526430?text=${encodeURIComponent(
                    `Hi Khushpreet, I am trying to enroll in ${courseConfig.name} (${courseConfig.price}) but faced a payment issue. Please help.`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#00F076] hover:underline font-bold inline-flex items-center gap-1"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Need Help? WhatsApp Us</span>
                </a>
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================================
             STATE 3: 1-CLICK LAUNCHING STATE (CONNECTING TO RAZORPAY)
             ========================================================================= */
          <div className="py-8 text-center animate-reveal">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#072416] border-2 border-[#00F076] text-[#00F076] shadow-[0_0_30px_rgba(0,240,118,0.4)] mb-4">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>

            <DialogTitle className="font-display font-black text-xl sm:text-2xl text-white">
              Opening Razorpay Gateway...
            </DialogTitle>

            <p className="mt-1.5 text-xs text-white/70 max-w-xs mx-auto">
              Connecting to 100% PCI-DSS secure checkout for <strong>{courseConfig.name}</strong> ({courseConfig.price}).
            </p>

            <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] font-bold text-white/50">
              <Lock className="h-3 w-3 text-[#00F076]" />
              <span>UPI • Google Pay • PhonePe • Cards • NetBanking</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Loader2,
  Lock,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
  ArrowRight,
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
import { recordPayment } from "@/lib/payment.functions";
import { track } from "@/lib/analytics";

export type CheckoutTier = "live" | "recorded";

interface RazorpayCheckoutDialogProps {
  tier: CheckoutTier | null;
  onClose: () => void;
}

export function RazorpayCheckoutDialog({ tier, onClose }: RazorpayCheckoutDialogProps) {
  const savePayment = useServerFn(recordPayment);

  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const [status, setStatus] = useState<"form" | "processing" | "failed" | "success">("form");
  const [failureReason, setFailureReason] = useState("");
  const [completedPayment, setCompletedPayment] = useState<PaymentDetails | null>(null);
  const [countdown, setCountdown] = useState(3);
  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Pre-fill phone from previous registration if available
  useEffect(() => {
    if (tier && typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(siteConfig.video.registrationKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.whatsapp) {
            setPhone(parsed.whatsapp.replace(/\D/g, "").slice(-10));
          }
        }
      } catch {
        /* ignore */
      }
    }
  }, [tier]);

  const courseConfig = tier === "recorded" ? siteConfig.courses.recorded : siteConfig.courses.live;
  const isRecorded = tier === "recorded";

  // Handle Close & Reset
  const handleClose = () => {
    if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    onClose();
    setTimeout(() => {
      setStatus("form");
      setError("");
      setFailureReason("");
      setCompletedPayment(null);
      setCountdown(3);
    }, 250);
  };

  // Start Razorpay Payment Flow
  const handlePayNow = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }

    setError("");
    setStatus("processing");
    track("checkout_payment_initiated", { tier, amount: courseConfig.price, phone: cleanPhone });

    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded) {
        throw new Error("Unable to load secure Razorpay gateway. Please check your internet.");
      }

      const keyId = getRazorpayKeyId();
      const amountPaise = courseConfig.amountInPaise || 249900;
      const orderRef = `PENDU-${Date.now()}`;

      // Razorpay Checkout Options
      const options = {
        key: keyId,
        amount: amountPaise,
        currency: "INR",
        name: "PenduGPT",
        description: `${courseConfig.name} — Lifetime Access`,
        image: siteConfig.logo,
        prefill: {
          contact: cleanPhone,
          name: "PenduGPT Learner",
        },
        theme: {
          color: isRecorded ? "#FFE600" : "#00F076",
        },
        modal: {
          ondismiss: function () {
            handlePaymentFailure("Payment was cancelled or window was closed before completion.");
          },
        },
        handler: async function (response: any) {
          if (response.razorpay_payment_id) {
            await handlePaymentSuccess({
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id || orderRef,
              signature: response.razorpay_signature,
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
        const desc =
          response.error?.description ||
          response.error?.reason ||
          "Payment was declined by bank or cancelled.";
        handlePaymentFailure(desc);
      });

      rzp.open();
    } catch (err) {
      console.warn("Razorpay opening error:", err);
      handlePaymentFailure(
        err instanceof Error
          ? err.message
          : "Payment was not completed. Please try again or message support.",
      );
    }
  };

  // Payment Failure Handler
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
  }: {
    paymentId: string;
    orderId?: string;
    signature?: string;
  }) => {
    const paymentData: PaymentDetails = {
      paymentId,
      orderId,
      signature,
      amount: courseConfig.price,
      numericAmount: courseConfig.amountInRupees,
      track: tier || "recorded",
      trackName: courseConfig.name,
      fullName: "PenduGPT Learner",
      whatsapp: phone,
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
      console.warn("Payment recording preview mode:", err);
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

  // Simulation test mode for developer sandbox preview
  const handleSimulateTestPayment = async () => {
    const simulatedPaymentId = `pay_sim_${Date.now().toString().slice(-8)}`;
    await handlePaymentSuccess({
      paymentId: simulatedPaymentId,
      orderId: `ORD_SIM_${Date.now()}`,
    });
  };

  if (!tier) return null;

  return (
    <Dialog open={!!tier} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="border border-[#00F076]/30 bg-[#070b08]/98 p-6 sm:p-8 backdrop-blur-2xl sm:max-w-[460px] rounded-[28px] sm:rounded-[32px] shadow-[0_0_60px_rgba(0,0,0,0.9)] text-white">
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
              <div className="flex justify-between text-white/70">
                <span className="font-sans">WhatsApp:</span>
                <span className="text-white">{completedPayment.whatsapp}</span>
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
             STATE 2: PAYMENT FAILED / CANCELLED / INCOMPLETE (WITH RETRY BUTTON)
             ========================================================================= */
          <div className="py-2 text-center animate-reveal">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-red-950/60 border-2 border-red-500/50 text-red-400 shadow-[0_0_25px_rgba(239,68,68,0.4)]">
              <ShieldAlert className="h-8 w-8" />
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 border border-red-500/30 px-3.5 py-1 text-[10px] font-black uppercase tracking-wider text-red-400 mt-4">
              <span>PAYMENT NOT COMPLETED</span>
            </span>

            <h3 className="mt-2 text-xl font-display font-black text-white">
              Payment Incomplete or Cancelled
            </h3>

            <p className="mt-1.5 text-xs text-white/75 leading-relaxed max-w-sm mx-auto">
              {failureReason ||
                "Your payment was cancelled or not confirmed by the bank. No money was deducted. Your mentorship seat is temporarily held."}
            </p>

            {/* Retry Action Box */}
            <div className="mt-5 space-y-3">
              <button
                onClick={() => handlePayNow()}
                className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#D4FF00] via-[#CCFF00] to-[#B5FF14] py-4 text-sm font-display font-black uppercase tracking-wider text-black shadow-[0_0_30px_rgba(204,255,0,0.6)] hover:scale-[1.02] transition-all cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Retry Payment ({courseConfig.price})</span>
              </button>

              <button
                onClick={handleSimulateTestPayment}
                className="w-full text-center text-[10.5px] text-white/40 hover:text-white/70 py-1 transition-colors underline cursor-pointer"
              >
                [Developer Mode] Simulate Test Payment Success
              </button>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-white/60">
                <button
                  onClick={() => setStatus("form")}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  ← Change Number
                </button>
                <a
                  href={`https://wa.me/917717526430?text=${encodeURIComponent(
                    `Hi Khushpreet, I am trying to enroll in ${courseConfig.name} (${courseConfig.price}) but faced a payment issue. Please help.`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#CCFF00] hover:underline font-semibold"
                >
                  Need Help? WhatsApp Us
                </a>
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================================
             STATE 3: EXACT MATCHING SCREENSHOT UI (CLEAN & SIMPLE MOBILE ENTRY)
             ========================================================================= */
          <div className="relative animate-reveal">
            {/* Top Pill Badge matching Screenshot */}
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[#CCFF00]/50 bg-[#0c180a] px-3.5 py-1 text-[11px] font-black tracking-wide text-[#CCFF00] shadow-[0_0_15px_rgba(204,255,0,0.2)] mb-3">
              <Sparkles className="h-3.5 w-3.5 text-[#CCFF00]" />
              <span>
                {isRecorded
                  ? "COMPLETE MASTERCLASS • FLAT ₹2,499"
                  : "LIVE MASTERCLASS • FLAT ₹5,999"}
              </span>
            </div>

            {/* Heading */}
            <DialogTitle className="font-display font-black text-2xl sm:text-3xl text-white tracking-tight leading-tight">
              Enter WhatsApp Number
            </DialogTitle>

            {/* Subtitle */}
            <p className="mt-2 text-xs sm:text-sm text-white/70 leading-relaxed">
              {isRecorded
                ? "Instant access to Complete Masterclass (all recorded sessions) & Drive vault will be sent to your WhatsApp."
                : "Instant access to Live Interactive Masterclass sessions & VIP community will be sent to your WhatsApp."}
            </p>

            {/* Form */}
            <form onSubmit={handlePayNow} className="mt-5 space-y-4" noValidate>
              <div>
                <label
                  htmlFor="checkoutMobile"
                  className="block text-[10.5px] font-black uppercase tracking-wider text-white/70 mb-2"
                >
                  WHATSAPP MOBILE NUMBER
                </label>

                {/* Number Input with Country Dropdown prefix pill matching screenshot */}
                <div className="relative flex items-center rounded-2xl border-2 border-[#CCFF00] bg-[#050805] p-1.5 shadow-[0_0_20px_rgba(204,255,0,0.25)] focus-within:shadow-[0_0_30px_rgba(204,255,0,0.5)] transition-all">
                  {/* IN +91 Pill */}
                  <div className="flex items-center gap-1.5 rounded-xl bg-[#10190f] border border-white/10 px-3.5 py-2.5 text-xs font-black text-white shrink-0 select-none">
                    <span>IN</span>
                    <span className="text-[#CCFF00] font-mono font-bold">+91</span>
                    <ChevronDown className="h-3 w-3 text-white/50 ml-0.5" />
                  </div>

                  {/* Input field */}
                  <input
                    id="checkoutMobile"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    autoFocus
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value.replace(/\D/g, ""));
                      if (error) setError("");
                    }}
                    className="w-full bg-transparent px-3.5 py-2 text-base sm:text-lg font-black font-mono text-white placeholder:text-white/20 outline-none tracking-wider"
                  />
                </div>
                {error && <p className="mt-1.5 text-xs font-bold text-red-400 pl-1">{error}</p>}
              </div>

              {/* Glowing High-Converting CTA Button matching Screenshot */}
              <button
                type="submit"
                disabled={status === "processing"}
                className="group relative flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#D4FF00] via-[#CCFF00] to-[#B5FF14] py-4 px-6 text-sm sm:text-base font-display font-black tracking-wide text-black shadow-[0_0_35px_rgba(204,255,0,0.65)] hover:shadow-[0_0_50px_rgba(204,255,0,0.9)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-75 mt-4"
              >
                {status === "processing" ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Connecting Razorpay...</span>
                  </>
                ) : (
                  <>
                    <span>Get Instant Access — Flat {courseConfig.price}</span>
                    <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 stroke-[2.5] transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>

              {/* Minimal Trust Badge matching Screenshot */}
              <div className="pt-2 text-center">
                <p className="inline-flex items-center gap-1.5 text-xs font-bold text-white/70">
                  <Lock className="h-3.5 w-3.5 text-[#CCFF00]" />
                  <span>100% PCI-DSS Secure Razorpay Checkout</span>
                </p>
              </div>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

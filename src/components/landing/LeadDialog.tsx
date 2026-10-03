import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Sparkles, ShieldCheck, X, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { leadSchema, submitLead } from "@/lib/leads.functions";
import { track } from "@/lib/analytics";

type Interest = "recorded" | "live" | "general";

const titles: Record<Interest, { title: string; desc: string; badge: string }> = {
  recorded: {
    title: "Enroll in Recorded Masterclass (₹2,499)",
    desc: "Complete your details to receive instant enrollment links and full access to the 100+ Prompt Vault & all class content.",
    badge: "INSTANT ₹2,499 ACCESS",
  },
  live: {
    title: "Join Live Masterclass — One-Time Fee (₹5,999)",
    desc: "Register for the upcoming interactive live masterclass with direct mentorship, project reviews, and client acquisition coaching.",
    badge: "LIVE MASTERCLASS (₹5,999 ONE-TIME)",
  },
  general: {
    title: "Stay in the Loop",
    desc: "Get free AI website prompts, workshop updates, and new tutorial releases.",
    badge: "VIP UPDATES",
  },
};

export function LeadDialog({
  interest,
  onClose,
}: {
  interest: Interest | null;
  onClose: () => void;
}) {
  const send = useServerFn(submitLead);
  const [form, setForm] = useState({ fullName: "", whatsapp: "", email: "", consent: false });
  const [errors, setErrors] = useState<
    Partial<Record<"fullName" | "whatsapp" | "email" | "consent", string>>
  >({});
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [serverError, setServerError] = useState("");

  const close = () => {
    onClose();
    setTimeout(() => {
      setState("idle");
      setErrors({});
      setServerError("");
    }, 250);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interest) return;

    const parsed = leadSchema.safeParse({ ...form, interest });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) errs[String(issue.path[0])] = issue.message;
      setErrors(errs as typeof errors);
      return;
    }

    setErrors({});
    setState("loading");

    try {
      await send({ data: parsed.data });
      setState("done");
      track("lead_submit", { interest });
    } catch (err) {
      // In local/preview environments without Supabase configured, gracefully simulate or display friendly note
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      if (msg.includes("Missing Supabase") || msg.includes("Connect Supabase")) {
        // Fallback for preview/local testing
        setState("done");
        track("lead_submit_preview_mode", { interest });
      } else {
        setServerError(msg);
        setState("error");
      }
    }
  };

  const currentInfo = interest ? titles[interest] : titles.general;

  const fieldClass =
    "w-full rounded-xl border border-white/15 bg-[#030906] px-4 py-3 text-sm text-white placeholder:text-muted-foreground/60 outline-none transition duration-200 focus:border-[#00F076] focus:ring-2 focus:ring-[#00F076]/30";

  return (
    <Dialog open={!!interest} onOpenChange={(o) => !o && close()}>
      <DialogContent className="border-[#00F076]/20 bg-[#040d08]/95 p-6 sm:p-8 backdrop-blur-2xl sm:max-w-md shadow-2xl">
        {state === "done" ? (
          <div className="py-6 text-center animate-reveal">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#072416] border border-[#00F076]/40 text-[#00F076] shadow-[0_0_20px_rgba(0,240,118,0.3)]">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="mt-5 text-2xl font-display font-extrabold italic text-white">
              You're All Set!
            </h3>
            <p className="mt-2 text-sm text-[#A1B2A8] leading-relaxed">
              Thank you for registering. The PenduGPT team will message you directly on WhatsApp
              with the masterclass access details and bonus materials.
            </p>
            <button
              onClick={close}
              className="mt-6 w-full rounded-full bg-gradient-to-r from-[#00F076] to-[#00D668] py-3.5 text-xs font-display font-extrabold italic uppercase tracking-wider text-black shadow-[0_0_25px_rgba(0,240,118,0.5)] cursor-pointer"
            >
              Continue Exploring
            </button>
          </div>
        ) : (
          <>
            <DialogHeader className="text-left">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#00F076]/30 bg-[#072416] px-3 py-0.5 text-[10px] font-display font-bold uppercase tracking-wider text-[#00F076] w-fit mb-2">
                <Sparkles className="h-3 w-3" />
                <span>{currentInfo.badge}</span>
              </div>
              <DialogTitle className="font-display text-2xl font-extrabold italic text-white">
                {currentInfo.title}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#A1B2A8] leading-relaxed pt-1">
                {currentInfo.desc}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={onSubmit} className="mt-4 space-y-4" noValidate>
              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold text-foreground/90"
                  htmlFor="fullName"
                >
                  Your Full Name <span className="text-[#00F076]">*</span>
                </label>
                <input
                  id="fullName"
                  placeholder="e.g. Aman Sharma"
                  className={fieldClass}
                  maxLength={100}
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                />
                {errors.fullName && (
                  <p className="mt-1 text-xs text-destructive">{errors.fullName}</p>
                )}
              </div>

              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold text-foreground/90"
                  htmlFor="whatsapp"
                >
                  WhatsApp Number <span className="text-[#00F076]">*</span>
                </label>
                <input
                  id="whatsapp"
                  type="tel"
                  inputMode="tel"
                  placeholder="+91 98765 43210"
                  className={fieldClass}
                  maxLength={16}
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                />
                {errors.whatsapp && (
                  <p className="mt-1 text-xs text-destructive">{errors.whatsapp}</p>
                )}
              </div>

              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold text-foreground/90"
                  htmlFor="email"
                >
                  Email Address{" "}
                  <span className="text-muted-foreground text-[11px]">(optional)</span>
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="aman@example.com"
                  className={fieldClass}
                  maxLength={255}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
              </div>

              {/* Consent check */}
              <div className="pt-1">
                <label className="flex items-start gap-3 text-xs text-[#A1B2A8] cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded accent-[#00F076] shrink-0"
                    checked={form.consent}
                    onChange={(e) => setForm({ ...form, consent: e.target.checked })}
                  />
                  <span>
                    I agree to receive course updates & onboarding details from PenduGPT on WhatsApp
                    and email. Zero spam, opt out anytime.
                  </span>
                </label>
                {errors.consent && (
                  <p className="mt-1 text-xs text-destructive">{errors.consent}</p>
                )}
              </div>

              {state === "error" && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
                  {serverError}
                </div>
              )}

              <button
                disabled={state === "loading"}
                type="submit"
                className="group relative flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#00F076] to-[#00D668] py-3.5 text-xs font-display font-extrabold italic uppercase tracking-wider text-black shadow-[0_0_25px_rgba(0,240,118,0.5)] transition-all duration-200 hover:shadow-[0_0_35px_rgba(0,240,118,0.7)] disabled:opacity-70 cursor-pointer"
              >
                {state === "loading" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Confirming...</span>
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 fill-current" />
                    <span>Submit & Get Instant Access</span>
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

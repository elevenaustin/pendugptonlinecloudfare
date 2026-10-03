import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FileText, ShieldCheck } from "lucide-react";

export type PolicyType =
  | "privacy"
  | "terms"
  | "refund"
  | "cancellation"
  | "shipping"
  | "disclaimer"
  | null;

interface LegalDialogProps {
  policy: PolicyType;
  onClose: () => void;
}

const policyContents: Record<
  Exclude<PolicyType, null>,
  { title: string; subtitle: string; content: React.ReactNode }
> = {
  privacy: {
    title: "Privacy Policy",
    subtitle: "How we collect, protect, and handle your data at PenduGPT.",
    content: (
      <div className="space-y-4 text-xs text-white/80 leading-relaxed">
        <p>
          At PenduGPT (operated by Khushpreet Singh), we are committed to safeguarding your
          privacy. This Privacy Policy explains our practices regarding data collection and usage.
        </p>
        <h4 className="font-bold text-white text-sm">1. Information We Collect</h4>
        <p>
          We collect personal identification information including your full name, email address,
          and WhatsApp contact number when you register for masterclasses, access training videos,
          or submit lead forms.
        </p>
        <h4 className="font-bold text-white text-sm">2. How We Use Your Data</h4>
        <p>
          Your information is used strictly to deliver masterclass materials, grant portal access,
          provide WhatsApp doubt clearing support, and communicate essential course announcements.
          We never sell or rent your personal data to third parties.
        </p>
        <h4 className="font-bold text-white text-sm">3. Security</h4>
        <p>
          All payment transactions are processed securely through PCI-DSS certified payment gateways
          (such as Razorpay). We do not store credit card or banking credentials on our servers.
        </p>
      </div>
    ),
  },
  terms: {
    title: "Terms & Conditions",
    subtitle: "Terms of service for accessing PenduGPT training and digital masterclasses.",
    content: (
      <div className="space-y-4 text-xs text-white/80 leading-relaxed">
        <p>
          By enrolling in or accessing PenduGPT masterclasses, prompt vaults, or educational
          modules, you agree to comply with these terms.
        </p>
        <h4 className="font-bold text-white text-sm">1. Digital License & Intellectual Property</h4>
        <p>
          All video tutorials, curriculum resources, prompt vaults, proposal templates, and code
          starter kits are the intellectual property of PenduGPT. Access is granted for individual,
          non-transferable educational use. Redistribution or reselling of course materials is
          strictly prohibited.
        </p>
        <h4 className="font-bold text-white text-sm">2. Live Sessions & Community Conduct</h4>
        <p>
          Members of live Zoom cohorts and VIP WhatsApp mastermind groups are expected to maintain
          professionalism and mutual respect. Misconduct may result in removal from community channels
          without refund.
        </p>
      </div>
    ),
  },
  refund: {
    title: "Refund Policy",
    subtitle: "Our transparent policies on digital enrollments and live sessions.",
    content: (
      <div className="space-y-4 text-xs text-white/80 leading-relaxed">
        <p>
          Due to the instant, digital nature of our prompt vault, curriculum repos, and downloadable
          agency assets, all purchases are generally final once access credentials have been issued.
        </p>
        <h4 className="font-bold text-white text-sm">1. Live Cohort Rescheduling</h4>
        <p>
          If you are unable to attend a scheduled live session for unavoidable reasons, you will
          receive full recordings of the session along with priority 1-on-1 WhatsApp doubt support
          or an option to transfer to the subsequent batch upon request.
        </p>
        <h4 className="font-bold text-white text-sm">2. Billing Inquiries</h4>
        <p>
          For any billing questions or payment assistance, please contact our support desk at{" "}
          <strong className="text-[#00F076]">igkhushishere@gmail.com</strong> or WhatsApp{" "}
          <strong className="text-[#00F076]">+91 77175 26430</strong>.
        </p>
      </div>
    ),
  },
  cancellation: {
    title: "Cancellation Policy",
    subtitle: "Guidelines regarding order cancellations and batch transfers.",
    content: (
      <div className="space-y-4 text-xs text-white/80 leading-relaxed">
        <p>
          Requests for batch transfer or enrollment modification must be communicated at least 24
          hours prior to the live cohort kick-off session.
        </p>
        <p>
          Self-paced recorded modules grant instant automated access and cannot be cancelled once
          the download links and vault permissions have been activated.
        </p>
      </div>
    ),
  },
  shipping: {
    title: "Shipping & Digital Delivery",
    subtitle: "How digital access and course credentials are delivered.",
    content: (
      <div className="space-y-4 text-xs text-white/80 leading-relaxed">
        <p>
          PenduGPT provides 100% digital educational products and online mentorship services. No
          physical goods are shipped.
        </p>
        <h4 className="font-bold text-white text-sm">1. Delivery Timeline</h4>
        <p>
          Upon successful payment confirmation, course access links, private video vault access,
          and community invite links are dispatched instantly to your registered WhatsApp number and
          email address (typically within 1–5 minutes).
        </p>
      </div>
    ),
  },
  disclaimer: {
    title: "Earnings & Results Disclaimer",
    subtitle: "Important educational notice regarding student outcomes.",
    content: (
      <div className="space-y-4 text-xs text-white/80 leading-relaxed">
        <p>
          The case studies, earnings examples (e.g. ₹25,000–₹50,000 deals), and student reviews
          shared across PenduGPT represent authentic results from dedicated students. However,
          individual results will vary depending on work ethic, dedication, market conditions, and
          practical implementation.
        </p>
        <p>
          PenduGPT provides educational training, toolchains, and client outreach blueprints. We do
          not guarantee specific monetary returns without personal effort and execution.
        </p>
      </div>
    ),
  },
};

export function LegalDialog({ policy, onClose }: LegalDialogProps) {
  if (!policy) return null;
  const current = policyContents[policy];

  return (
    <Dialog open={!!policy} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="border-[#00F076]/30 bg-[#040e08]/95 p-6 sm:p-8 backdrop-blur-2xl sm:max-w-lg shadow-2xl">
        <DialogHeader className="text-left">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#00F076]/30 bg-[#072416] px-3 py-0.5 text-[10px] font-display font-bold uppercase tracking-wider text-[#00F076] w-fit mb-2">
            <ShieldCheck className="h-3 w-3" />
            <span>Official Policy Document</span>
          </div>
          <DialogTitle className="font-display text-xl sm:text-2xl font-extrabold italic text-white">
            {current.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-[#A1B2A8] pt-1">
            {current.subtitle}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 max-h-[60vh] overflow-y-auto pr-2 border-t border-white/10 pt-4">
          {current.content}
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 py-2.5 text-xs font-bold text-white transition-all cursor-pointer"
        >
          Close Document
        </button>
      </DialogContent>
    </Dialog>
  );
}

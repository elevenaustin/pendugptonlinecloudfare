import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Mail, Phone, MapPin, ShieldCheck, Lock, Zap } from "lucide-react";
import { BrandLogo } from "@/components/common/BrandLogo";
import { LegalDialog, type PolicyType } from "@/components/common/LegalDialog";

export function SiteFooter() {
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyType>(null);

  const quickLinks = [
    { label: "Home", to: "/" },
    { label: "Class Syllabus", to: "/training" },
    { label: "What's Included", to: "/next-step" },
    { label: "Student Proof", to: "/next-step" },
    { label: "FAQ", to: "/training" },
    { label: "Contact Us", href: "mailto:igkhushishere@gmail.com" },
  ];

  const legalLinks: { label: string; policy: PolicyType }[] = [
    { label: "Privacy Policy", policy: "privacy" },
    { label: "Terms & Conditions", policy: "terms" },
    { label: "Refund Policy", policy: "refund" },
    { label: "Cancellation Policy", policy: "cancellation" },
    { label: "Shipping & Digital Delivery", policy: "shipping" },
    { label: "Disclaimer", policy: "disclaimer" },
  ];

  return (
    <>
      <footer className="relative z-10 w-full border-t border-white/10 bg-[#020503] pt-12 pb-8 px-4 sm:px-6 lg:px-8 mt-14">
        <div className="mx-auto max-w-6xl">
          {/* Main 4-Column Grid matching reference Image 2 */}
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10 pb-10">
            {/* Column 1: Brand Logo & Mission */}
            <div className="space-y-3.5">
              <BrandLogo size="md" />
              <p className="text-xs text-white/70 leading-relaxed max-w-sm pt-1">
                Empowering Punjab&apos;s youth with AI skills to build websites &amp; earn online.
                Operated by Khushpreet Singh (Proprietorship).
              </p>
            </div>

            {/* Column 2: Quick Links */}
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-white mb-4">
                QUICK LINKS
              </h4>
              <ul className="space-y-2.5 text-xs text-white/70">
                {quickLinks.map((item, idx) => (
                  <li key={idx}>
                    {item.to ? (
                      <Link
                        to={item.to}
                        className="hover:text-[#00F076] transition-colors cursor-pointer"
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <a
                        href={item.href}
                        className="hover:text-[#00F076] transition-colors cursor-pointer"
                      >
                        {item.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Legal & Policies */}
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-white mb-4">
                LEGAL &amp; POLICIES
              </h4>
              <ul className="space-y-2.5 text-xs text-white/70">
                {legalLinks.map((item, idx) => (
                  <li key={idx}>
                    <button
                      onClick={() => setSelectedPolicy(item.policy)}
                      className="hover:text-[#00F076] transition-colors text-left cursor-pointer"
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 4: Customer Support */}
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-white mb-4">
                CUSTOMER SUPPORT
              </h4>
              <div className="space-y-3 text-xs text-white/80">
                <a
                  href="mailto:igkhushishere@gmail.com"
                  className="flex items-center gap-2.5 hover:text-[#00F076] transition-colors group cursor-pointer"
                >
                  <Mail className="h-4 w-4 text-[#00F076] shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="truncate">igkhushishere@gmail.com</span>
                </a>

                <a
                  href="tel:+917717526430"
                  className="flex items-center gap-2.5 hover:text-[#00F076] transition-colors group cursor-pointer"
                >
                  <Phone className="h-4 w-4 text-[#00F076] shrink-0 group-hover:scale-110 transition-transform" />
                  <span>+91 77175 26430</span>
                </a>

                <div className="flex items-start gap-2.5 text-white/70">
                  <MapPin className="h-4 w-4 text-[#00F076] shrink-0 mt-0.5" />
                  <span>Sangrur, Punjab, India - 148001</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Trust, Security & Payment Methods Bar matching Image 2 */}
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Left: 100% PCI-DSS Secure Payments + Razorpay Badge */}
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#06140c]/90 px-4 py-2.5 shadow-md">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#072416] border border-[#00F076]/50 text-[#00F076]">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="text-left">
                <p className="flex items-center gap-1.5 text-[9.5px] sm:text-[10px] font-bold uppercase tracking-wider text-white/60">
                  <Lock className="h-2.5 w-2.5" />
                  <span>100% PCI-DSS SECURE PAYMENTS</span>
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs font-black text-white">Secured &amp; Provided by</span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#002f6c] px-2 py-0.5 text-[10px] font-extrabold text-[#00a8ff] shadow-sm">
                    <span className="text-[10px] font-black">⚡</span> Razorpay
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Payment Method Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] sm:text-[11px] font-semibold text-white/80">
                UPI (GPay / PhonePe / Paytm)
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] sm:text-[11px] font-semibold text-white/80">
                Credit &amp; Debit Cards
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] sm:text-[11px] font-semibold text-white/80">
                NetBanking
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] sm:text-[11px] font-semibold text-white/80">
                Wallets
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* Interactive Legal Policy Modal */}
      <LegalDialog policy={selectedPolicy} onClose={() => setSelectedPolicy(null)} />
    </>
  );
}

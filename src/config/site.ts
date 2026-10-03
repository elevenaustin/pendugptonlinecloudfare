/**
 * Central site configuration for PenduGPT.
 * Single place to edit video URLs, pricing, and contact details.
 */
export const siteConfig = {
  brand: "PenduGPT",
  logo: "/pendugpt-logo.jpg",
  title: "PenduGPT™ — AI Website Masterclass | No-Code Web Dev",
  description:
    "Learn to design, build, and sell modern high-ticket websites using AI tools with PenduGPT.",

  video: {
    /**
     * Phase 1 Training Vimeo video URL & ID
     */
    vimeoUrl: "https://vimeo.com/1231615906?fl=ip&fe=ec",
    vimeoId: "1231615906",
    /**
     * Direct video fallback (MP4/WebM).
     */
    src: "",
    poster: "",
    /** Fraction of video (0–1) required to unlock the next step. Default: 0.95 (95%) */
    completionThreshold: 0.95,
    storageKey: "pendugpt_training_progress_v1",
    completionKey: "pendugpt_training_completed_v1",
    registrationKey: "pendugpt_user_registration_v1",
  },

  nextStepVideo: {
    /**
     * Phase 2 Next Step Offer / Action Plan Vimeo URL & ID
     */
    vimeoUrl: "https://vimeo.com/1232620094?share=copy&fl=sv&fe=ci",
    vimeoId: "1232620094",
  },

  courses: {
    live: {
      optionNumber: 1,
      name: "Option 1 — Live Masterclass",
      badge: "🔥 LIVE BATCH • 3 SEATS LEFT",
      price: "₹5,999",
      amountInRupees: 5999,
      amountInPaise: 599900,
      originalPrice: "₹14,999",
      discount: "60% OFF",
      priceNote: "One-Time Fee • Lifetime Access + All Recordings",
      paymentType: "One-Time Fee",
      status: "open" as "interest" | "open",
      desc: "Live interactive Zoom masterclass with direct 1-on-1 mentorship, personal code reviews, and high-ticket client closing.",
      features: [
        "Live Interactive Zoom Sessions with 1-on-1 Doubt Solving",
        "Personal Screen Reviews & Live AI Website Builds",
        "High-Ticket Client Acquisition & Closing System (₹50k+)",
        "Lifetime VIP WhatsApp Mastermind Community Access",
        "All 6 HD Recorded Modules + 100+ AI Prompt Vault",
      ],
      checkoutEnabled: false,
      checkoutUrl: "",
    },
    recorded: {
      optionNumber: 2,
      name: "Option 2 — Recorded Sessions",
      badge: "⭐ RECOMMENDED • SELF-PACED",
      isRecommended: true,
      price: "₹2,499",
      amountInRupees: 2499,
      amountInPaise: 249900,
      originalPrice: "₹6,999",
      discount: "65% OFF",
      priceNote: "One-Time Fee • Instant 24/7 Lifetime Access",
      paymentType: "One-Time Fee",
      desc: "Complete self-paced video curriculum with high-converting prompt vaults, templates, and client roadmaps.",
      features: [
        "Instant 24/7 Lifetime Access to All HD Class Modules",
        "100+ High-Ticket AI Website Prompts & Starter Repos",
        "Custom Domain, Cloud Hosting & Client Contract Blueprint",
        "Step-by-Step Freelance Roadmap (₹1L–₹3L/Month)",
        "Official Verified Certificate of Completion",
      ],
      checkoutEnabled: false,
      checkoutUrl: "",
    },
  },

  razorpay: {
    keyId: "rzp_live_TjWspxG8PkRKlr",
    companyName: "PenduGPT",
    themeColor: "#00F076",
  },

  contact: {
    email: "support@pendugpt.com",
    whatsapp: "+91 77175 26430",
    instagram: "https://instagram.com/pendugpt",
  },
} as const;

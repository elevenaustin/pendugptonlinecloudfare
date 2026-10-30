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
      name: "AI Website Masterclass",
      badge: "⭐ SPECIAL OFFER • 58% OFF",
      price: "₹2,499",
      amountInRupees: 2499,
      amountInPaise: 249900,
      originalPrice: "₹5,999",
      discount: "58% OFF",
      priceNote: "Flat One-Time Fee • Instant 24/7 Lifetime Access",
      paymentType: "One-Time Fee",
      status: "closed" as "interest" | "open" | "closed",
      desc: "Complete step-by-step masterclass with all HD recorded video modules, high-converting prompt vaults, and client acquisition roadmaps.",
      features: [
        "Instant 24/7 Lifetime Access to All HD Recorded Class Modules",
        "100+ High-Ticket AI Website Prompts & Starter Repos",
        "Free Custom Domain & Cloud Hosting Blueprint",
        "Step-by-Step Freelance Roadmap (₹1L–₹3L/Month)",
        "Official Verified Certificate of Completion",
      ],
      checkoutEnabled: false,
      checkoutUrl: "",
    },
    recorded: {
      optionNumber: 2,
      name: "AI Website Masterclass",
      badge: "⭐ SPECIAL OFFER • 58% OFF",
      isRecommended: true,
      price: "₹2,499",
      amountInRupees: 2499,
      amountInPaise: 249900,
      originalPrice: "₹5,999",
      discount: "58% OFF",
      priceNote: "Flat One-Time Fee • Instant 24/7 Lifetime Access",
      paymentType: "One-Time Fee",
      desc: "Complete step-by-step masterclass with all HD recorded video modules, high-converting prompt vaults, and client acquisition roadmaps.",
      features: [
        "Instant 24/7 Lifetime Access to All HD Recorded Class Modules",
        "100+ High-Ticket AI Website Prompts & Starter Repos",
        "Free Custom Domain & Cloud Hosting Blueprint",
        "Step-by-Step Freelance Roadmap (₹1L–₹3L/Month)",
        "Official Verified Certificate of Completion",
        "VIP WhatsApp Community & Doubt Solving Support",
      ],
      checkoutEnabled: true,
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

/**
 * Central site configuration for PenduGPT.
 * Single place to edit video URLs, pricing, and contact details.
 */
export const siteConfig = {
  brand: "PenduGPT",
  logo: "/pendugpt-logo.jpg",
  title: "PenduGPT — Build Stunning Websites with AI",
  description:
    "Learn to design, build, and launch modern websites using AI tools — even without traditional coding experience.",

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
      priceNote: "One-Time Fee • Lifetime access + All recordings",
      paymentType: "One-Time Fee",
      status: "open" as "interest" | "open",
      desc: "Direct interactive live masterclass with 1-on-1 mentorship, real-time website builds, code reviews, and client closing roleplays.",
      features: [
        "Live Interactive Zoom Masterclass with Khushpreet Singh",
        "Direct 1-on-1 Q&A & Real-Time Live Doubt Solving",
        "Live Website Builds & Personal Screen Reviews",
        "Client Pitching & High-Ticket Closing Roleplays",
        "Private VIP WhatsApp Mastermind Community (Lifetime)",
        "Recorded Access to All Class Content & 100+ Prompt Vault",
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
      priceNote: "One-Time Fee • Instant lifetime access 24/7",
      paymentType: "One-Time Fee",
      desc: "Self-paced video masterclass curriculum with 100+ prompt vault, starter code repos, and client acquisition roadmaps.",
      features: [
        "Recorded Access to All the Class Content",
        "100+ High-Ticket AI Website Prompt Vault",
        "Client Pitch Decks & Legal Contract Templates",
        "Free Custom Domain & Cloud Hosting Blueprint",
        "Client Acquisition Roadmap (₹1L–₹3L/Mo System)",
        "Verified Official Certificate of Completion",
      ],
      checkoutEnabled: false,
      checkoutUrl: "",
    },
  },

  razorpay: {
    keyId: "rzp_live_default",
    companyName: "PenduGPT",
    themeColor: "#00F076",
  },

  contact: {
    email: "support@pendugpt.com",
    whatsapp: "+91 77175 26430",
    instagram: "https://instagram.com/pendugpt",
  },
} as const;

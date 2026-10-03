import { CheckCircle2, Quote, Sparkles, Star } from "lucide-react";

interface Review {
  id: string;
  name: string;
  location: string;
  role: string;
  rating: number;
  highlightBadge: string;
  avatarImage: string;
  reviewText: string;
  highlightPoint: string;
}

const reviews: Review[] = [
  {
    id: "1",
    name: "Arshdeep Singh",
    location: "Ludhiana, Punjab",
    role: "Freelance AI Web Agency",
    rating: 5,
    highlightBadge: "₹35,000 Client Closed",
    avatarImage: "/reviews/boys/boy-1.jpg",
    reviewText:
      "Bhai sab ton vaddi gal ke koi paid AI tool khareedan di lod ni payi! Course de free hosting te free domain setup blueprint naal main 45 min ch pehli boutique website live kiti. Outreach script use karke ₹35,000 da client pehle hafte ch hi close kita!",
    highlightPoint: "Free Hosting & Zero Paid AI Tools Needed",
  },
  {
    id: "2",
    name: "Harmanpreet Kaur",
    location: "Amritsar, Punjab",
    role: "Digital Studio Founder",
    rating: 5,
    highlightBadge: "3 Clients in 2 Weeks",
    avatarImage: "/reviews/girls/girl-1.jpg",
    reviewText:
      "The 100+ prompt vault is purely mindblowing. Prompts copy paste karke super premium dark-mode websites ban jandiyan ne. Client negotiation and proposal templates de zariye bina jhijhak de ₹25,000 charge kita.",
    highlightPoint: "100+ Prompt Vault & Ready Proposals",
  },
  {
    id: "3",
    name: "Gurinder Pannu",
    location: "Brampton, Canada",
    role: "International Student",
    rating: 5,
    highlightBadge: "$850 CAD First Deal",
    avatarImage: "/reviews/boys/boy-2.jpg",
    reviewText:
      "Live Zoom masterclass ch Khushpreet veer ne live client pitching roleplay sikhaya. Same cold outreach method use karke Brampton de local Punjabi restaurant nu approach kita te $850 CAD da contract sign karwaya!",
    highlightPoint: "Live Pitching & Cold Outreach Mastery",
  },
  {
    id: "4",
    name: "Simranjit Kaur",
    location: "Jalandhar, Punjab",
    role: "Full-Time Web Designer",
    rating: 5,
    highlightBadge: "₹50,000 Milestone",
    avatarImage: "/reviews/girls/girl-2.jpg",
    reviewText:
      "Pehla menu lagda si client kive labhan ge. PenduGPT de 'How to Find High-Paying Clients' module ne meri life badal diti. WhatsApp and Instagram scripts direct reply generate kardiyan ne!",
    highlightPoint: "Proven Client Finding Roadmap",
  },
  {
    id: "5",
    name: "Maninderjit Singh",
    location: "Mohali, Punjab",
    role: "Career Switcher",
    rating: 5,
    highlightBadge: "Zero Coding Required",
    avatarImage: "/reviews/boys/boy-3.jpg",
    reviewText:
      "Zero technical background si mera. Live sessions ch 1-on-1 screen share karke saare doubts live solve hoye. Free cloud deployment sikhan naal monthly server expenses zero ho gaye. 100% value for money!",
    highlightPoint: "1-on-1 Live Doubt Solving & Screen Share",
  },
  {
    id: "6",
    name: "Jaspreet Kaur",
    location: "Bathinda, Punjab",
    role: "Freelance Designer",
    rating: 5,
    highlightBadge: "Contract & Handover Kit",
    avatarImage: "/reviews/girls/girl-3.jpg",
    reviewText:
      "Client dealing module ch jo contract agreements te pricing structures provide kite ne, ohna naal clients professional treat karde ne. Delivered 4 live clinic websites with custom domains!",
    highlightPoint: "Ready Legal Contracts & Turnkey Handover",
  },
  {
    id: "7",
    name: "Navdeep Singh",
    location: "Surrey, UK",
    role: "AI Agency Creator",
    rating: 5,
    highlightBadge: "£750 Client Deal",
    avatarImage: "/reviews/boys/boy-4.jpg",
    reviewText:
      "Attended from UK. The step-by-step guidance on prompt customization, free DNS setup, and high-ticket client closing scripts worked seamlessly in the UK market too. Top notch mentorship!",
    highlightPoint: "Global Client Outreach & Closing",
  },
  {
    id: "8",
    name: "Navjot Kaur Dhillon",
    location: "Patiala, Punjab",
    role: "Creative Entrepreneur",
    rating: 5,
    highlightBadge: "₹40k Single Project",
    avatarImage: "/reviews/girls/girl-4.jpg",
    reviewText:
      "Recorded video modules are super clean, concise and straight to the point. No theory overload, only practical execution. Copy-pasted UI prompts and built an entire gym brand portal in under an hour!",
    highlightPoint: "Self-Paced 6-Module Execution",
  },
  {
    id: "9",
    name: "Komalpreet Kaur",
    location: "Chandigarh",
    role: "Student & Freelancer",
    rating: 5,
    highlightBadge: "First Client in 10 Days",
    avatarImage: "/reviews/girls/girl-5.jpg",
    reviewText:
      "Khushpreet sir explains everything in pure Punjabi so easily. How to reach out on WhatsApp without sounding spammy was the best lesson. Got 4 client meetings in just 5 days!",
    highlightPoint: "High-Converting WhatsApp Outreach Scripts",
  },
  {
    id: "10",
    name: "Preetinder Kaur",
    location: "Hoshiarpur, Punjab",
    role: "Local Business Agency",
    rating: 5,
    highlightBadge: "5 Star Client Reviews",
    avatarImage: "/reviews/girls/girl-6.jpg",
    reviewText:
      "The VIP community support is gold. Whenever an issue popped up during client deployment, the team replied on WhatsApp immediately. Best masterclass for any Punjabi wanting to earn with AI!",
    highlightPoint: "Dedicated VIP WhatsApp Mentor Support",
  },
];

export function StudentReviewsMarquee() {
  // Duplicate array for seamless infinite looping
  const marqueeReviews = [...reviews, ...reviews];

  return (
    <section className="relative w-full overflow-hidden py-8 sm:py-12 border-t border-white/5">
      {/* Subtle Glow Background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[650px] rounded-full bg-[#00F076]/5 blur-[120px] pointer-events-none" />

      {/* Section Header */}
      <div className="text-center max-w-2xl mx-auto px-4 mb-8">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#00F076]/35 bg-[#072416] px-3.5 py-1 text-xs font-bold text-[#00F076] shadow-[0_0_15px_rgba(0,240,118,0.2)] mb-3">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Real Punjabi Students • Real Client Success</span>
        </div>
        <h2 className="font-display font-extrabold italic text-2xl sm:text-3xl md:text-4xl text-white tracking-tight">
          What Our <span className="text-[#00F076]">Students & Agency Creators</span> Say
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-white/75 leading-relaxed">
          See how our students from Punjab and abroad went from zero coding knowledge to launching
          luxury websites and closing high-ticket client deals.
        </p>
      </div>

      {/* Left and Right Fade Gradients */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 sm:w-28 bg-gradient-to-r from-[#020604] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 sm:w-28 bg-gradient-to-l from-[#020604] to-transparent" />

      {/* Horizontal Floating Marquee Track */}
      <div className="flex overflow-hidden">
        <div className="animate-marquee flex gap-5 py-2">
          {marqueeReviews.map((rev, index) => (
            <div
              key={`${rev.id}-${index}`}
              className="w-[330px] sm:w-[390px] shrink-0 rounded-2xl border border-white/10 bg-gradient-to-b from-[#081e13]/90 via-[#04110a]/95 to-[#020704] p-5 backdrop-blur-xl shadow-xl hover:border-[#00F076]/50 hover:shadow-[0_0_30px_rgba(0,240,118,0.2)] transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                {/* Header: Photo Avatar + Info + Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={rev.avatarImage}
                      alt={rev.name}
                      className="h-12 w-12 rounded-xl object-cover ring-2 ring-[#00F076]/40 shadow-md shrink-0"
                      onError={(e) => {
                        e.currentTarget.src = "/pendugpt-logo.jpg";
                      }}
                    />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-sm text-white">{rev.name}</h3>
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#00F076]" />
                      </div>
                      <p className="text-[11px] text-white/50">{rev.location}</p>
                    </div>
                  </div>

                  {/* Result Badge */}
                  <span className="rounded-full border border-[#00F076]/35 bg-[#072416] px-2.5 py-0.5 text-[10px] font-extrabold text-[#00F076] shrink-0">
                    {rev.highlightBadge}
                  </span>
                </div>

                {/* Star Rating */}
                <div className="mt-3 flex items-center gap-1 text-amber-400">
                  {[...Array(rev.rating)].map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-current" />
                  ))}
                  <span className="ml-1 text-[10px] text-white/50 font-semibold">5.0 Verified</span>
                </div>

                {/* Review Quote */}
                <p className="mt-3 text-xs sm:text-[13px] text-white/85 leading-relaxed italic">
                  "{rev.reviewText}"
                </p>
              </div>

              {/* Bottom Milestone Footer */}
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-[#00F076] font-semibold">
                <span className="flex items-center gap-1.5 truncate max-w-[240px]">
                  <Sparkles className="h-3 w-3 shrink-0" />
                  <span className="truncate">{rev.highlightPoint}</span>
                </span>
                <span className="text-white/40 text-[10px] shrink-0">Verified Student</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Marquee Hint */}
      <p className="text-center text-[11px] text-white/40 mt-4">
        👆 Hover over any student review to pause and read
      </p>
    </section>
  );
}

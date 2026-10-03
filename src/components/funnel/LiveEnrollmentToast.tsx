import { useState, useEffect } from "react";
import { ShieldCheck, X } from "lucide-react";

interface PurchaseAlert {
  id: string;
  name: string;
  city: string;
  price: string;
  accessBadge: string;
  subDetails: string;
  timeAgo: string;
}

const purchaseAlerts: PurchaseAlert[] = [
  {
    id: "1",
    name: "Gurinder S.",
    city: "Ludhiana",
    price: "2,499",
    accessBadge: "Complete Masterclass Access",
    subDetails: "All Recordings + Drive Vault Issued",
    timeAgo: "Just now",
  },
  {
    id: "2",
    name: "Harmanpreet K.",
    city: "Amritsar",
    price: "5,999",
    accessBadge: "Live Batch Seat Confirmed",
    subDetails: "Live Zoom Pass + Mentor Group Issued",
    timeAgo: "2m ago",
  },
  {
    id: "3",
    name: "Maninderjit S.",
    city: "Mohali",
    price: "2,499",
    accessBadge: "Complete Masterclass Access",
    subDetails: "100+ Prompt Vault & Starter Repos Sent",
    timeAgo: "4m ago",
  },
  {
    id: "4",
    name: "Navdeep S.",
    city: "Brampton, CA",
    price: "5,999",
    accessBadge: "Live Batch Seat Confirmed",
    subDetails: "1-on-1 Mentorship VIP Access Granted",
    timeAgo: "6m ago",
  },
  {
    id: "5",
    name: "Simranjit K.",
    city: "Jalandhar",
    price: "2,499",
    accessBadge: "Complete Masterclass Access",
    subDetails: "Free Domain & Cloud Setup Blueprint Sent",
    timeAgo: "9m ago",
  },
  {
    id: "6",
    name: "Jaspreet K.",
    city: "Bathinda",
    price: "5,999",
    accessBadge: "Live Batch Seat Confirmed",
    subDetails: "Live Zoom Masterclass Seat Reserved (Only 2 Left)",
    timeAgo: "11m ago",
  },
  {
    id: "7",
    name: "Arshdeep S.",
    city: "Patiala",
    price: "2,499",
    accessBadge: "Complete Masterclass Access",
    subDetails: "Client Pitch Decks + Outreach Scripts Sent",
    timeAgo: "14m ago",
  },
  {
    id: "8",
    name: "Taranjeet S.",
    city: "Surrey, UK",
    price: "5,999",
    accessBadge: "Live Batch Seat Confirmed",
    subDetails: "International VIP Community Pass Issued",
    timeAgo: "18m ago",
  },
  {
    id: "9",
    name: "Komalpreet K.",
    city: "Chandigarh",
    price: "2,499",
    accessBadge: "Complete Masterclass Access",
    subDetails: "All 6 HD Modules & Contract Kits Issued",
    timeAgo: "21m ago",
  },
  {
    id: "10",
    name: "Preetinder K.",
    city: "Hoshiarpur",
    price: "5,999",
    accessBadge: "Live Batch Seat Confirmed",
    subDetails: "Live Website Build & Code Review Pass Sent",
    timeAgo: "25m ago",
  },
];

export function LiveEnrollmentToast() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (isDismissed) return;

    // Initial popup delay: 2.5 seconds
    const initialTimer = setTimeout(() => {
      setIsVisible(true);
    }, 2500);

    return () => clearTimeout(initialTimer);
  }, [isDismissed]);

  useEffect(() => {
    if (isDismissed) return;

    let timeoutId: NodeJS.Timeout | null = null;

    // Cycle every 7.5 seconds
    const interval = setInterval(() => {
      setIsVisible(false);

      timeoutId = setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % purchaseAlerts.length);
        setIsVisible(true);
      }, 350);
    }, 7500);

    return () => {
      clearInterval(interval);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isDismissed]);

  if (isDismissed || !isVisible) return null;

  const current = purchaseAlerts[currentIndex];

  return (
    <aside
      aria-label="Recent verified purchase notification"
      className="fixed bottom-4 left-4 z-50 max-w-[370px] sm:max-w-[420px] rounded-[24px] sm:rounded-[28px] border border-[#d4f934]/35 bg-[#050b06]/98 p-4 sm:p-4.5 backdrop-blur-2xl shadow-[0_15px_45px_rgba(0,0,0,0.9),0_0_30px_rgba(212,249,52,0.18)] animate-toast-slide-up transition-all duration-300"
    >
      <div className="flex items-center gap-3.5">
        {/* Glowing Green Verified Shield Icon (No Profile Picture) */}
        <div className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#0d2818] border-2 border-[#d4f934]/70 text-[#d4f934] shadow-[0_0_25px_rgba(212,249,52,0.45),inset_0_0_12px_rgba(212,249,52,0.2)]">
          <ShieldCheck className="h-6 w-6 stroke-[2.2]" />
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#d4f934] ring-2 ring-[#050b06] animate-green-dot" />
        </div>

        {/* Content Info */}
        <div className="flex-1 min-w-0 pr-1">
          {/* Header Line: Name and Location */}
          <div className="flex items-center justify-between">
            <h4 className="font-display font-extrabold text-[13px] sm:text-sm text-white tracking-tight truncate">
              {current.name} from {current.city}
            </h4>
          </div>

          {/* Middle Line: Price Paid and Access Status */}
          <div className="mt-0.5 flex items-center gap-1.5 flex-wrap text-xs">
            <span className="font-extrabold text-white">₹{current.price} Paid</span>
            <span className="text-white/40 text-[10px]">•</span>
            <span className="font-extrabold text-[#d4f934] tracking-tight">
              {current.accessBadge} ✓
            </span>
          </div>

          {/* Subline: Details and Time Ago */}
          <p className="mt-1 text-[11px] text-white/55 font-medium truncate">
            {current.subDetails} • {current.timeAgo}
          </p>
        </div>

        {/* Close Button */}
        <button
          onClick={() => setIsDismissed(true)}
          className="self-start text-white/40 hover:text-white transition-colors p-1 -mr-1 -mt-1 rounded-lg hover:bg-white/10 cursor-pointer shrink-0"
          aria-label="Close notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Subtle Progress Bar */}
      <div className="mt-3 h-[2px] w-full overflow-hidden rounded-full bg-white/10">
        <div
          key={currentIndex}
          className="h-full bg-gradient-to-r from-[#00F076] to-[#d4f934] transition-all duration-[6000ms] ease-linear"
          style={{ width: "100%", animation: "none" }}
        />
      </div>
    </aside>
  );
}

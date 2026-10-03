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
      className="fixed top-3 left-3 right-3 sm:top-auto sm:bottom-5 sm:left-5 sm:right-auto z-50 sm:max-w-[390px] rounded-[18px] sm:rounded-[24px] border border-[#00F076]/35 bg-[#050b06]/95 p-2.5 sm:p-4 backdrop-blur-2xl shadow-[0_10px_35px_rgba(0,0,0,0.85),0_0_20px_rgba(0,240,118,0.15)] animate-toast-slide-up transition-all duration-300 pointer-events-auto"
    >
      <div className="flex items-center gap-2.5 sm:gap-3.5">
        {/* Glowing Green Verified Shield Icon (No Profile Picture) */}
        <div className="relative grid h-9 w-9 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-full bg-[#0d2818] border border-[#00F076]/70 text-[#00F076] shadow-[0_0_15px_rgba(0,240,118,0.35)]">
          <ShieldCheck className="h-4.5 w-4.5 sm:h-5.5 sm:w-5.5 stroke-[2.2]" />
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-[#00F076] ring-1 ring-[#050b06] animate-green-dot" />
        </div>

        {/* Content Info */}
        <div className="flex-1 min-w-0 pr-0.5">
          {/* Header Line: Name and Location */}
          <div className="flex items-center justify-between">
            <h4 className="font-display font-extrabold text-[11.5px] sm:text-sm text-white tracking-tight truncate">
              {current.name} from {current.city}
            </h4>
          </div>

          {/* Middle Line: Price Paid and Access Status */}
          <div className="mt-0.5 flex items-center gap-1.5 flex-wrap text-[10.5px] sm:text-xs">
            <span className="font-extrabold text-white">₹{current.price} Paid</span>
            <span className="text-white/40 text-[9px]">•</span>
            <span className="font-extrabold text-[#00F076] tracking-tight truncate">
              {current.accessBadge} ✓
            </span>
          </div>

          {/* Subline: Details and Time Ago */}
          <p className="mt-0.5 text-[9px] sm:text-[10.5px] text-white/60 font-medium truncate">
            {current.subDetails} • {current.timeAgo}
          </p>
        </div>

        {/* Close Button */}
        <button
          onClick={() => setIsDismissed(true)}
          className="self-center sm:self-start text-white/40 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10 cursor-pointer shrink-0"
          aria-label="Close notification"
        >
          <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </button>
      </div>

      {/* Subtle Progress Bar */}
      <div className="mt-2 sm:mt-2.5 h-[1.5px] sm:h-[2px] w-full overflow-hidden rounded-full bg-white/10">
        <div
          key={currentIndex}
          className="h-full bg-gradient-to-r from-[#00F076] to-[#00d668] transition-all duration-[6000ms] ease-linear"
          style={{ width: "100%", animation: "none" }}
        />
      </div>
    </aside>
  );
}

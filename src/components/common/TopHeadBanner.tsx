import { Link } from "@tanstack/react-router";
import { Sparkles, ArrowRight, Flame } from "lucide-react";

export function TopHeadBanner() {
  return (
    <div className="relative z-50 w-full bg-gradient-to-r from-[#020d06] via-[#082b18] to-[#020d06] border-b border-[#00F076]/30 py-1.5 px-3 text-center shadow-[0_0_20px_rgba(0,240,118,0.15)]">
      <div className="mx-auto flex max-w-5xl items-center justify-center gap-2 sm:gap-3 text-[10px] sm:text-xs font-bold text-white tracking-wide">
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="h-2 w-2 rounded-full bg-red-600 animate-live-dot shrink-0" />
          <Flame className="h-3.5 w-3.5 text-amber-400 fill-amber-400 shrink-0" />
        </span>

        <span className="truncate">
          <span className="text-[#00F076] font-black uppercase tracking-wider">
            NEW BATCH ADMISSIONS CLOSING SOON
          </span>
          <span className="text-white/60 mx-1.5 hidden xs:inline">•</span>
          <span className="hidden xs:inline text-white/90 font-medium">
            3 Seats Remaining for 1-on-1 Live Mentorship
          </span>
        </span>

        <Link
          to="/next-step"
          className="inline-flex items-center gap-1 rounded-full bg-[#00F076] hover:bg-[#00d668] text-black px-2.5 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider transition-all shadow-[0_0_10px_rgba(0,240,118,0.5)] shrink-0"
        >
          <span>Claim Seat</span>
          <ArrowRight className="h-2.5 w-2.5" />
        </Link>
      </div>
    </div>
  );
}

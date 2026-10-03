import { Link } from "@tanstack/react-router";
import { siteConfig } from "@/config/site";

interface BrandLogoProps {
  to?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  showTagline?: boolean;
}

export function BrandLogo({
  to = "/",
  size = "md",
  className = "",
  showTagline = true,
}: BrandLogoProps) {
  const imgSizes = {
    sm: "h-8 w-8",
    md: "h-9 w-9 sm:h-10 sm:w-10",
    lg: "h-11 w-11 sm:h-12 sm:w-12",
  };

  const titleSizes = {
    sm: "text-base sm:text-lg",
    md: "text-lg sm:text-xl",
    lg: "text-xl sm:text-2xl",
  };

  const taglineSizes = {
    sm: "text-[9px] sm:text-[10px]",
    md: "text-[10px] sm:text-[11px]",
    lg: "text-[11px] sm:text-[12px]",
  };

  const content = (
    <div className={`inline-flex items-center gap-2.5 sm:gap-3 group ${className}`}>
      <img
        src={siteConfig.logo}
        alt={siteConfig.brand}
        className={`${imgSizes[size]} rounded-full object-cover shadow-[0_0_15px_rgba(255,230,0,0.35)] ring-2 ring-yellow-400/50 transition-transform duration-300 group-hover:scale-105 shrink-0`}
      />
      <div className="flex flex-col text-left justify-center">
        <span
          className={`font-display font-black tracking-tight leading-none text-white ${titleSizes[size]}`}
        >
          Pendu<span className="text-[#CCFF00] font-black">GPT</span>
        </span>
        {showTagline && (
          <span
            className={`${taglineSizes[size]} font-bold text-[#CCFF00] tracking-tight leading-tight mt-1`}
          >
            AI Sikho, Paisa Kamao.
          </span>
        )}
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="cursor-pointer">
        {content}
      </Link>
    );
  }

  return content;
}


import React from "react";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * Base high-performance Skeleton element with vibrant emerald shimmer gradient.
 */
export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      className={`skeleton-shimmer rounded-xl bg-white/[0.04] border border-white/[0.05] ${className}`}
      {...props}
    />
  );
}

/**
 * Full Skeleton Screen for the Registration Screen (Route: /)
 */
export function RegistrationSkeleton() {
  return (
    <div className="min-h-screen flex flex-col justify-between px-4 py-4 sm:py-6 animate-pulse">
      {/* Floating Navbar Skeleton */}
      <header className="mx-auto w-full max-w-5xl pt-2">
        <div className="flex items-center justify-between rounded-2xl glass-panel px-4 py-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-5 w-28 rounded-md" />
          </div>
          <Skeleton className="h-7 w-24 rounded-full" />
        </div>
      </header>

      {/* Hero & Form Skeleton */}
      <main className="mx-auto w-full max-w-xl py-6 sm:py-10 flex flex-col items-center">
        <Skeleton className="h-6 w-44 rounded-full mb-4" />
        <Skeleton className="h-9 sm:h-12 w-3/4 rounded-xl mb-3" />
        <Skeleton className="h-4 w-1/2 rounded-md mb-8" />

        {/* Card Form Skeleton */}
        <div className="w-full rounded-3xl glass-card p-6 sm:p-8 space-y-4">
          <Skeleton className="h-5 w-36 rounded-md mb-2" />
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
      </main>

      {/* Footer Skeleton */}
      <footer className="w-full text-center py-4">
        <Skeleton className="h-4 w-40 mx-auto rounded-md" />
      </footer>
    </div>
  );
}

/**
 * Instant Video Player Skeleton for sub-second visual readiness.
 */
export function VideoPlayerSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`relative aspect-video w-full rounded-xl sm:rounded-2xl bg-[#030906] border border-[#00F076]/20 overflow-hidden flex flex-col items-center justify-center p-6 ${className}`}>
      <div className="relative mb-3 flex items-center justify-center">
        <div className="absolute -inset-2 rounded-full bg-[#00F076]/15 blur-sm animate-pulse" />
        <div className="relative grid h-16 w-16 sm:h-20 sm:w-20 place-items-center rounded-full bg-[#072416] border border-[#00F076]/40 text-[#00F076] shadow-[0_0_20px_rgba(0,240,118,0.25)]">
          <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-sm bg-[#00F076]/40" />
        </div>
      </div>
      <Skeleton className="h-4 w-44 rounded-md mb-2" />
      <Skeleton className="h-3 w-32 rounded-full" />
    </div>
  );
}

/**
 * Full Skeleton Screen for the Free Training Screen (Route: /training)
 */
export function TrainingSkeleton() {
  return (
    <div className="min-h-screen flex flex-col justify-between px-4 py-4 sm:py-6">
      {/* Navbar Skeleton */}
      <header className="mx-auto w-full max-w-5xl pt-2">
        <div className="flex items-center justify-between rounded-2xl glass-panel px-4 py-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-5 w-28 rounded-md" />
          </div>
          <Skeleton className="h-7 w-28 rounded-full" />
        </div>
      </header>

      {/* Video Content Skeleton */}
      <main className="mx-auto w-full max-w-5xl py-6 sm:py-8">
        <div className="text-center max-w-2xl mx-auto mb-6 flex flex-col items-center">
          <Skeleton className="h-6 w-48 rounded-full mb-3" />
          <Skeleton className="h-8 sm:h-11 w-4/5 rounded-xl mb-2" />
          <Skeleton className="h-4 w-3/5 rounded-md" />
        </div>

        {/* 16:9 Video Container Skeleton */}
        <div className="rounded-[22px] sm:rounded-[28px] border border-[#00F076]/20 bg-[#030906] p-1.5 sm:p-3 mb-6 shadow-xl">
          <VideoPlayerSkeleton />
        </div>

        {/* Progress Gate Card Skeleton */}
        <div className="rounded-[24px] sm:rounded-[28px] border border-[#00F076]/20 bg-[#05140b]/90 p-5 sm:p-7 mb-6">
          <div className="flex justify-between items-center mb-3">
            <Skeleton className="h-5 w-36 rounded-md" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-3.5 w-full rounded-full mb-4" />
          <div className="flex justify-between items-center pt-3 border-t border-white/5">
            <Skeleton className="h-5 w-48 rounded-md" />
            <Skeleton className="h-9 w-32 rounded-full" />
          </div>
        </div>

        {/* 3 Trust Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </main>

      {/* Footer Skeleton */}
      <footer className="w-full text-center py-4 border-t border-white/5">
        <Skeleton className="h-4 w-44 mx-auto rounded-md" />
      </footer>
    </div>
  );
}

/**
 * Full Skeleton Screen for Next Step Masterclass Offer (Route: /next-step)
 */
export function NextStepSkeleton() {
  return (
    <div className="min-h-screen flex flex-col justify-between px-4 py-4 sm:py-6">
      {/* Navbar Skeleton */}
      <header className="mx-auto w-full max-w-5xl py-2 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-5 w-28 rounded-md" />
        </div>
        <Skeleton className="h-7 w-32 rounded-full" />
      </header>

      {/* Main Skeleton */}
      <main className="mx-auto w-full max-w-5xl py-6 sm:py-8 space-y-8">
        <div className="text-center max-w-2xl mx-auto flex flex-col items-center">
          <Skeleton className="h-6 w-48 rounded-full mb-3" />
          <Skeleton className="h-9 sm:h-12 w-4/5 rounded-xl mb-2" />
          <Skeleton className="h-4 w-3/5 rounded-md" />
        </div>

        {/* Action Plan Video Skeleton */}
        <div className="mx-auto max-w-3xl rounded-3xl glass-card p-2 sm:p-3">
          <div className="aspect-video w-full rounded-2xl skeleton-shimmer flex items-center justify-center">
            <div className="h-16 w-16 rounded-full bg-[#00F076]/20 border border-[#00F076]/40" />
          </div>
        </div>

        {/* Two Pricing Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 max-w-4xl mx-auto">
          <div className="rounded-[24px] sm:rounded-[32px] glass-card p-5 sm:p-7 space-y-3">
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="h-6 sm:h-8 w-3/4 rounded-lg" />
            <Skeleton className="h-8 sm:h-12 w-1/2 rounded-xl" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-10 sm:h-12 w-full rounded-2xl mt-4" />
          </div>

          <div className="rounded-[24px] sm:rounded-[32px] glass-card p-5 sm:p-7 space-y-3">
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="h-6 sm:h-8 w-3/4 rounded-lg" />
            <Skeleton className="h-8 sm:h-12 w-1/2 rounded-xl" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-10 sm:h-12 w-full rounded-2xl mt-4" />
          </div>
        </div>

        {/* Pillars Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-4xl mx-auto">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-6 border-t border-white/5">
        <Skeleton className="h-5 w-48 mx-auto rounded-md" />
      </footer>
    </div>
  );
}

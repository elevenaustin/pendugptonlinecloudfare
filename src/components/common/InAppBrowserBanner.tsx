import React, { useEffect, useState } from "react";
import { ExternalLink, Copy, Check, X, AlertTriangle, Smartphone } from "lucide-react";

export function InAppBrowserBanner() {
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ua = navigator.userAgent || navigator.vendor || (window as any).opera || "";
    const isInstagram = /Instagram|FBAN|FBAV|FB_IAB|FB4A|FBSS|musical_ly|BytedanceWebview/i.test(ua);
    const isAndroidDevice = /Android/i.test(ua);
    const isIOSDevice = /iPhone|iPad|iPod/i.test(ua);

    if (isInstagram) {
      setIsInAppBrowser(true);
      setIsIOS(isIOSDevice);

      // 1. Android Auto-Breakout: Directly launch external Chrome / default browser via Intent
      if (isAndroidDevice) {
        try {
          const rawUrl = window.location.href.replace(/^https?:\/\//i, "");
          const chromeIntent = `intent://${rawUrl}#Intent;scheme=https;package=com.android.chrome;end;`;
          // Attempt instant breakout
          window.location.href = chromeIntent;
        } catch (e) {
          console.warn("Android intent breakout notice:", e);
        }
      }
    }
  }, []);

  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* ignore */
    }
  };

  if (!isInAppBrowser || dismissed) {
    return null;
  }

  return (
    <div className="relative z-50 w-full bg-gradient-to-r from-[#020d06] via-[#051f11] to-[#020d06] border-b-2 border-emerald-500/60 px-3.5 py-2.5 shadow-2xl text-zinc-100">
      <div className="mx-auto flex max-w-5xl flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 rounded-lg bg-emerald-500/20 p-1.5 text-emerald-400 border border-emerald-500/30 shrink-0">
            <Smartphone className="h-4 w-4 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Instagram In-App Browser Detected
              </span>
              <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-semibold text-amber-300 border border-amber-500/30">
                Recommended
              </span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-300">
              {isIOS ? (
                <span>
                  For video audio & fast 1-click Razorpay payment: Tap <strong>•••</strong> (top right) ➔ Select <strong>"Open in Safari / Chrome"</strong>
                </span>
              ) : (
                <span>
                  For uninterrupted video & payment: Tap <strong>•••</strong> (top right) ➔ Select <strong>"Open in Chrome"</strong>
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex w-full sm:w-auto items-center justify-end gap-2 shrink-0">
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/50 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-900/60"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? "Link Copied!" : "Copy Link"}</span>
          </button>

          <button
            onClick={() => setDismissed(true)}
            className="rounded-lg p-1 text-zinc-400 hover:bg-emerald-950/50 hover:text-white"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import Player from "@vimeo/player";
import {
  ArrowRight,
  BadgeCheck,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  FileCheck,
  FileText,
  Flame,
  Gift,
  Globe,
  HelpCircle,
  Laptop,
  Lock,
  Maximize,
  MessageSquare,
  Network,
  Play,
  PlayCircle,
  Radio,
  RefreshCw,
  Rocket,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Video,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { siteConfig } from "@/config/site";
import { RazorpayCheckoutDialog, type CheckoutTier } from "@/components/funnel/RazorpayCheckoutDialog";
import { LiveEnrollmentToast } from "@/components/funnel/LiveEnrollmentToast";
import { StudentReviewsMarquee } from "@/components/funnel/StudentReviewsMarquee";
import { BrandLogo } from "@/components/common/BrandLogo";
import { SiteFooter } from "@/components/common/SiteFooter";
import { track } from "@/lib/analytics";

export function NextStepScreen() {
  const navigate = useNavigate();
  const { recorded, live } = siteConfig.courses;
  const nextStepVimeoId = siteConfig.nextStepVideo?.vimeoId || "1232620094";
  const { completionKey } = siteConfig.video;

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<Player | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize isCompleted synchronously so iframe mounts on initial render
  const [isCompleted, setIsCompleted] = useState<boolean>(() => {
    try {
      return localStorage.getItem(completionKey) === "true";
    } catch {
      return true;
    }
  });

  const [selectedTier, setSelectedTier] = useState<CheckoutTier | null>(null);
  const [showPricing, setShowPricing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const pricingSectionRef = useRef<HTMLDivElement>(null);

  // Check completion verification fallback
  useEffect(() => {
    try {
      const completed = localStorage.getItem(completionKey) === "true";
      if (!completed) {
        setIsCompleted(false);
      }
    } catch {
      /* ignore */
    }
  }, [completionKey]);

  // 2-Second Delay Reveal for the Pricing Cards Section
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowPricing(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const triggerControlsAutoHide = () => {
    setShowControls(true);
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }
    hideControlsTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 2500);
  };

  const handleUserActivity = () => {
    if (isPlaying) {
      triggerControlsAutoHide();
    } else {
      setShowControls(true);
    }
  };

  // Initialize Vimeo Player with reliable autoplay & controls
  useEffect(() => {
    if (!isCompleted) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    let playerInstance: Player | null = null;

    try {
      playerInstance = new Player(iframe);
      playerRef.current = playerInstance;

      playerInstance.on("loaded", async () => {
        try {
          const dur = await playerInstance?.getDuration();
          if (dur) setDuration(dur);
          
          // Attempt automatic playback once user arrives
          try {
            await playerInstance?.play();
            setIsPlaying(true);
            setIsEnded(false);
            triggerControlsAutoHide();
          } catch {
            // If browser blocks unmuted autoplay, mute and autoplay
            try {
              await playerInstance?.setMuted(true);
              setIsMuted(true);
              await playerInstance?.play();
              setIsPlaying(true);
              setIsEnded(false);
              triggerControlsAutoHide();
            } catch {
              /* ignore */
            }
          }
        } catch {
          /* ignore */
        }
      });

      playerInstance.on("play", () => {
        setIsPlaying(true);
        setIsEnded(false);
        triggerControlsAutoHide();
      });

      playerInstance.on("pause", () => {
        setIsPlaying(false);
        setShowControls(true);
        if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
      });

      playerInstance.on("timeupdate", (data: { seconds: number; duration: number }) => {
        setCurrentTime(data.seconds);
        if (data.duration) setDuration(data.duration);
      });

      playerInstance.on("ended", () => {
        setIsEnded(true);
        setIsPlaying(false);
        setShowControls(true);
      });
    } catch (err) {
      console.warn("Vimeo player init warning:", err);
    }

    const handleFullscreenChange = () => {
      const doc: any = document;
      const isFull = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      setIsFullscreen(isFull);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
      if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
      if (playerInstance) {
        playerInstance.unload().catch(() => {});
      }
    };
  }, [nextStepVimeoId, isCompleted]);

  const togglePlay = async () => {
    handleUserActivity();
    let player = playerRef.current;
    if (!player && iframeRef.current) {
      try {
        player = new Player(iframeRef.current);
        playerRef.current = player;
      } catch {
        /* ignore */
      }
    }

    if (!player) return;

    try {
      const paused = await player.getPaused();
      if (paused) {
        // Unmute on direct user click if currently muted
        try {
          await player.setMuted(false);
          setIsMuted(false);
        } catch {
          /* ignore */
        }
        await player.play();
        setIsPlaying(true);
        setIsEnded(false);
        triggerControlsAutoHide();
      } else {
        await player.pause();
        setIsPlaying(false);
        setShowControls(true);
        if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
      }
    } catch {
      /* fallback */
    }
  };

  const handleRewind10 = async () => {
    handleUserActivity();
    if (!playerRef.current) return;
    try {
      const cur = await playerRef.current.getCurrentTime();
      await playerRef.current.setCurrentTime(Math.max(0, cur - 10));
    } catch {
      /* ignore */
    }
  };

  const handleReplayVideo = async () => {
    handleUserActivity();
    let player = playerRef.current;
    if (!player && iframeRef.current) {
      try {
        player = new Player(iframeRef.current);
        playerRef.current = player;
      } catch {
        /* ignore */
      }
    }

    if (player) {
      try {
        await player.setCurrentTime(0);
        try {
          await player.setMuted(false);
          setIsMuted(false);
        } catch {
          /* ignore */
        }
        await player.play();
        setIsEnded(false);
        setIsPlaying(true);
        triggerControlsAutoHide();
        return;
      } catch {
        /* fallback to iframe reload */
      }
    }

    // Direct iframe reload fallback
    if (iframeRef.current) {
      iframeRef.current.src = `https://player.vimeo.com/video/${nextStepVimeoId}?autoplay=1&muted=0&controls=0&badge=0&autopause=0&player_id=0&app_id=58479&title=0&byline=0&portrait=0&sidedock=0&dnt=1&playsinline=1`;
      setIsEnded(false);
      setIsPlaying(true);
      triggerControlsAutoHide();
    }
  };

  const handleToggleMute = async () => {
    handleUserActivity();
    if (playerRef.current) {
      try {
        const muted = await playerRef.current.getMuted();
        await playerRef.current.setMuted(!muted);
        setIsMuted(!muted);
      } catch {
        /* ignore */
      }
    }
  };

  const handleToggleFullscreen = async () => {
    handleUserActivity();
    const container = videoContainerRef.current;
    if (!container) return;

    const doc: any = document;
    const isCurrentlyFull = !!(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );

    try {
      if (!isCurrentlyFull && !isFullscreen) {
        setIsFullscreen(true);
        if (container.requestFullscreen) {
          await container.requestFullscreen().catch(() => {});
        } else if ((container as any).webkitRequestFullscreen) {
          (container as any).webkitRequestFullscreen();
        } else if ((container as any).mozRequestFullScreen) {
          (container as any).mozRequestFullScreen();
        } else if ((container as any).msRequestFullscreen) {
          (container as any).msRequestFullscreen();
        } else if (playerRef.current) {
          await playerRef.current.requestFullscreen().catch(() => {});
        }
      } else {
        setIsFullscreen(false);
        if (doc.exitFullscreen) {
          await doc.exitFullscreen().catch(() => {});
        } else if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          doc.msExitFullscreen();
        } else if (playerRef.current) {
          await playerRef.current.exitFullscreen().catch(() => {});
        }
      }
    } catch (err) {
      console.warn("Fullscreen toggle fallback:", err);
      setIsFullscreen((prev) => !prev);
    }
  };

  const handleEnroll = (tier: CheckoutTier) => {
    track("next_step_enroll_click", { course: tier });
    setSelectedTier(tier);
  };

  const scrollToPricing = () => {
    setShowPricing(true);
    setTimeout(() => {
      pricingSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const progressPct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  if (isCompleted === null) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col justify-between text-foreground selection:bg-[#00F076] selection:text-black bg-[#020604]">
      {/* Dynamic Purchase Popups matching exact screenshot reference (Shield Icon, No Photo) */}
      <LiveEnrollmentToast />

      <div className="w-full flex-1 flex flex-col justify-between px-4 py-4 sm:py-6">
        {/* Header */}
        <header className="relative z-20 mx-auto flex w-full max-w-5xl items-center justify-between py-2 border-b border-white/5">
          <BrandLogo size="md" />

          <div className="flex items-center gap-3">
            <Link
              to="/training"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#00F076]/30 bg-[#072416] px-3.5 py-1.5 text-xs font-semibold text-[#00F076] hover:bg-[#00F076]/20 transition-all shadow-[0_0_15px_rgba(0,240,118,0.15)] cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Rewatch Training</span>
            </Link>
          </div>
        </header>

      {/* Main Content Area */}
      <main className="relative z-10 mx-auto w-full max-w-5xl py-6 sm:py-8 animate-reveal">
        {!isCompleted ? (
          /* Gated Notice if visited directly without finishing video */
          <div className="mx-auto max-w-md rounded-[28px] glass-card p-8 text-center my-12">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#072416] border border-[#00F076]/40 text-[#00F076] shadow-[0_0_20px_rgba(0,240,118,0.3)]">
              <Lock className="h-6 w-6" />
            </div>
            <h2 className="mt-5 font-display font-extrabold italic text-2xl text-white">
              Training Completion Required
            </h2>
            <p className="mt-2 text-xs text-[#A1B2A8] leading-relaxed">
              Please complete the free training video first to unlock your masterclass enrollment.
            </p>
            <button
              onClick={() => navigate({ to: "/training" })}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#00F076] to-[#00D668] px-7 py-3 text-xs font-display font-extrabold italic uppercase tracking-wider text-black shadow-[0_0_25px_rgba(0,240,118,0.5)] cursor-pointer"
            >
              <span>GO TO FREE TRAINING</span>
              <span>→</span>
            </button>
          </div>
        ) : (
          /* Unlocked Masterclass Offers & Next Step Video */
          <div className="space-y-10 sm:space-y-12">
            {/* Top Section Header */}
            <div className="text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#00F076]/40 bg-[#072416] px-4 py-1.5 text-xs font-bold text-[#00F076] shadow-[0_0_20px_rgba(0,240,118,0.25)] mb-3">
                <Sparkles className="h-4 w-4" />
                <span>Special Masterclass Briefing & Enrollment</span>
              </div>
              <h1 className="font-display font-extrabold italic text-3xl sm:text-4xl md:text-5xl text-white tracking-tight leading-tight">
                Unlock Your Next Step with <span className="text-[#00F076]">PenduGPT</span>
              </h1>
              <p className="mt-3 text-sm sm:text-base text-white/80 font-medium max-w-2xl mx-auto leading-relaxed">
                Watch this action plan video below. Discover how to build luxury websites without
                coding, get free domains & hosting, and close ₹25k–₹50k client deals.
              </p>
            </div>

            {/* Video Preview Section (Clean, Cinema-Grade Player with Zero Clutter & Zero Vimeo Icons) */}
            <div className="relative group/player mx-auto max-w-3xl w-full">
              {/* Radiant Ambient Glow Behind Video */}
              <div className="pointer-events-none absolute -inset-2 sm:-inset-3 rounded-[32px] sm:rounded-[40px] bg-gradient-to-r from-[#00F076]/30 via-[#00D668]/20 to-[#00F076]/30 blur-2xl opacity-75 group-hover/player:opacity-100 transition-opacity duration-500" />

              <div
                ref={videoContainerRef}
                onMouseMove={handleUserActivity}
                onTouchStart={handleUserActivity}
                onTouchMove={handleUserActivity}
                onClick={handleUserActivity}
                onMouseLeave={() => isPlaying && setShowControls(false)}
                className={`relative overflow-hidden transition-all duration-300 select-none touch-manipulation ${
                  isFullscreen
                    ? "fixed inset-0 z-[99999] w-screen h-screen bg-black flex items-center justify-center p-0 rounded-none"
                    : "rounded-[20px] xs:rounded-[26px] sm:rounded-[32px] glass-card p-1.5 xs:p-2.5 sm:p-4 md:p-5 border-2 border-[#00F076]/40 shadow-[0_0_60px_rgba(0,240,118,0.25)]"
                }`}
              >
                {/* Quick Exit Fullscreen Button on Top Right in Fullscreen Mode */}
                {isFullscreen && (
                  <button
                    type="button"
                    onClick={handleToggleFullscreen}
                    className="absolute top-3 right-3 sm:top-5 sm:right-5 z-50 flex items-center gap-1.5 rounded-full bg-black/80 hover:bg-black text-white px-3.5 py-2 text-xs font-semibold backdrop-blur-md border border-white/25 shadow-2xl active:scale-95 cursor-pointer"
                  >
                    <Minimize className="h-4 w-4 text-[#00F076]" />
                    <span>Exit Fullscreen</span>
                  </button>
                )}

                {/* Vimeo Embed with ALL Native Controls & Sidedock COMPLETELY REMOVED */}
                <div
                  className={`relative aspect-video w-full overflow-hidden bg-[#020503] shadow-2xl ${
                    isFullscreen ? "h-full max-h-screen rounded-none" : "rounded-xl sm:rounded-2xl"
                  }`}
                >
                  <iframe
                    ref={iframeRef}
                    src={`https://player.vimeo.com/video/${nextStepVimeoId}?autoplay=1&muted=1&controls=0&badge=0&autopause=0&player_id=0&app_id=58479&title=0&byline=0&portrait=0&sidedock=0&dnt=1&playsinline=1`}
                    className="absolute inset-0 h-full w-full border-0 pointer-events-none"
                    allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope"
                    title="PenduGPT Masterclass Action Plan"
                  />

                  {/* Clickable Backdrop to Toggle Play/Pause */}
                  <button
                    onClick={togglePlay}
                    className="absolute inset-0 h-full w-full cursor-pointer z-10 bg-transparent"
                    aria-label={isPlaying ? "Pause video" : "Play video"}
                  />

                  {/* Center Big Play Button when Paused */}
                  {!isPlaying && !isEnded && (
                    <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-black/40 backdrop-blur-xs transition-opacity animate-reveal">
                      <button
                        type="button"
                        onClick={togglePlay}
                        className="pointer-events-auto grid h-16 w-16 xs:h-20 xs:w-20 sm:h-24 sm:w-24 place-items-center rounded-full bg-gradient-to-r from-[#00F076] to-[#00D668] text-black shadow-[0_0_40px_rgba(0,240,118,0.85)] transition-all hover:scale-110 active:scale-95 cursor-pointer"
                        aria-label="Play video"
                      >
                        <Play className="h-8 w-8 sm:h-11 sm:w-11 fill-black translate-x-1" />
                      </button>
                    </div>
                  )}

                  {/* Custom Clean Bottom Control Bar (Hidden after 2.5s of no activity) */}
                  <div
                    className={`absolute bottom-0 inset-x-0 z-30 p-3 xs:p-4 sm:p-5 bg-gradient-to-t from-black/95 via-black/60 to-transparent transition-opacity duration-300 ${
                      showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
                    }`}
                  >
                    {/* Glowing Progress Bar */}
                    <div className="w-full h-2 sm:h-2.5 rounded-full bg-white/20 overflow-hidden mb-3 shadow-inner">
                      <div
                        className="h-full rounded-full progress-water-flow shadow-[0_0_10px_rgba(0,240,118,0.8)] transition-all duration-200"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>

                    {/* Custom Action Buttons Row */}
                    <div className="flex items-center justify-between gap-2 text-white">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        {/* Play/Pause Button */}
                        <button
                          type="button"
                          onClick={togglePlay}
                          className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-black/75 hover:bg-black text-white px-3.5 py-2 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold backdrop-blur-md border border-white/20 hover:border-[#00F076]/60 shadow-md transition-all active:scale-95 cursor-pointer"
                        >
                          {isPlaying ? (
                            <>
                              <Pause className="h-4 w-4 text-[#00F076]" />
                              <span>Pause</span>
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 text-[#00F076] fill-current" />
                              <span>Play</span>
                            </>
                          )}
                        </button>

                        {/* Rewind 10s */}
                        <button
                          type="button"
                          onClick={handleRewind10}
                          className="flex items-center gap-1 sm:gap-1.5 rounded-full bg-black/75 hover:bg-black text-white px-3 py-2 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-semibold backdrop-blur-md border border-white/20 hover:border-[#00F076]/60 shadow-md transition-all active:scale-95 cursor-pointer"
                          title="Rewind 10 seconds"
                        >
                          <RotateCcw className="h-4 w-4 text-[#00F076]" />
                          <span>-10s</span>
                        </button>

                        {/* Time display */}
                        {duration > 0 && (
                          <span className="text-[10px] sm:text-xs text-white/80 font-mono pl-1 hidden xs:inline">
                            {formatTime(currentTime)} / {formatTime(duration)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Mute/Unmute */}
                        <button
                          type="button"
                          onClick={handleToggleMute}
                          className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full bg-black/75 hover:bg-black text-white backdrop-blur-md border border-white/20 hover:border-[#00F076]/60 shadow-md transition-all active:scale-95 cursor-pointer"
                          title={isMuted ? "Unmute" : "Mute"}
                          aria-label={isMuted ? "Unmute" : "Mute"}
                        >
                          {isMuted ? (
                            <VolumeX className="h-4 w-4 text-amber-400" />
                          ) : (
                            <Volume2 className="h-4 w-4 text-[#00F076]" />
                          )}
                        </button>

                        {/* 1-Click Universal Fullscreen */}
                        <button
                          type="button"
                          onClick={handleToggleFullscreen}
                          className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full bg-black/75 hover:bg-black text-white backdrop-blur-md border border-white/20 hover:border-[#00F076]/60 shadow-md transition-all active:scale-95 cursor-pointer"
                          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                          aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                        >
                          {isFullscreen ? (
                            <Minimize className="h-4.5 w-4.5 text-[#00F076]" />
                          ) : (
                            <Maximize className="h-4.5 w-4.5 text-[#00F076]" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Clean Replay Overlay when video finishes once */}
                  {isEnded && (
                    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md p-6 text-center animate-reveal">
                      <div className="grid h-14 w-14 place-items-center rounded-full bg-[#072416] border-2 border-[#00F076] text-[#00F076] shadow-[0_0_30px_rgba(0,240,118,0.5)] mb-4">
                        <RotateCcw className="h-7 w-7" />
                      </div>
                      <h3 className="font-display font-extrabold italic text-xl sm:text-2xl text-white">
                        Action Plan Finished
                      </h3>
                      <p className="mt-1.5 text-xs text-white/75 max-w-sm">
                        Click below to play the video again or scroll down to select your
                        enrollment track.
                      </p>

                      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                        <button
                          onClick={handleReplayVideo}
                          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00F076] to-[#00D668] px-5 py-2.5 text-xs font-display font-extrabold italic uppercase tracking-wider text-black shadow-[0_0_20px_rgba(0,240,118,0.6)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Play Video Again</span>
                        </button>
                        <button
                          onClick={scrollToPricing}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/20 transition-all cursor-pointer"
                        >
                          <span>View Pricing</span>
                          <span>↓</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Pricing Section with 2-Second Smooth Reveal Animation */}
            <div
              ref={pricingSectionRef}
              className={`transition-all duration-1000 ease-out transform ${
                showPricing
                  ? "opacity-100 translate-y-0 scale-100"
                  : "opacity-0 translate-y-12 scale-[0.98] pointer-events-none"
              }`}
            >
              {/* Pricing Section Header */}
              <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#00F076]/30 bg-[#072416] px-4 py-1 text-xs font-bold text-[#00F076] shadow-[0_0_15px_rgba(0,240,118,0.2)] mb-3">
                  <Flame className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                  <span>Limited Batch Enrollment Open</span>
                </div>
                <h2 className="font-display font-extrabold italic text-2xl sm:text-3xl md:text-4xl text-white tracking-tight">
                  Choose Your <span className="text-[#00F076]">Masterclass Option</span>
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-white/70 font-medium">
                  Select between direct interactive live mentorship or self-paced video modules.
                </p>
              </div>

              {/* The Two Attractive Pricing Cards: Option 1 (Live) & Option 2 (Recorded) - Strictly Visible Parallel on Mobile & Desktop */}
              <div className="grid grid-cols-2 gap-2 xs:gap-3 sm:gap-6 md:gap-8 max-w-4xl mx-auto items-stretch font-sans">
                {/* ================= OPTION 1: LIVE MASTERCLASS (FEATURED WITH INTENSE GLOW) ================= */}
                <div className="relative flex flex-col justify-between rounded-[22px] sm:rounded-[32px] md:rounded-[36px] border-2 border-[#00F076] bg-gradient-to-b from-[#092e1b] via-[#05170e] to-[#020805] p-2.5 xs:p-3.5 sm:p-7 md:p-8 shadow-[0_0_55px_-5px_rgba(0,240,118,0.5)] animate-glow-pulse transition-all">
                  {/* Glowing ambient halo behind badge matching screenshot */}
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-36 sm:w-64 h-16 sm:h-20 bg-[#00F076]/30 blur-xl rounded-full pointer-events-none" />

                  {/* Clean Single-Line Top Glowing Ribbon Badge as Screenshot */}
                  <div className="absolute -top-3 sm:-top-3.5 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap flex items-center gap-1 sm:gap-1.5 rounded-full bg-[#00F076] px-2 xs:px-3 sm:px-4 py-0.5 sm:py-1 text-[7.5px] xs:text-[9px] sm:text-[11px] font-black uppercase tracking-wider text-black shadow-[0_0_25px_rgba(0,240,118,0.95)] ring-1 ring-white/40">
                    <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-red-600 animate-live-dot shrink-0" />
                    <span>🔥 LIVE BATCH • 3 SEATS LEFT</span>
                  </div>

                  <div>
                    {/* Header Info */}
                    <div className="flex items-center justify-between mt-1 sm:mt-2">
                      <div>
                        <span className="text-[8px] xs:text-[10px] sm:text-xs font-black uppercase tracking-widest text-[#00F076]">
                          OPTION 1
                        </span>
                        <h3 className="font-display font-extrabold italic text-xs xs:text-sm sm:text-xl md:text-2xl text-white mt-0.5 leading-tight">
                          Live Masterclass
                        </h3>
                      </div>
                      <span className="rounded-md sm:rounded-xl border border-red-500/40 bg-red-950/60 px-1 xs:px-1.5 sm:px-2.5 py-0.5 text-[7px] xs:text-[8.5px] sm:text-[10px] font-extrabold uppercase tracking-wider text-red-400 shrink-0">
                        {live.discount}
                      </span>
                    </div>

                    {/* Price with Original Crossed Price & /one-time tag */}
                    <div className="mt-2.5 sm:mt-5 flex items-baseline gap-1 xs:gap-1.5 sm:gap-2.5 flex-wrap">
                      <span className="font-display font-extrabold italic text-xl xs:text-2xl sm:text-4xl md:text-5xl text-white tracking-tight drop-shadow-[0_0_15px_rgba(0,240,118,0.4)]">
                        {live.price}
                      </span>
                      <span className="text-[8.5px] xs:text-[10.5px] sm:text-sm line-through text-white/40 font-medium">
                        {live.originalPrice}
                      </span>
                      <span className="text-[7.5px] xs:text-[9px] sm:text-xs font-bold text-[#00F076] bg-[#00F076]/15 px-1.5 py-0.5 rounded border border-[#00F076]/30">
                        /one-time
                      </span>
                    </div>

                    <p className="mt-1 text-[8px] xs:text-[9.5px] sm:text-[11px] font-bold text-[#00F076]">
                      One-Time Fee • Lifetime Access
                    </p>

                    <p className="mt-2 sm:mt-3.5 text-[8.5px] xs:text-[10px] sm:text-xs md:text-sm text-white/80 leading-snug sm:leading-relaxed border-t border-white/10 pt-2 sm:pt-3">
                      {live.desc}
                    </p>

                    {/* Verified Inclusions Header */}
                    <div className="mt-3.5 sm:mt-6 flex items-center gap-1 sm:gap-1.5 text-[8px] xs:text-[9.5px] sm:text-[11px] font-black uppercase tracking-wider text-[#00F076]">
                      <ShieldCheck className="h-2.5 w-2.5 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4 shrink-0" />
                      <span>✨ VERIFIED LIVE INCLUSIONS:</span>
                    </div>

                    {/* Rich Live Feature Highlights with Glowing Circular Ticks */}
                    <div className="mt-2 sm:mt-3.5 space-y-1.5 xs:space-y-2 sm:space-y-3">
                      {live.features.map((feat, idx) => (
                        <div key={idx} className="flex items-start gap-1 xs:gap-1.5 sm:gap-3">
                          <div className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-5 sm:w-5 rounded-full bg-[#072416] border border-[#00F076] flex items-center justify-center shrink-0 text-[#00F076] shadow-[0_0_8px_rgba(0,240,118,0.5)] mt-0.5">
                            <Check className="h-2 w-2 sm:h-3 sm:w-3 stroke-[3]" />
                          </div>
                          <span className="text-[8px] xs:text-[9.5px] sm:text-xs md:text-sm text-white font-medium leading-tight sm:leading-snug">
                            {feat}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Clean Short-Text High-Impact CTA Button */}
                  <div className="mt-4 sm:mt-8 pt-2.5 sm:pt-4 border-t border-white/10">
                    <button
                      onClick={() => handleEnroll("live")}
                      className="group relative flex w-full items-center justify-center gap-1 sm:gap-2 rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#00F076] via-[#33f88f] to-[#00d668] py-2 xs:py-2.5 sm:py-4 px-1 xs:px-2.5 sm:px-6 text-[9.5px] xs:text-[11px] sm:text-sm font-display font-black uppercase tracking-wider text-black shadow-[0_0_25px_rgba(0,240,118,0.75)] transition-all duration-200 hover:shadow-[0_0_40px_rgba(0,240,118,0.95)] hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    >
                      <Zap className="h-3 w-3 sm:h-4 sm:w-4 fill-black text-black shrink-0 hidden xs:inline-block" />
                      <span>Join Live — {live.price}</span>
                      <ArrowRight className="h-2.5 w-2.5 sm:h-4 sm:w-4 transition-transform group-hover:translate-x-1 shrink-0" />
                    </button>
                    <p className="mt-1 sm:mt-2 text-center text-[7.5px] xs:text-[8.5px] sm:text-[11px] text-[#00F076] font-semibold">
                      🔒 1-on-1 Mentorship + VIP WhatsApp Group
                    </p>
                  </div>
                </div>

                {/* ================= OPTION 2: RECORDED SESSIONS (SHARP RADIANT YELLOW THEME) ================= */}
                <div className="relative flex flex-col justify-between rounded-[22px] sm:rounded-[32px] md:rounded-[36px] border-2 border-[#FFE600] bg-gradient-to-b from-[#221c05] via-[#120f02] to-[#050401] p-2.5 xs:p-3.5 sm:p-7 md:p-8 shadow-[0_0_55px_-5px_rgba(255,230,0,0.35)] transition-all">
                  {/* Glowing sharp yellow ambient halo behind badge matching screenshot */}
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-36 sm:w-64 h-16 sm:h-20 bg-[#FFE600]/25 blur-xl rounded-full pointer-events-none" />

                  {/* Clean Single-Line Recommended Ribbon Badge as Screenshot */}
                  <div className="absolute -top-3 sm:-top-3.5 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap flex items-center gap-1 sm:gap-1.5 rounded-full bg-[#FFE600] px-2 xs:px-3 sm:px-4 py-0.5 sm:py-1 text-[7.5px] xs:text-[9px] sm:text-[11px] font-black uppercase tracking-wider text-black shadow-[0_0_25px_rgba(255,230,0,0.95)] ring-1 ring-white/50">
                    <span className="text-[9px] sm:text-xs font-black text-black">✦</span>
                    <span className="text-black">⭐ RECOMMENDED • SELF-PACED</span>
                  </div>

                  <div>
                    {/* Header Info */}
                    <div className="flex items-center justify-between mt-1 sm:mt-2">
                      <div>
                        <span className="text-[8px] xs:text-[10px] sm:text-xs font-black uppercase tracking-widest text-[#FFE600]">
                          OPTION 2
                        </span>
                        <h3 className="font-display font-extrabold italic text-xs xs:text-sm sm:text-xl md:text-2xl text-white mt-0.5 leading-tight">
                          Recorded Sessions
                        </h3>
                      </div>
                      <span className="rounded-md sm:rounded-xl border border-[#FFE600]/50 bg-[#FFE600]/15 px-1 xs:px-1.5 sm:px-2.5 py-0.5 text-[7px] xs:text-[8.5px] sm:text-[10px] font-black uppercase tracking-wider text-[#FFE600] shrink-0">
                        {recorded.discount}
                      </span>
                    </div>

                    {/* Price with Original Crossed Price & /one-time tag */}
                    <div className="mt-2.5 sm:mt-5 flex items-baseline gap-1 xs:gap-1.5 sm:gap-2.5 flex-wrap">
                      <span className="font-display font-extrabold italic text-xl xs:text-2xl sm:text-4xl md:text-5xl text-white tracking-tight drop-shadow-[0_0_15px_rgba(255,230,0,0.35)]">
                        {recorded.price}
                      </span>
                      <span className="text-[8.5px] xs:text-[10.5px] sm:text-sm line-through text-white/40 font-medium">
                        {recorded.originalPrice}
                      </span>
                      <span className="text-[7.5px] xs:text-[9px] sm:text-xs font-bold text-[#FFE600] bg-[#FFE600]/15 px-1.5 py-0.5 rounded border border-[#FFE600]/30">
                        /one-time
                      </span>
                    </div>

                    <p className="mt-1 text-[8px] xs:text-[9.5px] sm:text-[11px] font-bold text-[#FFE600]">
                      One-Time Fee • Instant Lifetime Access
                    </p>

                    <p className="mt-2 sm:mt-3.5 text-[8.5px] xs:text-[10px] sm:text-xs md:text-sm text-white/80 leading-snug sm:leading-relaxed border-t border-white/10 pt-2 sm:pt-3">
                      {recorded.desc}
                    </p>

                    {/* Verified Inclusions Header */}
                    <div className="mt-3.5 sm:mt-6 flex items-center gap-1 sm:gap-1.5 text-[8px] xs:text-[9.5px] sm:text-[11px] font-black uppercase tracking-wider text-[#FFE600]">
                      <CheckCircle2 className="h-2.5 w-2.5 xs:h-3.5 xs:w-3.5 sm:h-4 sm:w-4 shrink-0 text-[#FFE600]" />
                      <span>✨ VERIFIED RECORDED INCLUSIONS:</span>
                    </div>

                    {/* Unique Recorded Features with Verified Sharp Yellow Ticks */}
                    <div className="mt-2 sm:mt-3.5 space-y-1.5 xs:space-y-2 sm:space-y-3">
                      {recorded.features.map((feat, idx) => (
                        <div key={idx} className="flex items-start gap-1 xs:gap-1.5 sm:gap-3">
                          <div className="h-3 w-3 xs:h-3.5 xs:w-3.5 sm:h-5 sm:w-5 rounded-full bg-[#1c1602] border border-[#FFE600] flex items-center justify-center shrink-0 text-[#FFE600] mt-0.5 shadow-[0_0_8px_rgba(255,230,0,0.5)]">
                            <Check className="h-2 w-2 sm:h-3 sm:w-3 stroke-[3]" />
                          </div>
                          <span className="text-[8px] xs:text-[9.5px] sm:text-xs md:text-sm text-white font-medium leading-tight sm:leading-snug">
                            {feat}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Clean Short-Text High-Impact Sharp Yellow CTA Button */}
                  <div className="mt-4 sm:mt-8 pt-2.5 sm:pt-4 border-t border-white/10">
                    <button
                      onClick={() => handleEnroll("recorded")}
                      className="group relative flex w-full items-center justify-center gap-1 sm:gap-2 rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#FFE600] via-[#FFD600] to-[#E5A800] py-2 xs:py-2.5 sm:py-4 px-1 xs:px-2.5 sm:px-6 text-[9.5px] xs:text-[11px] sm:text-sm font-display font-black uppercase tracking-wider text-black shadow-[0_0_25px_rgba(255,230,0,0.75)] transition-all duration-200 hover:shadow-[0_0_40px_rgba(255,230,0,0.95)] hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                    >
                      <Rocket className="h-3 w-3 sm:h-4 sm:w-4 fill-black text-black shrink-0 hidden xs:inline-block" />
                      <span>Get Recorded — {recorded.price}</span>
                      <ArrowRight className="h-2.5 w-2.5 sm:h-4 sm:w-4 transition-transform group-hover:translate-x-1 shrink-0" />
                    </button>
                    <p className="mt-1 sm:mt-2 text-center text-[7.5px] xs:text-[8.5px] sm:text-[11px] text-[#FFE600] font-semibold">
                      ⚡ Instant Access to All Class Content & 100+ Prompt Vault
                    </p>
                  </div>
                </div>
              </div>

              {/* ================= INCLUDED IN BOTH MASTERCLASS TRACKS (CORE VALUE PILLARS) ================= */}
              <div className="mt-14 sm:mt-16 max-w-4xl mx-auto rounded-3xl border border-white/10 bg-gradient-to-b from-[#06180e]/90 via-[#030d07]/95 to-[#020604] p-6 sm:p-9 shadow-2xl">
                <div className="text-center max-w-2xl mx-auto mb-8">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00F076]/30 bg-[#072416] px-3.5 py-1 text-xs font-bold text-[#00F076] mb-2">
                    <Gift className="h-3.5 w-3.5" /> Full Masterclass Package
                  </span>
                  <h3 className="font-display font-extrabold italic text-2xl sm:text-3xl text-white">
                    Everything Included in <span className="text-[#00F076]">PenduGPT</span>
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm text-white/70">
                    We cover every single step from zero coding knowledge to delivering live
                    websites and closing ₹25,000–₹50,000 clients.
                  </p>
                </div>

                <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {/* Pillar 1: Free Domain & Free Cloud Hosting */}
                  <div className="rounded-2xl border border-white/10 bg-[#040e08] p-4.5 hover:border-[#00F076]/40 transition-all flex flex-col justify-between">
                    <div>
                      <div className="h-10 w-10 rounded-xl bg-[#072416] border border-[#00F076]/40 flex items-center justify-center text-[#00F076] mb-3 shadow-[0_0_15px_rgba(0,240,118,0.2)]">
                        <Globe className="h-5 w-5" />
                      </div>
                      <h4 className="font-bold text-sm text-white">
                        Free Domain & Cloud Hosting Setup
                      </h4>
                      <p className="mt-1.5 text-xs text-white/70 leading-relaxed">
                        Learn how to deploy live websites on global cloud infrastructure with custom
                        domains (.com / .in) and automated SSL certificates with ₹0 monthly server
                        fees.
                      </p>
                    </div>
                    <span className="mt-3 text-[11px] font-bold text-[#00F076]">
                      ✓ Save ₹1,500+/mo hosting costs
                    </span>
                  </div>

                  {/* Pillar 2: No Need to Buy Paid AI Tools */}
                  <div className="rounded-2xl border border-white/10 bg-[#040e08] p-4.5 hover:border-[#00F076]/40 transition-all flex flex-col justify-between">
                    <div>
                      <div className="h-10 w-10 rounded-xl bg-[#072416] border border-[#00F076]/40 flex items-center justify-center text-[#00F076] mb-3 shadow-[0_0_15px_rgba(0,240,118,0.2)]">
                        <Ban className="h-5 w-5" />
                      </div>
                      <h4 className="font-bold text-sm text-white">
                        Zero Paid AI Tool Subscriptions
                      </h4>
                      <p className="mt-1.5 text-xs text-white/70 leading-relaxed">
                        You don't need to spend thousands on expensive third-party builders or paid
                        AI subscriptions. We teach a 100% free toolchain that creates agency-grade
                        results.
                      </p>
                    </div>
                    <span className="mt-3 text-[11px] font-bold text-[#00F076]">
                      ✓ Save ₹10,000+/mo tool bills
                    </span>
                  </div>

                  {/* Pillar 3: 100+ High-Quality Prompt Templates */}
                  <div className="rounded-2xl border border-white/10 bg-[#040e08] p-4.5 hover:border-[#00F076]/40 transition-all flex flex-col justify-between">
                    <div>
                      <div className="h-10 w-10 rounded-xl bg-[#072416] border border-[#00F076]/40 flex items-center justify-center text-[#00F076] mb-3 shadow-[0_0_15px_rgba(0,240,118,0.2)]">
                        <Code2 className="h-5 w-5" />
                      </div>
                      <h4 className="font-bold text-sm text-white">
                        100+ High-Ticket Prompt Vault
                      </h4>
                      <p className="mt-1.5 text-xs text-white/70 leading-relaxed">
                        Copy-paste prompt formulas for dark-mode luxury aesthetics, hero sections,
                        pricing tables, glassmorphism, responsive menus, and fast loading animations.
                      </p>
                    </div>
                    <span className="mt-3 text-[11px] font-bold text-[#00F076]">
                      ✓ Copy-paste prompt formulas
                    </span>
                  </div>

                  {/* Pillar 4: How to Find High-Paying Clients */}
                  <div className="rounded-2xl border border-white/10 bg-[#040e08] p-4.5 hover:border-[#00F076]/40 transition-all flex flex-col justify-between">
                    <div>
                      <div className="h-10 w-10 rounded-xl bg-[#072416] border border-[#00F076]/40 flex items-center justify-center text-[#00F076] mb-3 shadow-[0_0_15px_rgba(0,240,118,0.2)]">
                        <Target className="h-5 w-5" />
                      </div>
                      <h4 className="font-bold text-sm text-white">
                        How to Find High-Paying Clients
                      </h4>
                      <p className="mt-1.5 text-xs text-white/70 leading-relaxed">
                        Discover the exact niches (clinics, boutiques, restaurants, real estate, NRI
                        businesses) that urgently need websites and are willing to pay ₹25k–₹50k.
                      </p>
                    </div>
                    <span className="mt-3 text-[11px] font-bold text-[#00F076]">
                      ✓ High-ticket niche roadmap
                    </span>
                  </div>

                  {/* Pillar 5: How to Cold Outreach Them */}
                  <div className="rounded-2xl border border-white/10 bg-[#040e08] p-4.5 hover:border-[#00F076]/40 transition-all flex flex-col justify-between">
                    <div>
                      <div className="h-10 w-10 rounded-xl bg-[#072416] border border-[#00F076]/40 flex items-center justify-center text-[#00F076] mb-3 shadow-[0_0_15px_rgba(0,240,118,0.2)]">
                        <Send className="h-5 w-5" />
                      </div>
                      <h4 className="font-bold text-sm text-white">
                        Cold Outreach Scripts (WhatsApp & IG)
                      </h4>
                      <p className="mt-1.5 text-xs text-white/70 leading-relaxed">
                        Get our proven WhatsApp messages, Instagram DM scripts, and Cold Email
                        frameworks that get a 40%+ response rate without sounding pushy or spammy.
                      </p>
                    </div>
                    <span className="mt-3 text-[11px] font-bold text-[#00F076]">
                      ✓ 40%+ reply rate templates
                    </span>
                  </div>

                  {/* Pillar 6: How to Deal with Clients & Contracts */}
                  <div className="rounded-2xl border border-white/10 bg-[#040e08] p-4.5 hover:border-[#00F076]/40 transition-all flex flex-col justify-between">
                    <div>
                      <div className="h-10 w-10 rounded-xl bg-[#072416] border border-[#00F076]/40 flex items-center justify-center text-[#00F076] mb-3 shadow-[0_0_15px_rgba(0,240,118,0.2)]">
                        <FileCheck className="h-5 w-5" />
                      </div>
                      <h4 className="font-bold text-sm text-white">
                        Client Dealing, Contracts & Handover
                      </h4>
                      <p className="mt-1.5 text-xs text-white/70 leading-relaxed">
                        Master price negotiation, handling objections, closing deals professionally,
                        and use our ready client contract agreements and invoice delivery templates.
                      </p>
                    </div>
                    <span className="mt-3 text-[11px] font-bold text-[#00F076]">
                      ✓ Ready legal contracts included
                    </span>
                  </div>
                </div>

                {/* Direct comparison summary box */}
                <div className="mt-8 rounded-2xl border border-[#00F076]/30 bg-[#05160d] p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h4 className="font-display font-extrabold text-white text-base">
                      Need 1-on-1 Guidance and Real-Time Review?
                    </h4>
                    <p className="text-xs text-white/70 mt-1">
                      Choose <strong>Option 1 (Live Masterclass)</strong> for live Zoom sessions with
                      Khushpreet Singh, personal website screen shares, and roleplays. Choose{" "}
                      <strong>Option 2 (Recorded)</strong> if you prefer learning at your own pace.
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleEnroll("live")}
                      className="rounded-xl bg-[#00F076] hover:bg-[#00d668] text-black text-xs font-bold px-4 py-2.5 transition-all cursor-pointer shadow-md"
                    >
                      Join Live ({live.price})
                    </button>
                    <button
                      onClick={() => handleEnroll("recorded")}
                      className="rounded-xl bg-[#FFE600] hover:bg-[#ffd600] text-black text-xs font-bold px-4 py-2.5 transition-all cursor-pointer shadow-md"
                    >
                      Recorded ({recorded.price})
                    </button>
                  </div>
                </div>
              </div>

              {/* Trust & Guarantee Bar */}
              <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-4xl mx-auto">
                <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-[#05110a] p-3 text-left">
                  <ShieldCheck className="h-5 w-5 text-[#00F076] shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-white">100% Verified</p>
                    <p className="text-[10px] text-white/50">Safe & Secure Payment</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-[#05110a] p-3 text-left">
                  <Zap className="h-5 w-5 text-[#00F076] shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-white">Instant Access</p>
                    <p className="text-[10px] text-white/50">Zero Waiting Time</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-[#05110a] p-3 text-left">
                  <MessageSquare className="h-5 w-5 text-[#00F076] shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-white">Punjabi Support</p>
                    <p className="text-[10px] text-white/50">WhatsApp Doubt Help</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-[#05110a] p-3 text-left">
                  <Globe className="h-5 w-5 text-[#00F076] shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-white">Lifetime Access</p>
                    <p className="text-[10px] text-white/50">Free Future Updates</p>
                  </div>
                </div>
              </div>

              {/* Floating Right-to-Left Student Reviews Marquee */}
              <div className="mt-12 sm:mt-16">
                <StudentReviewsMarquee />
              </div>

              {/* Rewatch Free Training CTA Banner */}
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl glass-card px-5 py-3.5 max-w-4xl mx-auto border border-white/10">
                <div className="flex items-center gap-3 text-center sm:text-left">
                  <RotateCcw className="h-4 w-4 text-[#00F076] shrink-0" />
                  <span className="text-xs text-white/80 font-medium">
                    Want to review the initial free training video again?
                  </span>
                </div>

                <button
                  onClick={() => navigate({ to: "/training" })}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00F076] hover:underline cursor-pointer"
                >
                  <span>Rewatch Training Video</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      </div>
 
      {/* Complete Footer matching Image 2 */}
      <SiteFooter />

      {/* Razorpay Payment & Verification Dialog with Auto WhatsApp Redirection */}
      <RazorpayCheckoutDialog tier={selectedTier} onClose={() => setSelectedTier(null)} />
    </div>
  );
}

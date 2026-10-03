import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import Player from "@vimeo/player";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Lock,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { siteConfig } from "@/config/site";
import { track } from "@/lib/analytics";
import { BrandLogo } from "@/components/common/BrandLogo";
import { TrainingSkeleton } from "@/components/common/Skeleton";
import { saveVideoProgress, fetchRemoteVideoProgress } from "@/lib/video.functions";

export function TrainingScreen() {
  const navigate = useNavigate();
  const saveRemoteProgress = useServerFn(saveVideoProgress);
  const fetchRemoteProgress = useServerFn(fetchRemoteVideoProgress);

  const { vimeoId, completionThreshold, storageKey, completionKey, registrationKey } =
    siteConfig.video;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);

  const watchedRef = useRef(0);
  const lastPositionRef = useRef(0);
  const durationRef = useRef(0);
  const lastRemoteSaveRef = useRef(0);
  const registrationIdRef = useRef<string | null>(null);
  const milestones = useRef(new Set<number>());

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [progress, setProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Strict Access Control: No direct access without completing the initial registration forms!
  useEffect(() => {
    let regId: string | null = null;
    try {
      const reg = JSON.parse(localStorage.getItem(registrationKey) || "null");
      if (!reg || !reg.registered) {
        setIsAuthorized(false);
        navigate({ to: "/" });
        return;
      }
      regId = reg.registrationId || null;
      registrationIdRef.current = regId;
      setIsAuthorized(true);
    } catch {
      setIsAuthorized(false);
      navigate({ to: "/" });
      return;
    }

    // Restore saved progress and playback position from localStorage
    try {
      const savedCompleted = localStorage.getItem(completionKey) === "true";
      if (savedCompleted) {
        setIsCompleted(true);
        setProgress(1);
      }

      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved) {
        if (typeof saved.watched === "number") {
          watchedRef.current = saved.watched;
        }
        if (typeof saved.lastPosition === "number") {
          lastPositionRef.current = saved.lastPosition;
        } else if (typeof saved.watched === "number") {
          lastPositionRef.current = saved.watched;
        }

        const p = saved.progress ?? 0;
        setProgress(p);
        if (p >= completionThreshold || saved.complete) {
          setIsCompleted(true);
        }
      }
    } catch {
      /* ignore */
    }

    // Also fetch remote progress from Supabase if registrationId is present
    if (regId) {
      fetchRemoteProgress({
        data: {
          registrationId: regId,
          videoId: vimeoId,
        },
      })
        .then((res) => {
          if (res?.ok && res.progress) {
            if (res.progress.isCompleted) {
              setIsCompleted(true);
              setProgress(1);
            }
            if (res.progress.lastPosition > lastPositionRef.current) {
              lastPositionRef.current = res.progress.lastPosition;
              if (res.progress.lastPosition > watchedRef.current) {
                watchedRef.current = res.progress.lastPosition;
              }
            }
          }
        })
        .catch(() => {});
    }
  }, [storageKey, completionKey, completionThreshold, registrationKey, navigate, vimeoId, fetchRemoteProgress]);

  const persist = (p: number, complete: boolean, currentSeconds?: number) => {
    try {
      const pos = typeof currentSeconds === "number" ? currentSeconds : lastPositionRef.current;
      lastPositionRef.current = pos;
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          watched: watchedRef.current,
          lastPosition: pos,
          progress: p,
          complete,
        }),
      );
      if (complete) {
        localStorage.setItem(completionKey, "true");
      }

      // Sync to Supabase video_progress table periodically (every 5s or on completion)
      const regId = registrationIdRef.current;
      if (regId && (complete || Math.abs(pos - lastRemoteSaveRef.current) >= 5)) {
        lastRemoteSaveRef.current = pos;
        saveRemoteProgress({
          data: {
            registrationId: regId,
            videoId: vimeoId,
            lastPositionSeconds: pos,
            completionStatus: complete,
          },
        }).catch(() => {});
      }
    } catch {
      /* ignore */
    }
  };

  // Synchronize on page exit / tab switch
  useEffect(() => {
    const handlePageExit = () => {
      persist(progress, isCompleted, lastPositionRef.current);
    };

    window.addEventListener("beforeunload", handlePageExit);
    window.addEventListener("pagehide", handlePageExit);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        handlePageExit();
      }
    });

    return () => {
      window.removeEventListener("beforeunload", handlePageExit);
      window.removeEventListener("pagehide", handlePageExit);
    };
  }, [progress, isCompleted]);

  const handleCompletion = () => {
    setIsCompleted(true);
    setProgress(1);
    persist(1, true);
    track("video_complete");
  };

  // Initialize Vimeo Player with hidden default controls & auto-resume where left off
  useEffect(() => {
    if (!isAuthorized) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    try {
      const player = new Player(iframe);
      playerRef.current = player;

      player.on("loaded", async () => {
        try {
          const duration = await player.getDuration();
          durationRef.current = duration;
          const muted = await player.getMuted();
          setIsMuted(muted);

          // Resume video from the exact timestamp where the user left off
          const resumeTime = lastPositionRef.current || watchedRef.current;
          if (resumeTime > 1 && resumeTime < duration) {
            await player.setCurrentTime(resumeTime);
          }
        } catch {
          /* ignore */
        }
      });

      player.on("play", () => {
        setIsPlaying(true);
        triggerControlsAutoHide();
        track("video_start");
      });

      player.on("pause", async () => {
        setIsPlaying(false);
        setShowControls(true);
        if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
        try {
          const cur = await player.getCurrentTime();
          persist(progress, isCompleted, cur);
        } catch {
          /* ignore */
        }
      });

      player.on("timeupdate", (data: { seconds: number; percent: number; duration: number }) => {
        durationRef.current = data.duration || durationRef.current;
        lastPositionRef.current = data.seconds;

        // Anti-skip protection: If time jumps ahead of max watched, snap back immediately!
        if (data.seconds > watchedRef.current + 2) {
          player.setCurrentTime(watchedRef.current).catch(() => {});
          return;
        }

        // Track max genuine watched seconds
        if (data.seconds > watchedRef.current) {
          watchedRef.current = data.seconds;
        }

        const calculatedProgress =
          durationRef.current > 0 ? data.seconds / durationRef.current : data.percent;
        const p = Math.min(
          Math.max(calculatedProgress, watchedRef.current / (durationRef.current || 1)),
          1,
        );
        setProgress(p);

        for (const m of [25, 50, 75]) {
          if (p * 100 >= m && !milestones.current.has(m)) {
            milestones.current.add(m);
            track("video_progress", { percent: m });
          }
        }

        if (p >= completionThreshold) {
          handleCompletion();
        } else {
          persist(p, false, data.seconds);
        }
      });

      player.on("ended", () => {
        setIsPlaying(false);
        setShowControls(true);
        handleCompletion();
      });
    } catch (err) {
      console.warn("Vimeo Player init warning:", err);
    }

    return () => {
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
      if (playerRef.current) {
        playerRef.current.unload().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized, completionThreshold]);

  const triggerControlsAutoHide = () => {
    setShowControls(true);
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current);
    }
    hideControlsTimer.current = setTimeout(() => {
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

  const togglePlay = async () => {
    if (!playerRef.current) return;
    try {
      const paused = await playerRef.current.getPaused();
      if (paused) {
        try {
          await playerRef.current.play();
          setIsPlaying(true);
          triggerControlsAutoHide();
        } catch {
          // If browser blocks unmuted play on mobile, mute and play
          try {
            await playerRef.current.setMuted(true);
            setIsMuted(true);
            await playerRef.current.play();
            setIsPlaying(true);
            triggerControlsAutoHide();
          } catch {
            /* ignore */
          }
        }
      } else {
        try {
          await playerRef.current.pause();
          setIsPlaying(false);
          setShowControls(true);
          if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* fallback */
    }
  };

  const handleRewind10 = async () => {
    handleUserActivity();
    if (!playerRef.current) return;
    try {
      const current = await playerRef.current.getCurrentTime();
      const newTime = Math.max(0, current - 10);
      lastPositionRef.current = newTime;
      await playerRef.current.setCurrentTime(newTime);
      persist(progress, isCompleted, newTime);
    } catch {
      /* fallback */
    }
  };

  const toggleMute = async () => {
    handleUserActivity();
    if (!playerRef.current) return;
    try {
      const muted = await playerRef.current.getMuted();
      await playerRef.current.setMuted(!muted);
      setIsMuted(!muted);
    } catch {
      /* fallback */
    }
  };

  // 1-Click CSS Theater Mode Fullscreen (Blocks native OS video scrubber on iOS/Android from skipping)
  const toggleFullscreen = () => {
    handleUserActivity();
    setIsFullscreen((prev) => !prev);
  };

  const pct = Math.round(progress * 100);

  if (isAuthorized === null || isAuthorized === false) {
    return <TrainingSkeleton />;
  }

  return (
    <div className="relative min-h-screen flex flex-col justify-between text-foreground selection:bg-[#00F076] selection:text-black">
      {/* SaaS Floating Navbar Header */}
      <header className="relative z-20 w-full pt-4 px-4">
        <nav className="mx-auto flex max-w-5xl items-center justify-between rounded-2xl glass-panel px-4 sm:px-6 py-2.5">
          {/* Logo & Brand */}
          <BrandLogo size="md" />

          {/* Right Status Badge */}
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#00F076]/30 bg-[#072416] px-3.5 py-1.5 text-xs font-semibold text-[#00F076] shadow-[0_0_15px_rgba(0,240,118,0.2)]">
              <span className="h-2 w-2 rounded-full bg-[#00F076] animate-pulse" />
              <span className="hidden sm:inline">10-Min Free Masterclass</span>
              <span className="sm:hidden">Free Video</span>
            </span>
          </div>
        </nav>
      </header>

      {/* Main Video Section */}
      <main className="relative z-10 mx-auto w-full max-w-5xl px-4 py-8 sm:py-10">
        {/* Compelling Title & Subheading */}
        <div className="text-center max-w-3xl mx-auto mb-8 animate-reveal">
          {/* Top Pill Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#00F076]/30 bg-[#072416]/70 px-4 py-1.5 text-xs font-display font-bold uppercase tracking-wider text-[#00F076] mb-4 shadow-[0_0_20px_rgba(0,240,118,0.15)] backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Exclusive Free Training Video</span>
          </div>

          {/* Main Headline */}
          <h1 className="font-display font-extrabold italic text-2xl sm:text-4xl md:text-5xl text-white tracking-tight leading-[1.2]">
            Learn in 10 Mins: How to Make <span className="text-[#FFD21E]">Websites with AI</span> &
            Earn <span className="text-[#00F076]">₹1 Lakh – ₹3 Lakh/Month</span>
          </h1>

          {/* Subtitle Directing Towards the Video (in faded white) */}
          <p className="mt-4 text-sm sm:text-base font-medium text-white/75 leading-relaxed max-w-2xl mx-auto flex items-center justify-center gap-2">
            <span>
              👇 Watch this 10-Min free training video below to unlock the complete masterclass
              blueprint & special offer.
            </span>
          </p>
        </div>

        {/* 16:9 Cinema Player Card with Glow Shadow & Custom Controls Overlay */}
        <div className="relative group/player mx-auto w-full">
          {/* Intense Radiant Ambient Halo Glow Around Video */}
          <div className="pointer-events-none absolute -inset-2 sm:-inset-3 rounded-[32px] sm:rounded-[40px] bg-gradient-to-r from-[#00F076]/35 via-[#00D668]/25 to-[#00F076]/35 blur-2xl opacity-75 group-hover/player:opacity-100 transition-opacity duration-500" />
          <div className="pointer-events-none absolute -inset-1 rounded-[26px] sm:rounded-[34px] bg-gradient-to-b from-[#00F076]/40 to-transparent blur-md opacity-60" />

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
                : "rounded-[20px] xs:rounded-[26px] sm:rounded-[32px] glass-card p-1.5 xs:p-2.5 sm:p-4 md:p-5"
            }`}
          >
            {/* Quick Exit Fullscreen Button on Top Right in Fullscreen Mode */}
            {isFullscreen && (
              <button
                type="button"
                onClick={toggleFullscreen}
                className="absolute top-3 right-3 sm:top-5 sm:right-5 z-50 flex items-center gap-1.5 rounded-full bg-black/80 hover:bg-black text-white px-3.5 py-2 text-xs font-semibold backdrop-blur-md border border-white/25 shadow-2xl active:scale-95 cursor-pointer"
              >
                <Minimize className="h-4 w-4 text-[#00F076]" />
                <span>Exit Fullscreen</span>
              </button>
            )}

            <div
              className={`relative aspect-video w-full overflow-hidden bg-[#020503] shadow-2xl ${
                isFullscreen ? "h-full max-h-screen rounded-none" : "rounded-xl sm:rounded-2xl"
              }`}
            >
              {/* Vimeo Iframe with Hidden Native Controls */}
              <iframe
                ref={iframeRef}
                src={`https://player.vimeo.com/video/${vimeoId}?controls=0&badge=0&autopause=0&player_id=0&app_id=58479&title=0&byline=0&portrait=0&sidedock=0&dnt=1`}
                className="absolute inset-0 h-full w-full border-0 pointer-events-none"
                allow="autoplay; fullscreen; picture-in-picture"
                title="PenduGPT AI Website Training Video"
              />

              {/* Clickable Backdrop to Toggle Play/Pause */}
              <button
                onClick={togglePlay}
                className="absolute inset-0 h-full w-full cursor-pointer z-10 bg-transparent"
                aria-label={isPlaying ? "Pause video" : "Play video"}
              />

              {/* Center Big Play Button when Paused */}
              {!isPlaying && (
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

              {/* Custom Bottom Overlay with Progression Line & Action Controls */}
              <div
                className={`absolute bottom-0 inset-x-0 z-30 p-3 xs:p-4 sm:p-5 bg-gradient-to-t from-black/95 via-black/60 to-transparent transition-opacity duration-300 ${
                  showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                {/* Top Progression Bar of the Video Overlay (Enlarged with Water Flow) */}
                <div className="w-full h-2 sm:h-2.5 rounded-full bg-white/20 overflow-hidden mb-3 shadow-inner">
                  <div
                    className="h-full rounded-full progress-water-flow shadow-[0_0_10px_rgba(0,240,118,0.8)] transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Action Buttons Row */}
                <div className="flex items-center justify-between gap-2 sm:gap-3">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {/* Play / Pause Toggle Button */}
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

                    {/* Rewind 10 Seconds Button */}
                    <button
                      type="button"
                      onClick={handleRewind10}
                      className="flex items-center gap-1 sm:gap-1.5 rounded-full bg-black/75 hover:bg-black text-white px-3 py-2 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-semibold backdrop-blur-md border border-white/20 hover:border-[#00F076]/60 shadow-md transition-all active:scale-95 cursor-pointer"
                      title="Rewind 10 seconds"
                      aria-label="Rewind 10 seconds"
                    >
                      <RotateCcw className="h-4 w-4 text-[#00F076]" />
                      <span>-10s</span>
                    </button>

                    {/* Mute / Unmute Button */}
                    <button
                      type="button"
                      onClick={toggleMute}
                      className="flex items-center gap-1 sm:gap-1.5 rounded-full bg-black/75 hover:bg-black text-white px-3 py-2 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-semibold backdrop-blur-md border border-white/20 hover:border-[#00F076]/60 shadow-md transition-all active:scale-95 cursor-pointer"
                    >
                      {isMuted ? (
                        <>
                          <VolumeX className="h-4 w-4 text-amber-400" />
                          <span>Unmute</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="h-4 w-4 text-[#00F076]" />
                          <span>Mute</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Right: Fullscreen Button */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleFullscreen}
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
            </div>
          </div>
        </div>

        {/* Video Progress Bar & Next Step Unlock Gate (Enhanced with Water-Flow Wave Animation) */}
        <div className="mt-6 rounded-[24px] glass-card p-5 sm:p-7">
          {/* Progress Tracker */}
          <div className="mb-5">
            <div className="flex items-center justify-between text-xs sm:text-sm font-semibold mb-2.5">
              <div className="flex items-center gap-2 text-white">
                <Clock className="h-4 w-4 text-[#00F076]" />
                <span>Training Progress</span>
              </div>
              <span className="inline-flex items-center rounded-full bg-[#072416] border border-[#00F076]/30 px-3 py-0.5 text-xs font-bold text-[#00F076]">
                {pct}% Complete
              </span>
            </div>

            {/* Glowing Progress Bar with Water Flowing Rightwards Animation */}
            <div
              className="h-3 w-full overflow-hidden rounded-full bg-white/10 p-0.5"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full progress-water-flow shadow-[0_0_15px_rgba(0,240,118,0.9)] transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Status Message and Next Step Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
            {isCompleted ? (
              <>
                <div className="flex items-center gap-3.5">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#072416] text-[#00F076] border border-[#00F076]/40 shadow-[0_0_15px_rgba(0,240,118,0.3)]">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-display font-bold text-white">Training completed!</p>
                    <p className="text-xs text-[#00F076] font-semibold">
                      Your Masterclass enrollment options are unlocked!
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => navigate({ to: "/next-step" })}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-[#00F076] to-[#00D668] px-8 py-3.5 text-xs sm:text-sm font-display font-extrabold italic uppercase tracking-wider text-black shadow-[0_0_25px_rgba(0,240,118,0.6)] transition-all hover:opacity-95 hover:scale-105 active:scale-[0.98] cursor-pointer"
                >
                  <span>CONTINUE TO NEXT STEP</span>
                  <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                </button>
              </>
            ) : (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3.5">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/5 text-[#00F076] border border-white/10">
                    <Lock className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-display font-bold text-white">Offer Locked</p>
                    <p className="text-xs text-[#94A3B8]">
                      Watch 95% of the video to automatically unlock the next step.
                    </p>
                  </div>
                </div>

                {/* Dev bypass or quick test */}
                <button
                  onClick={handleCompletion}
                  className="hidden md:inline-flex text-[11px] font-mono text-white/30 hover:text-[#00F076] transition-colors"
                  title="Fast-forward completion for testing"
                >
                  [Skip to End]
                </button>
              </div>
            )}
          </div>
        </div>

        {/* SaaS Trust Highlights Section */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-3.5 rounded-2xl glass-option p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#072416] border border-[#00F076]/30 text-[#00F076]">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-display font-bold text-sm text-white">Zero Coding Needed</h4>
              <p className="text-xs text-[#94A3B8]">100% prompt-to-website AI workflow</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-2xl glass-option p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#072416] border border-[#00F076]/30 text-[#00F076]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-display font-bold text-sm text-white">Proven Blueprint</h4>
              <p className="text-xs text-[#94A3B8]">Actionable freelance & client systems</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-2xl glass-option p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#072416] border border-[#00F076]/30 text-[#00F076]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-display font-bold text-sm text-white">Lifetime Value</h4>
              <p className="text-xs text-[#94A3B8]">High-ticket monetization strategies</p>
            </div>
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="relative z-10 w-full border-t border-white/10 py-6 px-4 mt-8 text-center text-xs text-white/50">
        <p>© {new Date().getFullYear()} PenduGPT. All rights reserved.</p>
      </footer>
    </div>
  );
}

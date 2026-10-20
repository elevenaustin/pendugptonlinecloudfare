import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import Player from "@vimeo/player";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
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
import { TrainingSkeleton, VideoPlayerSkeleton } from "@/components/common/Skeleton";
import { saveVideoProgress, fetchRemoteVideoProgress, reportVideoInactivity } from "@/lib/video.functions";

export function TrainingScreen() {
  const navigate = useNavigate();
  const saveRemoteProgress = useServerFn(saveVideoProgress);
  const fetchRemoteProgress = useServerFn(fetchRemoteVideoProgress);
  const reportInactivity = useServerFn(reportVideoInactivity);

  const { vimeoId, completionThreshold, storageKey, completionKey, registrationKey } =
    siteConfig.video;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);

  const watchedRef = useRef(0);
  const lastPositionRef = useRef(0);
  const durationRef = useRef(0);
  const lastRemoteSavePosRef = useRef(0);
  const lastRemoteSaveTimeRef = useRef(0);
  const lastInactivityDispatchTimeRef = useRef(0);
  const isSavingRemoteRef = useRef(false);
  const lastTimeCheckRef = useRef<number>(Date.now());
  const registrationIdRef = useRef<string | null>(null);
  const userPhoneRef = useRef<string | null>(null);
  const milestones = useRef(new Set<number>());
  const completionTriggeredRef = useRef(false);

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [progress, setProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const isRedirectingRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
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
      userPhoneRef.current = reg.whatsapp || null;
      setIsAuthorized(true);
    } catch {
      setIsAuthorized(false);
      navigate({ to: "/" });
      return;
    }

    // Restore saved progress and playback position with STRICT INTEGRITY CHECK
    try {
      let savedWatched = 0;
      let savedPosition = 0;
      let savedProgress = 0;

      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved) {
        if (typeof saved.watched === "number" && !isNaN(saved.watched)) {
          savedWatched = Math.max(0, saved.watched);
          watchedRef.current = savedWatched;
        }
        if (typeof saved.lastPosition === "number" && !isNaN(saved.lastPosition)) {
          savedPosition = Math.max(0, saved.lastPosition);
          lastPositionRef.current = savedPosition;
        } else {
          lastPositionRef.current = savedWatched;
        }
        if (typeof saved.progress === "number" && !isNaN(saved.progress)) {
          savedProgress = Math.min(1, Math.max(0, saved.progress));
        }
      }

      // STRICT SECURITY RULE:
      // The video can ONLY be complete if progress is legitimately >= completionThreshold (95%)
      const isGenuineComplete = savedProgress >= completionThreshold;

      if (isGenuineComplete) {
        completionTriggeredRef.current = true;
        setIsCompleted(true);
        setProgress(1);
        try {
          localStorage.setItem(completionKey, "true");
        } catch {}
      } else {
        // Prevent bypass / desync: if progress is less than 95% (e.g. 15%), it CANNOT be completed!
        completionTriggeredRef.current = false;
        setIsCompleted(false);
        setProgress(savedProgress);
        try {
          localStorage.removeItem(completionKey);
          localStorage.removeItem("pendugpt_secret_bypass");
        } catch {}
      }
    } catch {
      setProgress(0);
      setIsCompleted(false);
    }

    // Also fetch remote progress from Supabase if registrationId is present
    if (regId) {
      fetchRemoteProgress({
        data: {
          registrationId: regId,
          phone: userPhoneRef.current,
          videoId: vimeoId,
        },
      })
        .then((res) => {
          if (res?.ok && res.progress) {
            // Strict remote verification: must have watched at least 750 seconds to count as completed
            if (
              res.progress.isCompleted &&
              (res.progress.lastPosition >= 750 || watchedRef.current >= 750)
            ) {
              completionTriggeredRef.current = true;
              setIsCompleted(true);
              setProgress(1);
              try {
                localStorage.setItem(completionKey, "true");
              } catch {}
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

  const persist = (
    p: number,
    complete: boolean,
    currentSeconds?: number,
    forceRemote = false,
  ) => {
    try {
      const pos = typeof currentSeconds === "number" ? currentSeconds : lastPositionRef.current;
      lastPositionRef.current = pos;

      // Strict integrity: only mark complete if progress >= completionThreshold
      const genuineComplete = complete && p >= completionThreshold;

      localStorage.setItem(
        storageKey,
        JSON.stringify({
          watched: watchedRef.current,
          lastPosition: pos,
          progress: p,
          complete: genuineComplete,
        }),
      );

      if (genuineComplete) {
        localStorage.setItem(completionKey, "true");
      } else {
        localStorage.removeItem(completionKey);
      }

      // Sync to database periodically (every 20–30s during active playback, or on pause/play/exit)
      const regId = registrationIdRef.current;
      const phone = userPhoneRef.current;
      if (regId || phone) {
        const now = Date.now();
        const timeSinceLastSave = now - lastRemoteSaveTimeRef.current;
        const posDiff = Math.abs(pos - lastRemoteSavePosRef.current);

        // Conditions to trigger remote write:
        // 1. Completion is reached (always write immediately)
        // 2. Explicit action (pause, play resume, page exit) if position moved >= 2s or time >= 20s
        // 3. Periodic active playback: every 25s (within 20–30s requirement) and pos advanced >= 15s
        const shouldSave =
          genuineComplete ||
          (forceRemote && (posDiff >= 2 || timeSinceLastSave >= 20000)) ||
          (timeSinceLastSave >= 25000 && posDiff >= 15);

        if (shouldSave && (!isSavingRemoteRef.current || genuineComplete)) {
          isSavingRemoteRef.current = true;
          lastRemoteSaveTimeRef.current = now;
          lastRemoteSavePosRef.current = pos;

          saveRemoteProgress({
            data: {
              registrationId: regId || undefined,
              phone: phone || undefined,
              videoId: vimeoId,
              lastPositionSeconds: pos,
              completionStatus: genuineComplete,
            },
          })
            .catch((err) => {
              console.warn("[TrainingScreen] Video activity sync notice:", err);
            })
            .finally(() => {
              isSavingRemoteRef.current = false;
            });
        }
      }
    } catch {
      /* ignore */
    }
  };

  const triggerInactivityNotification = useCallback(
    (reason: "pause" | "visibilitychange" | "pagehide") => {
      const regId = registrationIdRef.current;
      if (!regId && !userPhoneRef.current) return;
      const currentPos = lastPositionRef.current || watchedRef.current;
      // Meaningful progress guard: only notify if watched >= 15s and < 815s (incomplete)
      if (isCompleted || currentPos < 15 || currentPos >= 815) return;

      const now = Date.now();
      // Client-side debounce: at least 60 seconds between trigger attempts from this browser tab
      if (now - lastInactivityDispatchTimeRef.current < 60000) return;
      lastInactivityDispatchTimeRef.current = now;

      reportInactivity({
        data: {
          registrationId: regId,
          phone: userPhoneRef.current,
          videoId: vimeoId,
          lastPositionSeconds: currentPos,
          reason,
        },
      }).catch((err) => {
        console.warn("[TrainingScreen] Inactivity event notice:", err);
      });
    },
    [isCompleted, reportInactivity, vimeoId],
  );

  // Synchronize on page exit / tab switch
  useEffect(() => {
    const handlePageExit = (reason: "pagehide" | "visibilitychange" = "pagehide") => {
      persist(progress, isCompleted, lastPositionRef.current, true);
      triggerInactivityNotification(reason);
    };

    const onBeforeUnload = () => handlePageExit("pagehide");
    const onPageHide = () => handlePageExit("pagehide");
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handlePageExit("visibilitychange");
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [progress, isCompleted, triggerInactivityNotification]);

  const handleCompletion = (force = false) => {
    const duration = durationRef.current || 0;
    const genuineWatched = watchedRef.current;
    const genuineRatio = duration > 0 ? genuineWatched / duration : progress;

    // Strict Anti-Bypass Guard: Must have watched at least completionThreshold (95%)
    if (genuineRatio < completionThreshold && !force) {
      console.warn("Security notice: Video cannot be completed before reaching 95% threshold.");
      return;
    }

    if (completionTriggeredRef.current && !force) return;
    completionTriggeredRef.current = true;
    setIsCompleted(true);
    setProgress(1);
    const completedPos =
      duration > 0
        ? duration
        : Math.max(lastPositionRef.current, watchedRef.current);
    persist(1, true, completedPos);
    track("video_complete");
  };

  const handleCompletionAndRedirect = async (force = false) => {
    const duration = durationRef.current || 0;
    const genuineWatched = watchedRef.current;
    const genuineRatio = duration > 0 ? genuineWatched / duration : progress;

    // Strict Anti-Bypass Guard: Must have watched at least completionThreshold (95%)
    if (genuineRatio < completionThreshold && !force) {
      console.warn("Security notice: Video cannot be completed before reaching 95% threshold.");
      return;
    }

    if (isRedirectingRef.current) return;
    isRedirectingRef.current = true;
    setIsRedirecting(true);
    completionTriggeredRef.current = true;
    setIsCompleted(true);
    setProgress(1);

    const completedPos =
      duration > 0
        ? duration
        : Math.max(lastPositionRef.current, watchedRef.current);

    // Save locally
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          watched: Math.max(watchedRef.current, completedPos),
          lastPosition: completedPos,
          progress: 1,
          complete: true,
        }),
      );
      localStorage.setItem(completionKey, "true");
    } catch {}

    track("video_complete");

    // Authoritative Server Sync: Ensure Supabase public.leads has unlocked_class and video_completed_at
    const regId = registrationIdRef.current;
    const phone = userPhoneRef.current;
    if (regId || phone) {
      try {
        await Promise.race([
          saveRemoteProgress({
            data: {
              registrationId: regId || undefined,
              phone: phone || undefined,
              videoId: vimeoId,
              lastPositionSeconds: completedPos,
              completionStatus: true,
            },
          }),
          new Promise((resolve) => setTimeout(resolve, 1500)),
        ]);
      } catch (err) {
        console.warn("[TrainingScreen] Video completion sync notice:", err);
      }
    }

    // Redirect to Class Pricing Details section under the exact required URL
    navigate({ to: "/classfeesecrettunnel" });
  };

  const unmuteAudio = useCallback(async () => {
    if (!playerRef.current) return;
    try {
      await playerRef.current.setMuted(false);
      await playerRef.current.setVolume(1);
      setIsMuted(false);
    } catch {
      /* ignore */
    }
  }, []);

  // Global interaction listener: unmute audio on first user touch/click/key anywhere
  useEffect(() => {
    if (!isAuthorized) return;

    const handleFirstUserInteraction = () => {
      unmuteAudio();
    };

    window.addEventListener("pointerdown", handleFirstUserInteraction, { passive: true, once: true });
    window.addEventListener("touchstart", handleFirstUserInteraction, { passive: true, once: true });
    window.addEventListener("click", handleFirstUserInteraction, { passive: true, once: true });
    window.addEventListener("keydown", handleFirstUserInteraction, { passive: true, once: true });

    return () => {
      window.removeEventListener("pointerdown", handleFirstUserInteraction);
      window.removeEventListener("touchstart", handleFirstUserInteraction);
      window.removeEventListener("click", handleFirstUserInteraction);
      window.removeEventListener("keydown", handleFirstUserInteraction);
    };
  }, [isAuthorized, unmuteAudio]);

  // Initialize Vimeo Player with instant autoplay & auto-resume where left off
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

          // Resume video from the exact timestamp where the user left off
          const resumeTime = lastPositionRef.current || watchedRef.current;
          if (resumeTime > 1 && resumeTime < duration) {
            await player.setCurrentTime(resumeTime);
          }

          // Start instant playback (< 1 second)
          try {
            await player.play();
            setIsPlaying(true);
            setIsBuffering(false);
            setHasStarted(true);
          } catch {
            /* browser may queue play */
          }

          // Attempt initial unmuted audio; if blocked, remain muted with audio cue
          try {
            await player.setMuted(false);
            await player.setVolume(1);
            setIsMuted(false);
          } catch {
            setIsMuted(true);
          }
        } catch {
          /* ignore */
        }
      });

      player.on("play", async () => {
        setIsPlaying(true);
        setIsBuffering(false);
        setHasStarted(true);
        triggerControlsAutoHide();
        track("video_start");
        try {
          const cur = await player.getCurrentTime();
          persist(progress, isCompleted, cur, true);
        } catch {
          /* ignore */
        }
      });

      player.on("playing", () => {
        setIsPlaying(true);
        setIsBuffering(false);
        setHasStarted(true);
      });

      player.on("bufferstart", () => {
        setIsBuffering(true);
      });

      player.on("bufferend", () => {
        setIsBuffering(false);
      });

      (player as any).on("waiting", () => {
        setIsBuffering(true);
      });

      player.on("pause", async () => {
        setIsPlaying(false);
        setIsBuffering(false);
        setShowControls(true);
        if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
        try {
          const cur = await player.getCurrentTime();
          persist(progress, isCompleted, cur, true);
          triggerInactivityNotification("pause");
        } catch {
          /* ignore */
        }
      });

      // Anti-skip protection on seek: immediately snap back if seeking ahead of watched position
      player.on("seeked", async (data: { seconds: number }) => {
        if (data.seconds > watchedRef.current + 1.5) {
          try {
            await player.setCurrentTime(watchedRef.current);
            lastPositionRef.current = watchedRef.current;
          } catch {}
        }
      });

      // Anti-tamper on playback rate: lock speed to 1x
      player.on("playbackratechange", async (data: { playbackRate: number }) => {
        if (data.playbackRate > 1.25) {
          try {
            await player.setPlaybackRate(1);
          } catch {}
        }
      });

      player.on("timeupdate", (data: { seconds: number; percent: number; duration: number }) => {
        durationRef.current = data.duration || durationRef.current;
        const currentSeconds = data.seconds;
        lastPositionRef.current = currentSeconds;
        setIsBuffering(false);
        setHasStarted(true);

        const now = Date.now();
        const elapsedRealSeconds =
          lastTimeCheckRef.current > 0 ? (now - lastTimeCheckRef.current) / 1000 : 1;
        lastTimeCheckRef.current = now;

        // Anti-skip protection: If time jumps ahead of max watched + 1.5s, snap back immediately!
        if (currentSeconds > watchedRef.current + 1.5) {
          player.setCurrentTime(watchedRef.current).catch(() => {});
          return;
        }

        // Anti-acceleration: If video advanced faster than 2.5x real elapsed time, snap back!
        if (
          currentSeconds > lastPositionRef.current &&
          currentSeconds - lastPositionRef.current > elapsedRealSeconds * 2.5
        ) {
          player.setCurrentTime(watchedRef.current).catch(() => {});
          return;
        }

        // Genuine watch time accumulation
        if (currentSeconds > watchedRef.current) {
          watchedRef.current = currentSeconds;
        }

        const calculatedProgress =
          durationRef.current > 0 ? currentSeconds / durationRef.current : data.percent;
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
          // If playback naturally finishes to the end (within 1.2s of video duration)
          if (durationRef.current > 0 && currentSeconds >= durationRef.current - 1.2) {
            handleCompletionAndRedirect();
          }
        } else {
          persist(p, false, currentSeconds);
        }
      });

      player.on("ended", () => {
        setIsPlaying(false);
        setIsBuffering(false);
        setShowControls(true);

        // Strict ended check: user cannot just scrub or skip to the end
        const genuineRatio =
          durationRef.current > 0 ? watchedRef.current / durationRef.current : progress;
        if (genuineRatio >= completionThreshold) {
          handleCompletionAndRedirect();
        } else {
          // Re-snap to legitimate watched point if skipped
          if (playerRef.current) {
            playerRef.current.setCurrentTime(watchedRef.current).catch(() => {});
          }
        }
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
          setIsBuffering(false);
          setHasStarted(true);
          triggerControlsAutoHide();
        } catch {
          try {
            await playerRef.current.setMuted(true);
            await playerRef.current.play();
            setIsPlaying(true);
            setIsMuted(true);
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

  const toggleMute = async () => {
    handleUserActivity();
    if (!playerRef.current) return;
    try {
      const muted = await playerRef.current.getMuted();
      if (muted) {
        await playerRef.current.setMuted(false);
        await playerRef.current.setVolume(1);
        setIsMuted(false);
      } else {
        await playerRef.current.setMuted(true);
        setIsMuted(true);
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

        {/* 16:9 Cinema Player Card with Lightweight Hardware-Accelerated Glow */}
        <div className="relative group/player mx-auto w-full">
          {/* Lightweight Static Glow (Zero Repaint Lag) */}
          <div className="pointer-events-none absolute -inset-1 rounded-[24px] sm:rounded-[32px] bg-[#00F076]/10 opacity-70 transition-opacity duration-300" />

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
                : "rounded-[22px] sm:rounded-[28px] border border-[#00F076]/30 bg-[#030906] p-1.5 sm:p-3 shadow-[0_15px_40px_-10px_rgba(0,0,0,0.9),0_0_30px_rgba(0,240,118,0.18)]"
            }`}
          >
            {/* Quick Exit Fullscreen Button on Top Right in Fullscreen Mode */}
            {isFullscreen && (
              <button
                type="button"
                onClick={toggleFullscreen}
                className="absolute top-3 right-3 sm:top-5 sm:right-5 z-50 flex items-center gap-1.5 rounded-full bg-black/85 hover:bg-black text-white px-3.5 py-2 text-xs font-semibold backdrop-blur-md border border-white/25 shadow-2xl active:scale-95 cursor-pointer"
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
              {/* Instant Lightweight Video Poster / Skeleton Before Stream Starts */}
              {!hasStarted && (
                <div className="absolute inset-0 z-15 flex flex-col items-center justify-center bg-[#020503] p-4 text-center">
                  <div className="relative mb-3">
                    <div className="absolute -inset-2 rounded-full bg-[#00F076]/20 blur-sm animate-pulse" />
                    <div className="relative grid h-16 w-16 sm:h-20 sm:w-20 place-items-center rounded-full bg-gradient-to-r from-[#00F076] to-[#00D668] text-black shadow-[0_0_30px_rgba(0,240,118,0.7)]">
                      <Play className="h-8 w-8 sm:h-10 sm:w-10 fill-black translate-x-0.5" />
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm font-display font-bold text-white tracking-wide">
                    {isBuffering ? "Loading high-speed stream..." : "Free Masterclass Video"}
                  </p>
                  <span className="mt-1 text-[11px] text-[#00F076] font-medium flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#00F076] animate-ping" />
                    Sub-second adaptive stream ready
                  </span>
                </div>
              )}

              {/* Vimeo Iframe with Fast Autoplay & Low-Bandwidth Adaptive Stream */}
              <iframe
                ref={iframeRef}
                src={`https://player.vimeo.com/video/${vimeoId}?autoplay=1&muted=1&playsinline=1&controls=0&badge=0&autopause=0&player_id=0&app_id=58479&title=0&byline=0&portrait=0&sidedock=0&dnt=1&quality=auto`}
                className="absolute inset-0 h-full w-full border-0 pointer-events-none"
                loading="eager"
                allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope"
                title="PenduGPT AI Website Training Video"
              />

              {/* Clickable Backdrop to Toggle Play/Pause & Unmute on Tap */}
              <button
                onClick={() => {
                  if (isMuted) unmuteAudio();
                  togglePlay();
                }}
                className="absolute inset-0 h-full w-full cursor-pointer z-10 bg-transparent"
                aria-label={isPlaying ? "Pause video" : "Play video"}
              />

              {/* Floating "Tap for Audio / Sound" Pill When Video Is Playing Muted */}
              {isPlaying && isMuted && (
                <div className="pointer-events-none absolute top-3 sm:top-4 left-1/2 -translate-x-1/2 z-30 animate-reveal">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      unmuteAudio();
                    }}
                    className="pointer-events-auto flex items-center gap-2 rounded-full bg-black/90 border border-[#00F076] text-white px-3.5 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold shadow-[0_0_25px_rgba(0,240,118,0.6)] animate-sound-pulse backdrop-blur-md cursor-pointer hover:bg-black active:scale-95 transition-transform"
                  >
                    <VolumeX className="h-4 w-4 text-[#00F076]" />
                    <span>🔊 Tap for Audio / Sound</span>
                  </button>
                </div>
              )}

              {/* Buffering Spinner Overlay */}
              {isBuffering && (
                <div className="pointer-events-none absolute inset-0 z-25 flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-opacity">
                  <div className="flex items-center gap-2.5 rounded-full bg-black/90 border border-[#00F076]/40 px-4 py-2 text-xs font-semibold text-[#00F076] shadow-xl">
                    <Loader2 className="h-4 w-4 animate-spin text-[#00F076]" />
                    <span>Optimizing stream...</span>
                  </div>
                </div>
              )}

              {/* Floating Redirecting Banner when Video Finishes Completely */}
              {isRedirecting && (
                <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-6 text-center animate-reveal">
                  <div className="grid h-16 w-16 place-items-center rounded-full bg-[#072416] border-2 border-[#00F076] text-[#00F076] shadow-[0_0_35px_rgba(0,240,118,0.6)] mb-4 animate-pulse">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h3 className="font-display font-extrabold italic text-xl sm:text-2xl text-white">
                    Training Video Completed!
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm text-white/80 max-w-sm">
                    Redirecting you to the Class Pricing Details section...
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-xs text-[#00F076] font-mono font-bold">
                    <Loader2 className="h-4 w-4 animate-spin text-[#00F076]" />
                    <span>Opening Class Pricing Tunnel...</span>
                  </div>
                </div>
              )}

              {/* Center Big Play Button when Paused */}
              {!isPlaying && hasStarted && (
                <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-black/40 backdrop-blur-xs transition-opacity animate-reveal">
                  <button
                    type="button"
                    onClick={() => {
                      if (isMuted) unmuteAudio();
                      togglePlay();
                    }}
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
                {/* Top Progression Bar of the Video Overlay */}
                <div className="w-full h-2 sm:h-2.5 rounded-full bg-white/20 overflow-hidden mb-3 shadow-inner">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#009944] via-[#00f076] to-[#7bffb8] shadow-[0_0_12px_rgba(0,240,118,0.7)] transition-all duration-300"
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
                      className="flex items-center gap-1.5 sm:gap-2 rounded-full bg-black/80 hover:bg-black text-white px-3.5 py-2 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold backdrop-blur-md border border-white/20 hover:border-[#00F076]/60 shadow-md transition-all active:scale-95 cursor-pointer"
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
                      className="flex items-center gap-1 sm:gap-1.5 rounded-full bg-black/80 hover:bg-black text-white px-3 py-2 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-semibold backdrop-blur-md border border-white/20 hover:border-[#00F076]/60 shadow-md transition-all active:scale-95 cursor-pointer"
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
                      className="flex items-center gap-1 sm:gap-1.5 rounded-full bg-black/80 hover:bg-black text-white px-3 py-2 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-semibold backdrop-blur-md border border-white/20 hover:border-[#00F076]/60 shadow-md transition-all active:scale-95 cursor-pointer"
                      title={isMuted ? "Unmute Sound" : "Mute Sound"}
                      aria-label={isMuted ? "Unmute Sound" : "Mute Sound"}
                    >
                      {isMuted ? (
                        <>
                          <VolumeX className="h-4 w-4 text-[#00F076]" />
                          <span className="hidden xs:inline">Unmute</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="h-4 w-4 text-[#00F076]" />
                          <span className="hidden xs:inline">Mute</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Right: Fullscreen Button */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleFullscreen}
                      className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-full bg-black/80 hover:bg-black text-white backdrop-blur-md border border-white/20 hover:border-[#00F076]/60 shadow-md transition-all active:scale-95 cursor-pointer"
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

        {/* Video Progress Bar & Next Step Unlock Gate (Redesigned with Ultra-Premium SaaS Aesthetics) */}
        <div className="mt-6 rounded-[24px] sm:rounded-[28px] border border-[#00F076]/25 bg-gradient-to-b from-[#06180e]/95 via-[#04120a]/95 to-[#020704]/95 p-5 sm:p-7 shadow-[0_15px_35px_-10px_rgba(0,0,0,0.85),0_0_30px_rgba(0,240,118,0.12)]">
          {/* Progress Tracker Header */}
          <div className="mb-4 sm:mb-5">
            <div className="flex items-center justify-between text-xs sm:text-sm font-semibold mb-2.5">
              <div className="flex items-center gap-2 text-white">
                <div className="grid h-6 w-6 place-items-center rounded-lg bg-[#072416] border border-[#00F076]/30 text-[#00F076]">
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <span className="font-display font-bold tracking-tight">Training Progress</span>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold font-mono tracking-wide ${
                  isCompleted
                    ? "bg-[#00F076]/20 border border-[#00F076]/50 text-[#00F076] shadow-[0_0_15px_rgba(0,240,118,0.25)]"
                    : "bg-[#072416] border border-[#00F076]/30 text-[#00F076]"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${isCompleted ? "bg-[#00F076]" : "bg-[#00F076] animate-pulse"}`}
                />
                {pct}% Complete
              </span>
            </div>

            {/* Glowing Progress Bar Track */}
            <div
              className="h-3 sm:h-3.5 w-full overflow-hidden rounded-full bg-[#0a1f14] p-0.5 border border-white/5"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#00A852] via-[#00F076] to-[#7BFFB8] shadow-[0_0_18px_rgba(0,240,118,0.85)] transition-all duration-300"
                style={{ width: `${Math.max(2, pct)}%` }}
              />
            </div>
          </div>

          {/* Status Message and Next Step Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4 border-t border-white/10">
            {isCompleted ? (
              <>
                <div className="flex items-center gap-3.5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#072416] text-[#00F076] border border-[#00F076]/50 shadow-[0_0_20px_rgba(0,240,118,0.4)]">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm sm:text-base font-display font-extrabold text-white leading-tight">
                      {isRedirecting ? "Training completed! Redirecting..." : "Training completed!"}
                    </p>
                    <p className="text-xs sm:text-sm text-[#00F076] font-semibold mt-0.5">
                      Your Masterclass class pricing & enrollment options are unlocked!
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleCompletionAndRedirect(true)}
                  disabled={isRedirecting}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-[#00F076] via-[#00f77b] to-[#00D668] px-8 sm:px-9 py-3.5 sm:py-4 text-xs sm:text-sm font-display font-black italic uppercase tracking-wider text-black shadow-[0_0_30px_rgba(0,240,118,0.7)] transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(0,240,118,0.9)] active:scale-[0.98] cursor-pointer disabled:opacity-80"
                >
                  {isRedirecting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-black" />
                      <span>REDIRECTING TO CLASS PRICING...</span>
                    </>
                  ) : (
                    <>
                      <span>ACCESS CLASS PRICING DETAILS</span>
                      <ArrowRight className="h-4 w-4 stroke-[3]" />
                    </>
                  )}
                </button>
              </>
            ) : (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#081b11] text-[#00F076] border border-white/10 shadow-inner">
                    <Lock className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-display font-bold text-white">Enrollment Options Locked</p>
                    <p className="text-xs text-[#94A3B8]">
                      Watch 95% of the free training video to unlock the next step.
                    </p>
                  </div>
                </div>
                <div className="self-end sm:self-auto shrink-0">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-3.5 py-1.5 text-[11px] font-semibold text-[#A1B2A8]">
                    <span>🔒</span>
                    <span>{Math.max(0, 95 - pct)}% Remaining</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SaaS Trust Highlights Section (Redesigned with Premium Glass Cards) */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-3.5 rounded-2xl border border-[#00F076]/15 bg-gradient-to-b from-[#071d12]/90 to-[#030d08]/90 p-4 sm:p-5 shadow-lg transition-all hover:border-[#00F076]/40 hover:-translate-y-0.5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#072416] border border-[#00F076]/40 text-[#00F076] shadow-[0_0_15px_rgba(0,240,118,0.25)]">
              <Zap className="h-5 w-5 stroke-[2.2]" />
            </div>
            <div>
              <h4 className="font-display font-bold text-sm sm:text-base text-white">Zero Coding Needed</h4>
              <p className="text-xs text-[#94A3B8] mt-0.5">100% prompt-to-website AI workflow</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-2xl border border-[#00F076]/15 bg-gradient-to-b from-[#071d12]/90 to-[#030d08]/90 p-4 sm:p-5 shadow-lg transition-all hover:border-[#00F076]/40 hover:-translate-y-0.5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#072416] border border-[#00F076]/40 text-[#00F076] shadow-[0_0_15px_rgba(0,240,118,0.25)]">
              <ShieldCheck className="h-5 w-5 stroke-[2.2]" />
            </div>
            <div>
              <h4 className="font-display font-bold text-sm sm:text-base text-white">Proven Blueprint</h4>
              <p className="text-xs text-[#94A3B8] mt-0.5">Actionable freelance & client systems</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-2xl border border-[#00F076]/15 bg-gradient-to-b from-[#071d12]/90 to-[#030d08]/90 p-4 sm:p-5 shadow-lg transition-all hover:border-[#00F076]/40 hover:-translate-y-0.5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#072416] border border-[#00F076]/40 text-[#00F076] shadow-[0_0_15px_rgba(0,240,118,0.25)]">
              <Sparkles className="h-5 w-5 stroke-[2.2]" />
            </div>
            <div>
              <h4 className="font-display font-bold text-sm sm:text-base text-white">Lifetime Value</h4>
              <p className="text-xs text-[#94A3B8] mt-0.5">High-ticket monetization strategies</p>
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

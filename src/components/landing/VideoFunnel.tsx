import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Lock, Play, RotateCcw, Video } from "lucide-react";
import { siteConfig } from "@/config/site";
import { track } from "@/lib/analytics";
import { Section, SectionHeader } from "./Section";

type Status = "idle" | "loading" | "playing" | "paused" | "error" | "complete";

export function VideoFunnel({ unlocked, onUnlock }: { unlocked: boolean; onUnlock: () => void }) {
  const { src, poster, completionThreshold, storageKey } = siteConfig.video;
  const ref = useRef<HTMLVideoElement>(null);
  const watchedRef = useRef(0);
  const lastTimeRef = useRef(0);
  const milestones = useRef(new Set<number>());
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved && typeof saved.watched === "number") {
        watchedRef.current = saved.watched;
        const p = saved.progress ?? 0;
        setProgress(p);
        if (saved.complete || p >= completionThreshold) {
          setStatus("complete");
          onUnlock();
        }
      }
    } catch {
      /* ignore */
    }
  }, [storageKey, completionThreshold, onUnlock]);

  const persist = (p: number, complete: boolean) => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ watched: watchedRef.current, progress: p, complete }),
      );
    } catch {
      /* ignore */
    }
  };

  const complete = () => {
    setStatus("complete");
    setProgress(1);
    persist(1, true);
    track("video_complete");
    onUnlock();
  };

  const onTimeUpdate = () => {
    const v = ref.current;
    if (!v || !v.duration) return;
    const delta = v.currentTime - lastTimeRef.current;
    if (delta > 0 && delta < 1.5 && v.currentTime > watchedRef.current) {
      watchedRef.current = v.currentTime;
    }
    lastTimeRef.current = v.currentTime;
    const p = Math.min(watchedRef.current / v.duration, 1);
    setProgress(p);
    for (const m of [25, 50, 75]) {
      if (p * 100 >= m && !milestones.current.has(m)) {
        milestones.current.add(m);
        track("video_progress", { percent: m });
      }
    }
    if (p >= completionThreshold && status !== "complete") complete();
    else persist(p, false);
  };

  const start = () => {
    const v = ref.current;
    if (!v) return;
    setStatus("loading");
    v.currentTime = Math.min(watchedRef.current, v.duration || 0);
    lastTimeRef.current = v.currentTime;
    v.play().catch(() => setStatus("error"));
    track("video_start");
  };

  const pct = Math.round(progress * 100);

  return (
    <Section id="training" className="bg-surface/50 border-y border-border" glow>
      <SectionHeader
        eyebrow="FREE TRAINING"
        title={
          <>
            See How to Build Websites <span className="text-gradient">with AI.</span>
          </>
        }
        sub="Watch the free training to understand the complete workflow before choosing your learning path."
      />

      <div className="relative mx-auto mt-12 max-w-4xl">
        {/* Responsive 16:9 Video Box */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card p-2 sm:p-3 shadow-glow">
          <div className="relative aspect-video overflow-hidden rounded-xl bg-background">
            {src ? (
              <>
                <video
                  ref={ref}
                  src={src}
                  poster={poster || undefined}
                  className="h-full w-full object-cover"
                  controls={status !== "idle"}
                  playsInline
                  preload="metadata"
                  onWaiting={() => setStatus("loading")}
                  onPlaying={() => setStatus((s) => (s === "complete" ? s : "playing"))}
                  onPause={() => setStatus((s) => (s === "complete" ? s : "paused"))}
                  onTimeUpdate={onTimeUpdate}
                  onEnded={() => progress >= completionThreshold - 0.05 && complete()}
                  onError={() => setStatus("error")}
                />

                {status === "idle" && (
                  <button
                    onClick={start}
                    className="group absolute inset-0 grid place-items-center bg-background/50 backdrop-blur-xs transition-opacity hover:bg-background/40"
                    aria-label="Play free training"
                  >
                    <span className="grid h-16 w-16 place-items-center rounded-full bg-gradient-primary shadow-glow transition-transform group-hover:scale-105">
                      <Play className="ml-1 h-7 w-7 fill-current text-white" />
                    </span>
                  </button>
                )}

                {status === "loading" && (
                  <div className="pointer-events-none absolute inset-0 grid place-items-center bg-background/70">
                    <Loader2 className="h-9 w-9 animate-spin text-highlight" />
                  </div>
                )}

                {status === "error" && (
                  <div className="absolute inset-0 grid place-items-center bg-background/95 p-6 text-center">
                    <div>
                      <AlertTriangle className="mx-auto h-7 w-7 text-destructive" />
                      <p className="mt-3 text-sm font-semibold text-white">
                        The video couldn't load.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Check your connection and try again.
                      </p>
                      <button
                        onClick={() => {
                          ref.current?.load();
                          setStatus("idle");
                        }}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-xs font-medium"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Retry
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Clean Placeholder when video is being prepared */
              <div className="bg-grid absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-2xl border border-border bg-card text-highlight shadow-sm">
                  <Video className="h-6 w-6" />
                </span>
                <h3 className="mt-4 font-display text-xl font-bold text-white">
                  Free Training Video
                </h3>
                <p className="mt-1.5 max-w-md text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  The step-by-step masterclass training is in production. You can explore the
                  learning curriculum and course options below.
                </p>
                {!unlocked && (
                  <button
                    onClick={() => {
                      onUnlock();
                      track("video_placeholder_skip");
                    }}
                    className="mt-5 rounded-full bg-gradient-primary px-5 py-2.5 text-xs font-semibold text-white shadow-glow transition-all hover:opacity-95"
                  >
                    View Course Options
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Progress & Unlock Strip */}
        <div className="mt-4 rounded-xl border border-border bg-card/70 p-4">
          {src && (
            <div className="mb-3">
              <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                <span>Training Progress</span>
                <span className="font-mono text-foreground font-semibold">{pct}%</span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-gradient-primary transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {unlocked ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-2 font-medium text-success">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                You're ready to choose your learning path.
              </span>
              <a
                href="#pricing"
                className="font-semibold text-highlight hover:underline underline-offset-4"
              >
                See Course Options ↓
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5 text-highlight shrink-0" />
              <span>Complete the free training to unlock your learning options.</span>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

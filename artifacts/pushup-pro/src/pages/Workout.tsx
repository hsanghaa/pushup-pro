import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppLayout } from "@/components/layout/AppLayout";
import { useRequireAuth } from "@/lib/auth";
import {
  useCreateWorkout,
  useGetVariations,
  getGetUserStatsQueryKey,
  getGetUserWorkoutsQueryKey,
  getGetCoachMessageQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, AlertCircle, Play, StopCircle } from "lucide-react";

type WorkoutPhase = "setup" | "countdown" | "active" | "summary";

const COACH_MESSAGES = [
  "You've got this. Stay tight.",
  "Keep going. Every rep counts.",
  "Strong form. Keep pushing.",
  "Breathe. Down and up. You're crushing it.",
  "Don't stop now. Push through.",
  "Looking good. Stay focused.",
  "That's real strength. Keep moving.",
];

export default function Workout() {
  const userId = useRequireAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const createWorkout = useCreateWorkout();

  const [phase, setPhase] = useState<WorkoutPhase>("setup");
  const [countdown, setCountdown] = useState(3);
  const [reps, setReps] = useState(0);
  const [sets, setSets] = useState(1);
  const [variation, setVariation] = useState("Standard Push-Up");
  const [manualReps, setManualReps] = useState("");
  const [saved, setSaved] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<"checking" | "ready" | "error">("checking");
  const [coachMsg, setCoachMsg] = useState(COACH_MESSAGES[0]);

  // Keep video always in DOM — only one element, always mounted
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const coachIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rep detection state in refs (no re-renders needed)
  const lastLumRef = useRef<number | null>(null);
  const repStateRef = useRef<"up" | "down">("up");
  const repsRef = useRef(0);
  const phaseRef = useRef<WorkoutPhase>("setup");

  const { data: variations } = useGetVariations();

  // Keep phaseRef in sync
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Keep repsRef in sync with reps state
  useEffect(() => {
    repsRef.current = reps;
  }, [reps]);

  // Start camera on mount; never stop the stream until unmount or user explicitly stops
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraStatus("ready");
      } catch {
        if (!cancelled) setCameraStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      clearAllIntervals();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // If video element re-attaches (shouldn't happen but safety net)
  useEffect(() => {
    if (videoRef.current && streamRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  });

  const clearAllIntervals = () => {
    if (detectionIntervalRef.current) { clearInterval(detectionIntervalRef.current); detectionIntervalRef.current = null; }
    if (coachIntervalRef.current) { clearInterval(coachIntervalRef.current); coachIntervalRef.current = null; }
    if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; }
  };

  const analyzeFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Sample a 16×16 region from the lower center of the frame (chest/body area during push-ups)
    const sw = video.videoWidth;
    const sh = video.videoHeight;
    if (!sw || !sh) return;

    const regionX = sw * 0.25;
    const regionY = sh * 0.35;
    const regionW = sw * 0.5;
    const regionH = sh * 0.4;

    canvas.width = 16;
    canvas.height = 16;
    ctx.drawImage(video, regionX, regionY, regionW, regionH, 0, 0, 16, 16);

    const imageData = ctx.getImageData(0, 0, 16, 16);
    const data = imageData.data;
    let lum = 0;
    for (let i = 0; i < data.length; i += 4) {
      lum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    lum /= 16 * 16;

    if (lastLumRef.current !== null) {
      const diff = Math.abs(lum - lastLumRef.current);

      // Threshold: 5 means meaningful body movement in the frame
      if (diff > 5) {
        if (repStateRef.current === "up") {
          // Going down
          repStateRef.current = "down";
        } else {
          // Coming back up — count a rep
          repStateRef.current = "up";
          setReps((r) => r + 1);
        }
      }
    }
    lastLumRef.current = lum;
  }, []);

  const startCountdown = () => {
    setPhase("countdown");
    setCountdown(3);
    let count = 3;
    countdownTimerRef.current = setInterval(() => {
      count--;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(countdownTimerRef.current!);
        countdownTimerRef.current = null;
        startWorkout();
      }
    }, 1000);
  };

  const startWorkout = () => {
    setPhase("active");
    setReps(0);
    repsRef.current = 0;
    repStateRef.current = "up";
    lastLumRef.current = null;

    // Sample frames every 120ms for smooth detection
    detectionIntervalRef.current = setInterval(analyzeFrame, 120);

    // Rotate coach messages every 8 seconds
    let msgIdx = 0;
    coachIntervalRef.current = setInterval(() => {
      msgIdx = (msgIdx + 1) % COACH_MESSAGES.length;
      setCoachMsg(COACH_MESSAGES[msgIdx]);
    }, 8000);
  };

  const endWorkout = () => {
    clearAllIntervals();
    setManualReps(repsRef.current.toString());
    setPhase("summary");
  };

  const saveWorkout = () => {
    const finalReps = parseInt(manualReps, 10);
    if (!userId || isNaN(finalReps)) return;

    createWorkout.mutate(
      {
        data: {
          userId,
          totalReps: finalReps,
          sets,
          variation,
          usedCamera: cameraStatus === "ready",
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetUserStatsQueryKey(userId) });
          queryClient.invalidateQueries({ queryKey: getGetUserWorkoutsQueryKey(userId) });
          queryClient.invalidateQueries({ queryKey: getGetCoachMessageQueryKey(userId) });
          setSaved(true);
          setTimeout(() => setLocation("/dashboard"), 1500);
        },
      }
    );
  };

  if (!userId) return null;

  return (
    <AppLayout showNav={false}>
      {/* 
        The video element must stay mounted in the DOM at all times.
        We overlay different UIs on top of it using absolute positioning.
      */}
      <div className="min-h-[100dvh] bg-black flex flex-col relative overflow-hidden">
        {/* Always-mounted video */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: phase === "setup" ? 1 : phase === "active" ? 0.35 : 0,
            transition: "opacity 0.5s ease",
          }}
          muted
          playsInline
          autoPlay
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between p-4 border-b border-white/10">
          <button
            onClick={() => {
              clearAllIntervals();
              if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
                streamRef.current = null;
              }
              setLocation("/dashboard");
            }}
            className="text-white/60 hover:text-white text-sm font-mono uppercase tracking-wider"
          >
            Cancel
          </button>
          <span className="text-xs font-mono uppercase tracking-wider text-white/40">Workout</span>
          <div className="w-16" />
        </div>

        {/* ── SETUP PHASE ── */}
        {phase === "setup" && (
          <div className="relative z-10 flex-1 flex flex-col p-4 gap-4">
            {/* Camera status badge */}
            <div className="flex-1" />
            <div className="bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl p-3 flex items-center gap-2">
              {cameraStatus === "checking" && (
                <>
                  <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shrink-0" />
                  <span className="text-sm font-mono text-yellow-300">Checking camera access...</span>
                </>
              )}
              {cameraStatus === "ready" && (
                <>
                  <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm font-mono text-primary">Camera ready. Get into push-up position.</span>
                </>
              )}
              {cameraStatus === "error" && (
                <>
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="text-sm font-mono text-red-300">No camera. Count reps manually after session.</span>
                </>
              )}
            </div>

            <div className="space-y-3 bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl p-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-white/50 block mb-1">
                  Variation
                </label>
                <select
                  value={variation}
                  onChange={(e) => setVariation(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg bg-white/10 border border-white/20 text-white text-sm font-medium focus:outline-none focus:border-primary"
                >
                  {variations?.map((v) => (
                    <option key={v.id} value={v.name} className="bg-neutral-900">
                      {v.name}
                    </option>
                  ))}
                  {!variations?.length && (
                    <option value="Standard Push-Up" className="bg-neutral-900">
                      Standard Push-Up
                    </option>
                  )}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-white/50 block mb-1">
                  Sets planned
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setSets(n)}
                      className={`flex-1 h-10 rounded-lg text-sm font-bold border transition-colors ${
                        sets === n
                          ? "bg-primary text-black border-primary"
                          : "bg-white/10 border-white/20 text-white/70 hover:border-primary/50"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button
              onClick={startCountdown}
              size="lg"
              className="w-full h-14 text-lg font-display uppercase tracking-widest bg-primary text-black hover:bg-primary/90"
            >
              <Play className="w-5 h-5 mr-2" /> Start Session
            </Button>
          </div>
        )}

        {/* ── COUNTDOWN PHASE ── */}
        {phase === "countdown" && (
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-4">
            <p className="text-white/50 font-mono text-sm uppercase tracking-widest">Get Ready</p>
            <div className="text-[160px] font-display font-black text-primary leading-none tabular-nums">
              {countdown}
            </div>
            <p className="text-white/60 font-mono text-sm">Position yourself in push-up position</p>
          </div>
        )}

        {/* ── ACTIVE PHASE ── */}
        {phase === "active" && (
          <div className="relative z-10 flex-1 flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
              <p className="text-white/50 font-mono text-xs uppercase tracking-widest">Reps</p>
              <div
                key={reps}
                className="text-[120px] font-display font-black text-primary leading-none tabular-nums"
                style={{ textShadow: "0 0 40px rgba(212,255,0,0.4)" }}
              >
                {reps}
              </div>
              <p className="text-sm text-white/50 font-mono px-8 text-center italic mt-2">
                "{coachMsg}"
              </p>
              <button
                onClick={() => setReps((r) => r + 1)}
                className="mt-4 px-6 py-2.5 rounded-full border border-primary/40 text-primary text-xs font-mono uppercase tracking-wider hover:bg-primary/10 transition-colors"
              >
                + Tap to count manually
              </button>
            </div>
            <div className="p-4">
              <Button
                onClick={endWorkout}
                size="lg"
                variant="destructive"
                className="w-full h-14 text-lg font-display uppercase tracking-widest"
              >
                <StopCircle className="w-5 h-5 mr-2" /> End Workout
              </Button>
            </div>
          </div>
        )}

        {/* ── SUMMARY PHASE ── */}
        {phase === "summary" && (
          <div className="relative z-10 flex-1 flex flex-col p-4 gap-5 bg-background">
            <div className="text-center pt-6">
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
                Session Complete
              </p>
              <div
                className="text-8xl font-display font-black text-primary leading-none mb-1"
                style={{ textShadow: "0 0 40px rgba(212,255,0,0.25)" }}
              >
                {manualReps}
              </div>
              <p className="text-muted-foreground font-mono text-sm">push-ups</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Sets</p>
                <p className="text-2xl font-display font-bold">{sets}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Avg / set</p>
                <p className="text-2xl font-display font-bold">
                  {sets > 0 ? Math.round((parseInt(manualReps) || 0) / sets) : 0}
                </p>
              </div>
            </div>

            <div className="bg-card border border-primary/20 rounded-xl p-4 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                Adjust rep count
              </label>
              <Input
                type="number"
                value={manualReps}
                onChange={(e) => setManualReps(e.target.value)}
                className="h-12 text-xl font-display text-center bg-background border-primary/30 focus-visible:border-primary"
              />
              <p className="text-xs text-muted-foreground font-mono">
                Camera motion detection may miss reps. Adjust here.
              </p>
            </div>

            {saved ? (
              <div className="flex items-center justify-center gap-2 text-primary py-4">
                <CheckCircle className="w-5 h-5" />
                <span className="font-mono font-bold">Saved! Redirecting...</span>
              </div>
            ) : (
              <Button
                onClick={saveWorkout}
                disabled={createWorkout.isPending}
                size="lg"
                className="w-full h-14 text-lg font-display uppercase tracking-widest bg-primary text-black mt-auto"
              >
                {createWorkout.isPending ? "Saving..." : "Save Workout"}
              </Button>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

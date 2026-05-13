import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppLayout } from "@/components/layout/AppLayout";
import { useRequireAuth } from "@/lib/auth";
import { useCreateWorkout, useGetVariations, getGetUserStatsQueryKey, getGetUserWorkoutsQueryKey, getGetCoachMessageQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCircle, AlertCircle, Play, StopCircle } from "lucide-react";

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
  const [coachMsgIndex, setCoachMsgIndex] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const coachIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastLumRef = useRef<number | null>(null);
  const repStateRef = useRef<"up" | "down">("up");

  const { data: variations } = useGetVariations();

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (coachIntervalRef.current) clearInterval(coachIntervalRef.current);
    };
  }, [stopCamera]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setCameraStatus("ready");
      } catch {
        setCameraStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const analyzeFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 32;
    canvas.height = 32;
    ctx.drawImage(video, 0, 0, 32, 32);
    const imageData = ctx.getImageData(0, 0, 32, 32);
    const data = imageData.data;
    let lum = 0;
    for (let i = 0; i < data.length; i += 4) {
      lum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    lum = lum / (32 * 32);

    if (lastLumRef.current !== null) {
      const diff = Math.abs(lum - lastLumRef.current);
      if (diff > 8) {
        if (repStateRef.current === "up") {
          repStateRef.current = "down";
        } else {
          repStateRef.current = "up";
          setReps(r => r + 1);
        }
      }
    }
    lastLumRef.current = lum;
  }, []);

  const startCountdown = () => {
    setPhase("countdown");
    let count = 3;
    const timer = setInterval(() => {
      count--;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(timer);
        startWorkout();
      }
    }, 1000);
  };

  const startWorkout = () => {
    setPhase("active");
    setReps(0);
    repStateRef.current = "up";
    lastLumRef.current = null;

    intervalRef.current = setInterval(analyzeFrame, 150);

    let msgIdx = 0;
    coachIntervalRef.current = setInterval(() => {
      msgIdx = (msgIdx + 1) % COACH_MESSAGES.length;
      setCoachMsg(COACH_MESSAGES[msgIdx]);
      setCoachMsgIndex(msgIdx);
    }, 8000);
  };

  const endWorkout = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (coachIntervalRef.current) clearInterval(coachIntervalRef.current);
    stopCamera();
    setManualReps(reps.toString());
    setPhase("summary");
  };

  const saveWorkout = () => {
    const finalReps = parseInt(manualReps, 10) || reps;
    if (!userId) return;

    createWorkout.mutate({
      data: {
        userId,
        totalReps: finalReps,
        sets,
        variation,
        usedCamera: true,
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetUserStatsQueryKey(userId) });
        queryClient.invalidateQueries({ queryKey: getGetUserWorkoutsQueryKey(userId) });
        queryClient.invalidateQueries({ queryKey: getGetCoachMessageQueryKey(userId) });
        setSaved(true);
        setTimeout(() => setLocation("/dashboard"), 1500);
      }
    });
  };

  if (!userId) return null;

  return (
    <AppLayout showNav={false}>
      <div className="min-h-[100dvh] bg-background flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <button onClick={() => { stopCamera(); setLocation("/dashboard"); }} className="text-muted-foreground hover:text-foreground text-sm font-mono uppercase tracking-wider">
            Cancel
          </button>
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Workout</span>
          <div className="w-16" />
        </div>

        {/* Setup Phase */}
        {phase === "setup" && (
          <div className="flex-1 flex flex-col p-4 gap-4">
            <div className="relative rounded-xl overflow-hidden bg-black aspect-[3/4]">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                {cameraStatus === "checking" && (
                  <div className="flex items-center gap-2 text-yellow-400">
                    <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                    <span className="text-sm font-mono">Checking camera...</span>
                  </div>
                )}
                {cameraStatus === "ready" && (
                  <div className="flex items-center gap-2 text-primary">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-mono">Camera ready. Position yourself in frame.</span>
                  </div>
                )}
                {cameraStatus === "error" && (
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-mono">Camera unavailable. You can still track manually.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Variation</label>
                <select
                  value={variation}
                  onChange={e => setVariation(e.target.value)}
                  className="w-full h-12 px-3 rounded-lg bg-card border border-border text-foreground text-sm font-medium focus:outline-none focus:border-primary"
                >
                  {variations?.map(v => (
                    <option key={v.id} value={v.name}>{v.name}</option>
                  ))}
                  {!variations?.length && <option value="Standard Push-Up">Standard Push-Up</option>}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1">Sets planned</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => setSets(n)}
                      className={`flex-1 h-10 rounded-lg text-sm font-bold border transition-colors ${sets === n ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:border-primary/50"}`}
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
              className="w-full h-14 text-lg font-display uppercase tracking-widest bg-primary text-primary-foreground mt-auto"
            >
              <Play className="w-5 h-5 mr-2" /> Start Session
            </Button>
          </div>
        )}

        {/* Countdown Phase */}
        {phase === "countdown" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 bg-black">
            <p className="text-muted-foreground font-mono text-sm uppercase tracking-widest">Get Ready</p>
            <div className="text-[160px] font-display font-black text-primary leading-none tabular-nums animate-pulse">
              {countdown}
            </div>
            <p className="text-foreground font-mono text-sm">Position yourself in push-up position</p>
          </div>
        )}

        {/* Active Phase */}
        {phase === "active" && (
          <div className="flex-1 flex flex-col">
            <div className="relative flex-1 bg-black">
              <video ref={videoRef} className="w-full h-full object-cover opacity-40" muted playsInline />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest">Reps</p>
                <div className="text-[120px] font-display font-black text-primary leading-none tabular-nums transition-all">
                  {reps}
                </div>
                <p className="text-sm text-foreground/70 font-mono px-8 text-center italic">
                  "{coachMsg}"
                </p>
                <button
                  onClick={() => setReps(r => r + 1)}
                  className="mt-4 px-6 py-2 rounded-full border border-primary/40 text-primary text-xs font-mono uppercase tracking-wider hover:bg-primary/10 transition-colors"
                >
                  + Manual Count
                </button>
              </div>
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

        {/* Summary Phase */}
        {phase === "summary" && (
          <div className="flex-1 flex flex-col p-4 gap-6">
            <div className="text-center pt-6">
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">Session Complete</p>
              <div className="text-8xl font-display font-black text-primary leading-none mb-1">{manualReps || reps}</div>
              <p className="text-muted-foreground font-mono text-sm">push-ups</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Sets</p>
                <p className="text-2xl font-display font-bold">{sets}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Avg / set</p>
                <p className="text-2xl font-display font-bold">{sets > 0 ? Math.round((parseInt(manualReps) || reps) / sets) : 0}</p>
              </div>
            </div>

            <div className="bg-card border border-primary/20 rounded-xl p-4 space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                Adjust rep count
              </label>
              <Input
                type="number"
                value={manualReps}
                onChange={e => setManualReps(e.target.value)}
                className="h-12 text-xl font-display text-center bg-background border-primary/30 focus-visible:border-primary"
              />
              <p className="text-xs text-muted-foreground font-mono">Camera may have missed some reps. Adjust here.</p>
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
                className="w-full h-14 text-lg font-display uppercase tracking-widest bg-primary text-primary-foreground mt-auto"
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

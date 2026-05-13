import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppLayout } from "@/components/layout/AppLayout";
import { useRequireAuth } from "@/lib/auth";
import {
  useCreateWorkout,
  useGetVariations,
  useGetUserRivals,
  getGetUserStatsQueryKey,
  getGetUserWorkoutsQueryKey,
  getGetCoachMessageQueryKey,
  getGetUserRivalsQueryKey,
} from "@workspace/api-client-react";
import { speakWorkoutTaunt } from "@/lib/rivalVoice";
import { loadPoseLandmarker, type PoseLandmarker } from "@/lib/poseLandmarker";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, AlertCircle, Play, StopCircle, Loader2, Scan } from "lucide-react";

type WorkoutPhase = "setup" | "countdown" | "active" | "summary";

type FormGrade = "excellent" | "good" | "ok" | "shallow" | "too_fast" | "—";

interface RepQuality {
  amplitude: number; // luminance swing (depth proxy)
  durationMs: number; // how long the rep took
  score: number; // 0–100
  grade: FormGrade;
}

interface FormState {
  score: number; // rolling avg 0–100
  grade: FormGrade;
  lastRepGrade: FormGrade;
  depthPct: number; // 0–100 live range-of-motion indicator
}

const COACH_MESSAGES: Record<FormGrade, string[]> = {
  excellent: [
    "Perfect depth — that's textbook form.",
    "Every rep locked in. Keep it up.",
    "Full range of motion. You're a machine.",
  ],
  good: [
    "Solid reps. Try to squeeze a bit lower.",
    "Good work — push for full depth.",
    "Strong pace. You've got this.",
  ],
  ok: [
    "Go deeper on each rep.",
    "Lock your core and lower all the way.",
    "Slow it down, get full range.",
  ],
  shallow: [
    "You're going too shallow — chest to the floor.",
    "Don't cheat yourself. Full depth matters.",
    "Slow down and go all the way down.",
  ],
  too_fast: [
    "Slow down — quality beats speed every time.",
    "Control the movement. Don't rush.",
    "Tempo matters. Two seconds down, two up.",
  ],
  "—": [
    "You've got this. Stay tight.",
    "Keep going. Every rep counts.",
    "Breathe. Down and up.",
  ],
};

const GRADE_CONFIG: Record<FormGrade, { label: string; color: string; bg: string; border: string }> = {
  excellent: { label: "Excellent", color: "text-emerald-300", bg: "bg-emerald-500/20", border: "border-emerald-500/40" },
  good: { label: "Good", color: "text-primary", bg: "bg-primary/20", border: "border-primary/40" },
  ok: { label: "OK", color: "text-yellow-300", bg: "bg-yellow-500/15", border: "border-yellow-500/30" },
  shallow: { label: "Shallow", color: "text-orange-300", bg: "bg-orange-500/15", border: "border-orange-500/30" },
  too_fast: { label: "Too Fast", color: "text-red-300", bg: "bg-red-500/15", border: "border-red-500/30" },
  "—": { label: "—", color: "text-white/40", bg: "bg-white/5", border: "border-white/10" },
};

function scoreRep(amplitude: number, durationMs: number): RepQuality {
  // Amplitude score: 0–70 points
  // amplitude < 4  → 0 pts (barely moved)
  // amplitude 8–20 → 40–70 pts (good range)
  // amplitude > 20 → max 70 pts
  const ampScore = Math.min(70, Math.max(0, ((amplitude - 4) / 16) * 70));

  // Tempo score: 0–30 points
  // < 400ms  → 0 pts (way too fast)
  // 600–2000ms → 20–30 pts (sweet spot)
  // > 3500ms → 10 pts (very slow)
  let tempoScore = 0;
  if (durationMs < 400) {
    tempoScore = 0;
  } else if (durationMs < 600) {
    tempoScore = 10;
  } else if (durationMs <= 2000) {
    tempoScore = 20 + ((durationMs - 600) / 1400) * 10;
  } else if (durationMs <= 3500) {
    tempoScore = 30;
  } else {
    tempoScore = 15;
  }

  const score = Math.round(ampScore + tempoScore);

  let grade: FormGrade;
  if (durationMs < 400) grade = "too_fast";
  else if (score >= 80) grade = "excellent";
  else if (score >= 60) grade = "good";
  else if (score >= 40) grade = "ok";
  else grade = "shallow";

  return { amplitude, durationMs, score, grade };
}

// Compute the angle at joint b given three 2D points (a–b–c)
function computeAngle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number }
): number {
  const rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let deg = Math.abs((rad * 180) / Math.PI);
  if (deg > 180) deg = 360 - deg;
  return deg;
}

// Score a rep using real pose landmarks instead of luminance
function scorePoseRep(depthDelta: number, durationMs: number, elbowAngle: number): RepQuality {
  // Depth score: 0.06 threshold = ok, 0.12+ = full range
  const depthScore = Math.min(70, Math.round((depthDelta / 0.12) * 70));

  // Elbow angle at bottom: 80–105° is ideal chest-to-floor
  let elbowScore: number;
  if (elbowAngle >= 80 && elbowAngle <= 105) elbowScore = 30;
  else if (elbowAngle >= 65 && elbowAngle < 80) elbowScore = 22;
  else if (elbowAngle > 105 && elbowAngle <= 125) elbowScore = 18;
  else elbowScore = 8;

  const score = Math.round(depthScore + elbowScore);

  let grade: FormGrade;
  if (durationMs < 400) grade = "too_fast";
  else if (score >= 80) grade = "excellent";
  else if (score >= 60) grade = "good";
  else if (score >= 40) grade = "ok";
  else grade = "shallow";

  return { amplitude: Math.round(depthDelta * 1000), durationMs, score, grade };
}

export default function Workout() {
  const userId = useRequireAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const createWorkout = useCreateWorkout();

  const { data: rivals } = useGetUserRivals(userId!, {
    query: { enabled: !!userId, queryKey: getGetUserRivalsQueryKey(userId!) },
  });
  const topRival = rivals?.[0] ?? null;

  const [phase, setPhase] = useState<WorkoutPhase>("setup");
  const [countdown, setCountdown] = useState(3);
  const [reps, setReps] = useState(0);
  const [sets, setSets] = useState(1);
  const [variation, setVariation] = useState("Standard Push-Up");
  const [manualReps, setManualReps] = useState("");
  const [saved, setSaved] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<"checking" | "ready" | "error">("checking");
  const [poseStatus, setPoseStatus] = useState<"loading" | "ready" | "error">("loading");
  const [coachMsg, setCoachMsg] = useState(COACH_MESSAGES["—"][0]);

  // Form quality state (drives UI)
  const [formState, setFormState] = useState<FormState>({
    score: 0,
    grade: "—",
    lastRepGrade: "—",
    depthPct: 0,
  });

  // Always-mounted video
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const coachIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pose estimation refs
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const poseReadyRef = useRef(false);  // non-stale access inside RAF
  const rafRef = useRef<number | null>(null);
  const phaseRef = useRef<WorkoutPhase>("setup");  // non-stale access inside RAF
  // Pose-based calibration: collect shoulder Y samples, then set baseline
  const shoulderSamplesRef = useRef<number[]>([]);
  const shoulderBaselineRef = useRef<number | null>(null);
  const shoulderPeakRef = useRef<number>(0);     // deepest nose Y seen in current "down" rep
  const elbowAngleBottomRef = useRef<number>(90); // elbow angle at deepest point

  // Detection refs (no re-renders)
  const lastLumRef = useRef<number | null>(null);
  const repStateRef = useRef<"up" | "down">("up");
  const repsRef = useRef(0);
  // Cooldown: prevent direction flip more than once per 500ms
  const lastDirectionChangeRef = useRef<number>(0);
  const DIRECTION_COOLDOWN_MS = 500;
  // Track which rep milestones already had rival speech fired
  const spokenMilestonesRef = useRef<Set<number>>(new Set());
  // Short-term luminance trend: last 6 frames for sustained-direction detection
  const lumTrendRef = useRef<number[]>([]);

  // Form tracking refs
  const peakLumRef = useRef<number>(0);  // highest lum in current direction
  const troughLumRef = useRef<number>(255); // lowest lum in current direction
  const repStartTimeRef = useRef<number>(0);
  const repAmplitudeHistoryRef = useRef<RepQuality[]>([]);
  // Calibration: baseline amplitude range when user first starts
  const calibAmplitudeRef = useRef<number | null>(null);
  // For the live depth bar: current deviation from neutral
  const neutralLumRef = useRef<number | null>(null);
  const lumWindowRef = useRef<number[]>([]);  // rolling 10-frame window

  const { data: variations } = useGetVariations();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
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
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
      clearAllIntervals();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Safety: re-attach stream if video loses it
  useEffect(() => {
    if (videoRef.current && streamRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  });

  // Keep phaseRef in sync so RAF loop can read current phase without stale closure
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Load MediaPipe pose model on mount (downloads ~5MB once, cached by browser)
  useEffect(() => {
    let cancelled = false;
    loadPoseLandmarker()
      .then((lm) => {
        if (!cancelled) {
          poseLandmarkerRef.current = lm;
          poseReadyRef.current = true;
          setPoseStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setPoseStatus("error");
      });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearAllIntervals = () => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (detectionIntervalRef.current) { clearInterval(detectionIntervalRef.current); detectionIntervalRef.current = null; }
    if (coachIntervalRef.current) { clearInterval(coachIntervalRef.current); coachIntervalRef.current = null; }
    if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; }
  };

  const pickCoachMessage = useCallback((grade: FormGrade) => {
    const pool = COACH_MESSAGES[grade] ?? COACH_MESSAGES["—"];
    const idx = Math.floor(Math.random() * pool.length);
    setCoachMsg(pool[idx]);
  }, []);

  const analyzeFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const sw = video.videoWidth;
    const sh = video.videoHeight;
    if (!sw || !sh) return;

    // Sample upper body / face region — where head moves during front-facing push-ups
    canvas.width = 16;
    canvas.height = 16;
    ctx.drawImage(video, sw * 0.1, sh * 0.05, sw * 0.8, sh * 0.5, 0, 0, 16, 16);

    const data = ctx.getImageData(0, 0, 16, 16).data;
    let lum = 0;
    for (let i = 0; i < data.length; i += 4) {
      lum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    lum /= 256; // 16×16 pixels

    // Rolling window for neutral baseline (50 frames ≈ 6s)
    lumWindowRef.current.push(lum);
    if (lumWindowRef.current.length > 50) lumWindowRef.current.shift();

    // Establish neutral lum from window average
    const avgLum = lumWindowRef.current.reduce((a, b) => a + b, 0) / lumWindowRef.current.length;
    if (neutralLumRef.current === null) neutralLumRef.current = avgLum;

    // Live depth bar: deviation from neutral, normalized to 0–100
    const deviation = Math.abs(lum - (neutralLumRef.current ?? avgLum));
    const dynRange = calibAmplitudeRef.current ?? 15; // use calibrated range or fallback
    const depthPct = Math.min(100, Math.round((deviation / dynRange) * 100));

    // Update depth bar at every frame (cheap state update)
    setFormState((prev) => ({ ...prev, depthPct }));

    // Sustained-direction trend: require consistent movement across 3 frames
    // before registering a direction change. This filters out single-frame
    // noise (people walking by, light flicker, casual fidgeting).
    lumTrendRef.current.push(lum);
    if (lumTrendRef.current.length > 6) lumTrendRef.current.shift();
    const tLen = lumTrendRef.current.length;
    // Compare current lum to 3 frames ago — requires ~300ms of sustained motion
    const TREND_THRESHOLD = 5;
    const trendDelta = tLen >= 3 ? lumTrendRef.current[tLen - 1]! - lumTrendRef.current[tLen - 3]! : 0;
    const isGoingDown = trendDelta < -TREND_THRESHOLD;
    const isGoingUp   = trendDelta > TREND_THRESHOLD;

    // Rep detection
    if (lastLumRef.current !== null) {
      const now = Date.now();

      // Track peak/trough for amplitude measurement
      if (repStateRef.current === "down") {
        troughLumRef.current = Math.min(troughLumRef.current, lum);
      } else {
        peakLumRef.current = Math.max(peakLumRef.current, lum);
      }

      // Only allow a direction flip once per cooldown window.
      if ((isGoingDown || isGoingUp) && now - lastDirectionChangeRef.current > DIRECTION_COOLDOWN_MS) {
        lastDirectionChangeRef.current = now;
        if (isGoingDown && repStateRef.current === "up") {
          // Start going down
          repStateRef.current = "down";
          troughLumRef.current = lum;
          repStartTimeRef.current = now;
        } else if (isGoingUp && repStateRef.current === "down") {
          // Coming back up — rep complete
          repStateRef.current = "up";
          peakLumRef.current = lum;

          const amplitude = peakLumRef.current - troughLumRef.current;
          const durationMs = Date.now() - repStartTimeRef.current;

          // Filter noise: require meaningful range of motion to count a rep.
          // Use 30% of calibrated amplitude (or absolute min of 6) so random
          // movement / body shifting never increments the counter.
          const minRequired = calibAmplitudeRef.current !== null
            ? Math.max(6, calibAmplitudeRef.current * 0.30)
            : 6;
          if (amplitude < minRequired) {
            return; // too shallow — not a real push-up
          }

          // Calibrate dynamic range from first few reps
          if (calibAmplitudeRef.current === null) {
            calibAmplitudeRef.current = Math.max(amplitude, 8);
          } else {
            // Slow-update calibration
            calibAmplitudeRef.current = calibAmplitudeRef.current * 0.85 + amplitude * 0.15;
          }

          const quality = scoreRep(amplitude, durationMs);
          repAmplitudeHistoryRef.current.push(quality);
          if (repAmplitudeHistoryRef.current.length > 8) repAmplitudeHistoryRef.current.shift();

          // Rolling average score
          const history = repAmplitudeHistoryRef.current;
          const avgScore = Math.round(history.reduce((a, b) => a + b.score, 0) / history.length);
          const avgGrade = history[history.length - 1].grade;

          setReps((r) => r + 1);
          repsRef.current += 1;

          setFormState((prev) => ({
            ...prev,
            score: avgScore,
            grade: avgGrade,
            lastRepGrade: quality.grade,
          }));

          pickCoachMessage(quality.grade);
        }
      }
    }
    lastLumRef.current = lum;
  }, [pickCoachMessage]);

  // Pose-based rep detection — replaces luminance fallback when model is ready
  const analyzeFramePose = useCallback(() => {
    const landmarker = poseLandmarkerRef.current;
    const video = videoRef.current;
    if (!landmarker || !video || video.readyState < 2) return;

    const result = landmarker.detectForVideo(video, performance.now());

    if (result.landmarks.length === 0) {
      setFormState((prev) => ({ ...prev, depthPct: 0 }));
      return;
    }

    const lm = result.landmarks[0]!;
    // Landmarks: 0=Nose 11=LShouldr 12=RShouldr 13=LElbow 14=RElbow 15=LWrist 16=RWrist
    const nose = lm[0]!;
    const lShoulder = lm[11]!, rShoulder = lm[12]!;
    const lElbow = lm[13]!, rElbow = lm[14]!;
    const lWrist = lm[15]!, rWrist = lm[16]!;

    // Need nose to be detected — it's the most reliable cross-orientation signal
    if ((nose.visibility ?? 0) < 0.3) return;

    // Nose Y increases as person goes toward floor; works for both side & front views
    const trackY = nose.y;

    // Calibrate baseline from first 30 frames (~1s at 30fps): person should be in "up" position
    if (shoulderSamplesRef.current.length < 30) {
      shoulderSamplesRef.current.push(trackY);
      if (shoulderSamplesRef.current.length === 30) {
        const sorted = [...shoulderSamplesRef.current].sort((a, b) => a - b);
        // 25th percentile = consistent "up" position, excluding brief dips
        shoulderBaselineRef.current = sorted[Math.floor(sorted.length * 0.25)]!;
      }
      return;
    }

    const baseline = shoulderBaselineRef.current!;

    // Live depth bar (0–100)
    const delta = Math.max(0, trackY - baseline);
    const depthPct = Math.min(100, Math.round((delta / 0.12) * 100));
    setFormState((prev) => ({ ...prev, depthPct }));

    // Elbow angle on whichever side is more visible (form scoring)
    const lVis = lShoulder.visibility ?? 0;
    const rVis = rShoulder.visibility ?? 0;
    let elbowAngle = 90;
    if (lVis >= rVis && lVis > 0.3) {
      elbowAngle = computeAngle(lShoulder, lElbow, lWrist);
    } else if (rVis > 0.3) {
      elbowAngle = computeAngle(rShoulder, rElbow, rWrist);
    }

    const DOWN_THRESHOLD = baseline + 0.07;  // nose drops 7% = going down
    const UP_THRESHOLD   = baseline + 0.025; // back within 2.5% of baseline = fully up
    const now = Date.now();

    if (repStateRef.current === "up" && trackY > DOWN_THRESHOLD) {
      if (now - lastDirectionChangeRef.current > DIRECTION_COOLDOWN_MS) {
        repStateRef.current = "down";
        shoulderPeakRef.current = trackY;
        elbowAngleBottomRef.current = elbowAngle;
        repStartTimeRef.current = now;
        lastDirectionChangeRef.current = now;
      }
    } else if (repStateRef.current === "down") {
      // Update deepest point
      if (trackY > shoulderPeakRef.current) {
        shoulderPeakRef.current = trackY;
        elbowAngleBottomRef.current = elbowAngle;
      }
      if (trackY < UP_THRESHOLD && now - lastDirectionChangeRef.current > DIRECTION_COOLDOWN_MS) {
        lastDirectionChangeRef.current = now;
        repStateRef.current = "up";

        const depthDelta = shoulderPeakRef.current - baseline;
        const durationMs = now - repStartTimeRef.current;

        if (depthDelta < 0.04) return; // too shallow — not a real push-up

        const quality = scorePoseRep(depthDelta, durationMs, elbowAngleBottomRef.current);
        repAmplitudeHistoryRef.current.push(quality);
        if (repAmplitudeHistoryRef.current.length > 8) repAmplitudeHistoryRef.current.shift();

        const history = repAmplitudeHistoryRef.current;
        const avgScore = Math.round(history.reduce((a, b) => a + b.score, 0) / history.length);
        const avgGrade = history[history.length - 1]!.grade;

        setReps((r) => r + 1);
        repsRef.current += 1;

        setFormState((prev) => ({
          ...prev,
          score: avgScore,
          grade: avgGrade,
          lastRepGrade: quality.grade,
        }));

        pickCoachMessage(quality.grade);
      }
    }
  }, [pickCoachMessage]);

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

  // Fire rival voice at rep milestones
  useEffect(() => {
    if (phase !== "active") return;
    const MILESTONES = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100];
    if (MILESTONES.includes(reps) && !spokenMilestonesRef.current.has(reps) && topRival) {
      spokenMilestonesRef.current.add(reps);
      speakWorkoutTaunt(reps, topRival.personality, topRival.name);
    }
  }, [reps, phase, topRival]);

  const startWorkout = () => {
    phaseRef.current = "active"; // sync immediately so RAF loop sees it
    setPhase("active");
    setReps(0);
    repsRef.current = 0;
    repStateRef.current = "up";
    lastLumRef.current = null;
    lastDirectionChangeRef.current = 0;
    spokenMilestonesRef.current = new Set();
    lumTrendRef.current = [];
    peakLumRef.current = 0;
    troughLumRef.current = 255;
    repStartTimeRef.current = 0;
    repAmplitudeHistoryRef.current = [];
    calibAmplitudeRef.current = null;
    neutralLumRef.current = null;
    lumWindowRef.current = [];
    // Reset pose calibration for fresh workout
    shoulderSamplesRef.current = [];
    shoulderBaselineRef.current = null;
    shoulderPeakRef.current = 0;
    elbowAngleBottomRef.current = 90;
    setFormState({ score: 0, grade: "—", lastRepGrade: "—", depthPct: 0 });

    if (poseReadyRef.current) {
      // Pose model loaded: use landmark-based detection at full frame rate
      const loop = () => {
        if (phaseRef.current !== "active") return;
        analyzeFramePose();
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } else {
      // Fallback: luminance-based detection at 10fps
      detectionIntervalRef.current = setInterval(analyzeFrame, 100);
    }

    // Periodic coach messages every 10s
    coachIntervalRef.current = setInterval(() => {
      const grade = repAmplitudeHistoryRef.current.length > 0
        ? repAmplitudeHistoryRef.current[repAmplitudeHistoryRef.current.length - 1].grade
        : "—";
      pickCoachMessage(grade);
    }, 10000);
  };

  const endWorkout = () => {
    phaseRef.current = "summary"; // stop RAF loop before clearing
    clearAllIntervals();
    window.speechSynthesis?.cancel();
    setManualReps(repsRef.current.toString());
    setPhase("summary");
  };

  const saveWorkout = () => {
    const finalReps = parseInt(manualReps, 10);
    if (!userId || isNaN(finalReps)) return;
    createWorkout.mutate(
      { data: { userId, totalReps: finalReps, sets, variation, usedCamera: cameraStatus === "ready" } },
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

  // Summary stats from history
  const summaryHistory = repAmplitudeHistoryRef.current;
  const summaryAvgScore = summaryHistory.length > 0
    ? Math.round(summaryHistory.reduce((a, b) => a + b.score, 0) / summaryHistory.length)
    : 0;
  const excellentCount = summaryHistory.filter((r) => r.grade === "excellent").length;
  const goodCount = summaryHistory.filter((r) => r.grade === "good").length;
  const shallowCount = summaryHistory.filter((r) => r.grade === "shallow" || r.grade === "too_fast").length;

  if (!userId) return null;

  const formCfg = GRADE_CONFIG[formState.grade];

  return (
    <AppLayout showNav={false}>
      <div className="min-h-[100dvh] bg-black flex flex-col relative overflow-hidden">
        {/* Always-mounted video layer */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: phase === "setup" ? 1 : phase === "active" ? 0.3 : 0,
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
              if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
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
            <div className="flex-1" />
            <div className="bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl p-3 flex items-center gap-2">
              {cameraStatus === "checking" && (
                <><div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shrink-0" /><span className="text-sm font-mono text-yellow-300">Checking camera access...</span></>
              )}
              {cameraStatus === "ready" && (
                <><CheckCircle className="w-4 h-4 text-primary shrink-0" /><span className="text-sm font-mono text-primary">Camera ready.</span></>
              )}
            </div>

            {/* Pose model status */}
            <div className="bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl p-3 flex items-center gap-2">
              {poseStatus === "loading" && (
                <><Loader2 className="w-4 h-4 text-yellow-300 animate-spin shrink-0" /><span className="text-sm font-mono text-yellow-300">Loading body tracking model...</span></>
              )}
              {poseStatus === "ready" && (
                <><Scan className="w-4 h-4 text-primary shrink-0" /><span className="text-sm font-mono text-primary">Body tracking ready — push-ups only.</span></>
              )}
              {poseStatus === "error" && (
                <><AlertCircle className="w-4 h-4 text-orange-400 shrink-0" /><span className="text-sm font-mono text-orange-300">Body tracking unavailable — using motion fallback.</span></>
              )}
            </div>

            {cameraStatus === "ready" && (
              <div className="bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl p-3 space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-white/50">Position tip</p>
                <p className="text-xs text-white/70 leading-relaxed">
                  <strong className="text-white">Front view:</strong> prop your phone at chest height and face the camera as you push up. Your head moving toward and away from the lens drives the counter.
                </p>
                <p className="text-xs text-white/70 leading-relaxed">
                  <strong className="text-white">Side view:</strong> lay your phone on the floor to the side — your torso rising and falling is the most reliable signal.
                </p>
              </div>
            )}
            {cameraStatus === "error" && (
              <div className="bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" /><span className="text-sm font-mono text-red-300">No camera. Count reps manually after session.</span>
              </div>
            )}

            <div className="space-y-3 bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl p-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-white/50 block mb-1">Variation</label>
                <select
                  value={variation}
                  onChange={(e) => setVariation(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg bg-white/10 border border-white/20 text-white text-sm font-medium focus:outline-none focus:border-primary"
                >
                  {variations?.map((v) => (
                    <option key={v.id} value={v.name} className="bg-neutral-900">{v.name}</option>
                  ))}
                  {!variations?.length && <option value="Standard Push-Up" className="bg-neutral-900">Standard Push-Up</option>}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-white/50 block mb-1">Sets planned</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setSets(n)}
                      className={`flex-1 h-10 rounded-lg text-sm font-bold border transition-colors ${sets === n ? "bg-primary text-black border-primary" : "bg-white/10 border-white/20 text-white/70 hover:border-primary/50"}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button onClick={startCountdown} size="lg" className="w-full h-14 text-lg font-display uppercase tracking-widest bg-primary text-black hover:bg-primary/90">
              <Play className="w-5 h-5 mr-2" /> Start Session
            </Button>
          </div>
        )}

        {/* ── COUNTDOWN PHASE ── */}
        {phase === "countdown" && (
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-4">
            <p className="text-white/50 font-mono text-sm uppercase tracking-widest">Get Ready</p>
            <div className="text-[160px] font-display font-black text-primary leading-none tabular-nums">{countdown}</div>
            <p className="text-white/60 font-mono text-sm">Position yourself in push-up position</p>
          </div>
        )}

        {/* ── ACTIVE PHASE ── */}
        {phase === "active" && (
          <div className="relative z-10 flex-1 flex flex-col">
            {/* ── FORM HUD bar (top) ── */}
            <div className="px-4 pt-3 flex items-center gap-3">
              {/* Form grade pill */}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold uppercase tracking-wider ${formCfg.bg} ${formCfg.border} ${formCfg.color}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${formState.grade === "excellent" ? "bg-emerald-400" : formState.grade === "good" ? "bg-primary" : formState.grade === "ok" ? "bg-yellow-400" : formState.grade === "—" ? "bg-white/30" : "bg-red-400"} animate-pulse`} />
                {formCfg.label}
              </div>

              {/* Score */}
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-display font-black text-white tabular-nums">
                  {formState.score > 0 ? formState.score : "—"}
                </span>
                {formState.score > 0 && <span className="text-xs font-mono text-white/40">/100</span>}
              </div>

              {/* Last rep flash */}
              {formState.lastRepGrade !== "—" && formState.lastRepGrade !== formState.grade && (
                <div className={`ml-auto text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-full ${GRADE_CONFIG[formState.lastRepGrade].bg} ${GRADE_CONFIG[formState.lastRepGrade].color}`}>
                  last: {GRADE_CONFIG[formState.lastRepGrade].label}
                </div>
              )}
            </div>

            {/* ── MAIN REP AREA + DEPTH BAR ── */}
            <div className="flex-1 flex items-center justify-center gap-4 px-4">
              {/* Rep counter */}
              <div className="flex-1 flex flex-col items-center gap-2">
                <p className="text-white/40 font-mono text-xs uppercase tracking-widest">Reps</p>
                <div
                  className="text-[110px] font-display font-black text-primary leading-none tabular-nums"
                  style={{ textShadow: "0 0 40px rgba(212,255,0,0.4)" }}
                >
                  {reps}
                </div>
                <p className="text-xs text-white/40 font-mono px-4 text-center italic">"{coachMsg}"</p>
                <button
                  onClick={() => { setReps((r) => r + 1); repsRef.current += 1; }}
                  className="mt-2 px-5 py-2 rounded-full border border-primary/40 text-primary text-xs font-mono uppercase tracking-wider hover:bg-primary/10 transition-colors"
                >
                  + Manual count
                </button>
              </div>

              {/* Depth bar (only when camera is ready) */}
              {cameraStatus === "ready" && (
                <div className="flex flex-col items-center gap-2 w-8">
                  <span className="text-[9px] font-mono text-white/30 uppercase tracking-widest rotate-180" style={{ writingMode: "vertical-rl" }}>Depth</span>
                  {/* Track */}
                  <div className="relative w-4 rounded-full bg-white/10 border border-white/10 overflow-hidden" style={{ height: 160 }}>
                    {/* Fill grows from bottom */}
                    <div
                      className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-100"
                      style={{
                        height: `${formState.depthPct}%`,
                        background: formState.depthPct > 75
                          ? "linear-gradient(to top, #34d399, #D4FF00)"
                          : formState.depthPct > 40
                          ? "linear-gradient(to top, #D4FF00, #D4FF00)"
                          : "linear-gradient(to top, #fb923c, #D4FF00)",
                      }}
                    />
                    {/* Target line at 75% */}
                    <div className="absolute left-0 right-0 border-t border-dashed border-white/30" style={{ bottom: "75%" }} />
                  </div>
                  <span className="text-[9px] font-mono text-white/30 uppercase tracking-widest rotate-180" style={{ writingMode: "vertical-rl" }}>ROM</span>
                </div>
              )}
            </div>

            {/* ── End button ── */}
            <div className="p-4">
              <Button onClick={endWorkout} size="lg" variant="destructive" className="w-full h-14 text-lg font-display uppercase tracking-widest">
                <StopCircle className="w-5 h-5 mr-2" /> End Workout
              </Button>
            </div>
          </div>
        )}

        {/* ── SUMMARY PHASE ── */}
        {phase === "summary" && (
          <div className="relative z-10 flex-1 flex flex-col p-4 gap-4 bg-background overflow-y-auto">
            <div className="text-center pt-4">
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">Session Complete</p>
              <div className="text-8xl font-display font-black text-primary leading-none mb-1" style={{ textShadow: "0 0 40px rgba(212,255,0,0.2)" }}>
                {manualReps}
              </div>
              <p className="text-muted-foreground font-mono text-sm">push-ups</p>
            </div>

            {/* Form score summary */}
            {summaryHistory.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Form Score</p>
                  <div className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${GRADE_CONFIG[formState.grade].bg} ${GRADE_CONFIG[formState.grade].border} ${GRADE_CONFIG[formState.grade].color}`}>
                    {formState.grade !== "—" ? GRADE_CONFIG[formState.grade].label : "—"}
                  </div>
                </div>

                {/* Score bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono text-muted-foreground">
                    <span>Overall</span>
                    <span className="font-bold text-foreground">{summaryAvgScore}/100</span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${summaryAvgScore}%`,
                        background: summaryAvgScore >= 80 ? "#34d399" : summaryAvgScore >= 60 ? "#D4FF00" : summaryAvgScore >= 40 ? "#fb923c" : "#ef4444",
                      }}
                    />
                  </div>
                </div>

                {/* Rep quality breakdown */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg py-2">
                    <div className="text-xl font-display font-black text-emerald-400">{excellentCount + goodCount}</div>
                    <div className="text-emerald-400/70 mt-0.5">Deep</div>
                  </div>
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg py-2">
                    <div className="text-xl font-display font-black text-yellow-300">{summaryHistory.filter(r => r.grade === "ok").length}</div>
                    <div className="text-yellow-300/70 mt-0.5">OK</div>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg py-2">
                    <div className="text-xl font-display font-black text-red-400">{shallowCount}</div>
                    <div className="text-red-400/70 mt-0.5">Shallow</div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Sets</p>
                <p className="text-2xl font-display font-bold">{sets}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Avg / set</p>
                <p className="text-2xl font-display font-bold">{sets > 0 ? Math.round((parseInt(manualReps) || 0) / sets) : 0}</p>
              </div>
            </div>

            <div className="bg-card border border-primary/20 rounded-xl p-4 space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">Adjust rep count</label>
              <Input
                type="number"
                value={manualReps}
                onChange={(e) => setManualReps(e.target.value)}
                className="h-12 text-xl font-display text-center bg-background border-primary/30 focus-visible:border-primary"
              />
              <p className="text-xs text-muted-foreground font-mono">Camera detection may miss reps. Adjust here.</p>
            </div>

            {saved ? (
              <div className="flex items-center justify-center gap-2 text-primary py-4">
                <CheckCircle className="w-5 h-5" />
                <span className="font-mono font-bold">Saved! Redirecting...</span>
              </div>
            ) : (
              <Button onClick={saveWorkout} disabled={createWorkout.isPending} size="lg" className="w-full h-14 text-lg font-display uppercase tracking-widest bg-primary text-black">
                {createWorkout.isPending ? "Saving..." : "Save Workout"}
              </Button>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

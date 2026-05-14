import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, goalsTable, workoutsTable, usersTable } from "@workspace/db";
import {
  GetUserGoalsParams,
  CreateGoalBody,
  CreateGoalParams,
  UpdateGoalBody,
  UpdateGoalParams,
  GetGoalRecommendationsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/goals/user/:userId", async (req, res): Promise<void> => {
  const params = GetUserGoalsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const goals = await db.select().from(goalsTable).where(eq(goalsTable.userId, params.data.userId));
  res.json(goals);
});

router.post("/goals/user/:userId", async (req, res): Promise<void> => {
  const params = CreateGoalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const rawDeadline = parsed.data.deadline;
  const deadlineStr = rawDeadline
    ? rawDeadline instanceof Date
      ? rawDeadline.toISOString().split("T")[0]
      : String(rawDeadline)
    : null;

  const [goal] = await db.insert(goalsTable).values({
    userId: params.data.userId,
    type: parsed.data.type,
    targetReps: parsed.data.targetReps,
    deadline: deadlineStr,
    aiGenerated: parsed.data.aiGenerated ?? false,
    completed: false,
  }).returning();

  res.status(201).json(goal);
});

router.patch("/goals/:goalId", async (req, res): Promise<void> => {
  const params = UpdateGoalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updatePayload: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.deadline !== undefined) {
    updatePayload.deadline = parsed.data.deadline instanceof Date
      ? parsed.data.deadline.toISOString().split("T")[0]
      : parsed.data.deadline ?? null;
  }

  const [goal] = await db
    .update(goalsTable)
    .set(updatePayload)
    .where(eq(goalsTable.id, params.data.goalId))
    .returning();

  if (!goal) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }

  res.json(goal);
});

// Per-level config: how to derive base goals from currentMaxPushups
const LEVEL_CONFIG: Record<string, {
  multiplier: number;   // fraction of max reps to use as daily base
  daysPerWeek: number;  // how many active days/week to target
  minDaily: number;     // absolute floor for daily goal
  maxDaily: number;     // absolute ceiling for daily goal
  streakDays: number;   // streak target
}> = {
  beginner:     { multiplier: 0.65, daysPerWeek: 4, minDaily: 5,  maxDaily: 20,  streakDays: 4 },
  intermediate: { multiplier: 0.70, daysPerWeek: 5, minDaily: 15, maxDaily: 50,  streakDays: 5 },
  advanced:     { multiplier: 0.75, daysPerWeek: 6, minDaily: 35, maxDaily: 90,  streakDays: 6 },
  athlete:      { multiplier: 0.80, daysPerWeek: 7, minDaily: 70, maxDaily: 200, streakDays: 7 },
};

// Level-specific first-time messages (no workout history yet)
const FIRST_TIME_MESSAGES: Record<string, (daily: number, weekly: number) => string> = {
  beginner: (d, w) =>
    `Welcome! Since you're building from the ground up, let's keep it simple: aim for ${d} push-ups a day, ${w} total this week. Consistency matters more than big numbers right now.`,
  intermediate: (d, w) =>
    `You already have a solid base — let's use it. ${d} push-ups daily, ${w} for the week. Focus on clean reps and steady pacing.`,
  advanced: (d, w) =>
    `You're past the basics — time to train with intent. ${d} reps daily, ${w} this week. Track your quality as closely as your count.`,
  athlete: (d, w) =>
    `Elite level, elite standards. ${d} reps every day, ${w} for the week. If a day feels easy, you're holding back.`,
};

router.get("/goals/user/:userId/recommendations", async (req, res): Promise<void> => {
  const params = GetGoalRecommendationsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = params.data.userId;

  // Fetch user profile + all workouts in parallel
  const [userRows, workouts] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, userId)),
    db.select().from(workoutsTable).where(eq(workoutsTable.userId, userId)),
  ]);

  const user = userRows[0];
  const level = user?.fitnessLevel ?? "beginner";
  const maxPushups = user?.currentMaxPushups ?? 10;
  const cfg = LEVEL_CONFIG[level] ?? LEVEL_CONFIG["beginner"]!;

  // Compute level-based baseline daily goal
  const baseDaily = Math.min(
    cfg.maxDaily,
    Math.max(cfg.minDaily, Math.floor(maxPushups * cfg.multiplier))
  );
  const baseWeekly = baseDaily * cfg.daysPerWeek;
  const streakGoal = cfg.streakDays;

  // Date window for last week's workouts
  const now = new Date();
  const startOfLastWeek = new Date(now);
  startOfLastWeek.setDate(now.getDate() - now.getDay() - 7);
  const endOfLastWeek = new Date(now);
  endOfLastWeek.setDate(now.getDate() - now.getDay());
  const startStr = startOfLastWeek.toISOString().split("T")[0]!;
  const endStr = endOfLastWeek.toISOString().split("T")[0]!;

  const lastWeekTotal = workouts
    .filter(w => w.date >= startStr && w.date < endStr)
    .reduce((sum, w) => sum + w.totalReps, 0);

  let dailyGoal: number;
  let weeklyGoal: number;
  let message: string;

  // Per-level overtraining caps: max weekly increase allowed
  const OVERTRAINING_CAP: Record<string, number> = {
    beginner: 1.10,
    intermediate: 1.15,
    advanced: 1.20,
    athlete: 1.20,
  };
  const cap = OVERTRAINING_CAP[level] ?? 1.15;

  if (lastWeekTotal > 0) {
    // Build on last week with level-appropriate cap, never below the level baseline
    weeklyGoal = Math.max(baseWeekly, Math.ceil(lastWeekTotal * cap));
    dailyGoal = Math.ceil(weeklyGoal / cfg.daysPerWeek);
    const levelLabel = level.charAt(0).toUpperCase() + level.slice(1);
    message = `${levelLabel} mode: You hit ${lastWeekTotal} push-ups last week. Let's reach ${weeklyGoal} this week — about ${dailyGoal} a day. Keep the streak alive.`;
  } else if (workouts.length > 0) {
    // Has history but not from last week — base on all-time average, scaled by level
    const avgPerWorkout = Math.ceil(workouts.reduce((s, w) => s + w.totalReps, 0) / workouts.length);
    dailyGoal = Math.max(baseDaily, Math.ceil(avgPerWorkout * 1.1));
    weeklyGoal = dailyGoal * cfg.daysPerWeek;
    message = `Based on your recent sessions and ${level} level, aim for ${dailyGoal} push-ups daily — ${weeklyGoal} this week.`;
  } else {
    // First-time user: use pure level-based baseline
    dailyGoal = baseDaily;
    weeklyGoal = baseWeekly;
    const msgFn = FIRST_TIME_MESSAGES[level] ?? FIRST_TIME_MESSAGES["beginner"]!;
    message = msgFn(dailyGoal, weeklyGoal);
  }

  res.json({ dailyGoal, weeklyGoal, streakGoal, message });
});

export default router;

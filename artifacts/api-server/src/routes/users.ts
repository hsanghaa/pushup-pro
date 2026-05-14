import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, usersTable, workoutsTable, goalsTable } from "@workspace/db";
import {
  CreateUserBody,
  GetUserParams,
  UpdateUserBody,
  UpdateUserParams,
  GetUserStatsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/users", async (req, res): Promise<void> => {
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.insert(usersTable).values({
    name: parsed.data.name,
    fitnessLevel: parsed.data.fitnessLevel,
    currentMaxPushups: parsed.data.currentMaxPushups,
    weeklyAvailabilityDays: parsed.data.weeklyAvailabilityDays ?? 3,
    mainGoal: parsed.data.mainGoal,
    reminderPreference: parsed.data.reminderPreference ?? null,
    wantsAiGoals: parsed.data.wantsAiGoals ?? true,
    wantsCompetition: parsed.data.wantsCompetition ?? true,
  }).returning();

  res.status(201).json(user);
});

router.get("/users/:userId", async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.data.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(user);
});

router.patch("/users/:userId", async (req, res): Promise<void> => {
  const params = UpdateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.update(usersTable).set(parsed.data).where(eq(usersTable.id, params.data.userId)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(user);
});

router.get("/users/:userId/stats", async (req, res): Promise<void> => {
  const params = GetUserStatsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = params.data.userId;

  const workouts = await db.select().from(workoutsTable).where(eq(workoutsTable.userId, userId));

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const startOfWeekStr = startOfWeek.toISOString().split("T")[0];

  const totalPushups = workouts.reduce((sum, w) => sum + w.totalReps, 0);
  const todayReps = workouts.filter(w => w.date === todayStr).reduce((sum, w) => sum + w.totalReps, 0);
  const weeklyTotal = workouts.filter(w => w.date >= startOfWeekStr).reduce((sum, w) => sum + w.totalReps, 0);
  const bestSet = workouts.reduce((best, w) => Math.max(best, w.totalReps), 0);

  const allSets = workouts.flatMap(w => {
    const reps = w.sets > 0 ? w.totalReps / w.sets : w.totalReps;
    return Array(w.sets).fill(reps);
  });
  const averageRepsPerSet = allSets.length > 0 ? allSets.reduce((s, r) => s + r, 0) / allSets.length : 0;

  // Streak calculation
  const workoutDates = [...new Set(workouts.map(w => w.date))].sort().reverse();
  let currentStreak = 0;
  const checkDate = new Date();
  for (const dateStr of workoutDates) {
    const checkStr = checkDate.toISOString().split("T")[0];
    if (dateStr === checkStr) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Verified / unverified rep totals
  const verifiedRepsTotal = workouts.reduce((sum, w) => sum + (w.verifiedReps ?? 0), 0);
  const unverifiedRepsTotal = workouts.reduce((sum, w) => sum + (w.unverifiedReps ?? 0), 0);
  const weeklyWorkouts = workouts.filter(w => w.date >= startOfWeekStr);
  const weeklyVerifiedReps = weeklyWorkouts.reduce((sum, w) => sum + (w.verifiedReps ?? 0), 0);
  const weeklyUnverifiedReps = weeklyWorkouts.reduce((sum, w) => sum + (w.unverifiedReps ?? 0), 0);

  const streakBonus = currentStreak * 10;
  const personalBestBonus = bestSet > 0 ? 25 : 0;
  const challengeBonus = 0;
  const progressScore = weeklyTotal + streakBonus + personalBestBonus + challengeBonus;

  res.json({
    userId,
    totalPushups,
    todayReps,
    weeklyTotal,
    averageRepsPerSet: Math.round(averageRepsPerSet * 10) / 10,
    currentStreak,
    bestSet,
    progressScore,
    weeklyReps: weeklyTotal,
    streakBonus,
    personalBestBonus,
    challengeBonus,
    verifiedRepsTotal,
    unverifiedRepsTotal,
    weeklyVerifiedReps,
    weeklyUnverifiedReps,
  });
});

export default router;

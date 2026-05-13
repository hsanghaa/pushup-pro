import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, goalsTable, workoutsTable } from "@workspace/db";
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

router.get("/goals/user/:userId/recommendations", async (req, res): Promise<void> => {
  const params = GetGoalRecommendationsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = params.data.userId;

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() - 7);
  const startOfWeekStr = startOfWeek.toISOString().split("T")[0];
  const endOfLastWeek = new Date(now);
  endOfLastWeek.setDate(now.getDate() - now.getDay());
  const endOfLastWeekStr = endOfLastWeek.toISOString().split("T")[0];

  const workouts = await db.select().from(workoutsTable).where(eq(workoutsTable.userId, userId));
  const lastWeekWorkouts = workouts.filter(w => w.date >= startOfWeekStr && w.date < endOfLastWeekStr);
  const lastWeekTotal = lastWeekWorkouts.reduce((sum, w) => sum + w.totalReps, 0);

  let dailyGoal = 15;
  let weeklyGoal = 100;
  let streakGoal = 7;
  let message = "Let's build momentum with your first week goal.";

  if (lastWeekTotal > 0) {
    weeklyGoal = Math.ceil(lastWeekTotal * 1.15);
    dailyGoal = Math.ceil(weeklyGoal / 7);
    message = `You completed ${lastWeekTotal} push-ups last week. This week, let's aim for ${weeklyGoal}. That's only about ${dailyGoal} push-ups per day.`;
  } else if (workouts.length > 0) {
    const totalReps = workouts.reduce((sum, w) => sum + w.totalReps, 0);
    const avgPerWorkout = Math.ceil(totalReps / workouts.length);
    dailyGoal = Math.ceil(avgPerWorkout * 1.1);
    weeklyGoal = dailyGoal * 7;
    message = `Based on your recent workouts, let's aim for ${dailyGoal} push-ups daily this week.`;
  }

  res.json({ dailyGoal, weeklyGoal, streakGoal, message });
});

export default router;

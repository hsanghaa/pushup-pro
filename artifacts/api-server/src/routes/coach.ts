import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, workoutsTable } from "@workspace/db";
import { GetCoachMessageParams } from "@workspace/api-zod";

const router: IRouter = Router();

const ENCOURAGEMENT_MESSAGES = [
  "Great work. Every rep counts toward your goal.",
  "Consistency is the key. You're building something real.",
  "Small work today still counts. Get one strong set in.",
  "You're getting stronger. Keep showing up.",
  "The best workout is the one you actually do.",
  "Progress isn't always visible, but it's always happening.",
];

const POST_WORKOUT_MESSAGES = [
  "That's a strong session. Your streak is alive.",
  "Well done. Rest up and come back stronger.",
  "Solid work. Your progress score just went up.",
  "That's what consistency looks like. Keep going.",
];

const REMINDER_MESSAGES = [
  "Time to train. Let's get today's push-ups in.",
  "Don't break the streak. Five minutes, push-ups done.",
  "Small work today still counts. Get one set in.",
  "Your body is ready. Time to earn those reps.",
];

const CHALLENGE_MESSAGES = [
  "First to 500 this week. Stay consistent and you'll be hard to beat.",
  "The leaderboard doesn't sleep. Neither should your push-up game.",
  "Every rep closes the gap. Get after it.",
  "Challenge mode: on. Let's go.",
];

function pickRandom(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

router.get("/coach/message/:userId", async (req, res): Promise<void> => {
  const params = GetCoachMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = params.data.userId;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.json({ message: pickRandom(ENCOURAGEMENT_MESSAGES), type: "encouragement" });
    return;
  }

  const workouts = await db.select().from(workoutsTable).where(eq(workoutsTable.userId, userId));

  if (workouts.length === 0) {
    res.json({
      message: `Welcome, ${user.name}! Based on your starting point, your first goal is to complete your first session. Let's build momentum.`,
      type: "encouragement",
    });
    return;
  }

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const startOfWeekStr = startOfWeek.toISOString().split("T")[0];

  const todayWorkouts = workouts.filter(w => w.date === todayStr);
  const weeklyTotal = workouts.filter(w => w.date >= startOfWeekStr).reduce((sum, w) => sum + w.totalReps, 0);
  const totalPushups = workouts.reduce((sum, w) => sum + w.totalReps, 0);

  // Check streaks
  const workoutDates = [...new Set(workouts.map(w => w.date))].sort().reverse();
  let streak = 0;
  const checkDate = new Date();
  for (const d of workoutDates) {
    if (d === checkDate.toISOString().split("T")[0]) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else break;
  }

  if (weeklyTotal >= 450) {
    res.json({
      message: `You're only ${500 - weeklyTotal} reps away from winning this week's challenge. This is your moment.`,
      type: "challenge",
    });
    return;
  }

  if (streak >= 3) {
    res.json({
      message: `${streak}-day streak. Don't break it now. Today's session is what separates the consistent from the rest.`,
      type: "encouragement",
    });
    return;
  }

  if (todayWorkouts.length > 0) {
    const todayReps = todayWorkouts.reduce((sum, w) => sum + w.totalReps, 0);
    res.json({
      message: `Great work. You completed ${todayReps} push-ups today and kept your streak alive.`,
      type: "encouragement",
    });
    return;
  }

  if (totalPushups >= 1000) {
    res.json({
      message: `${totalPushups} total push-ups and counting. You're in elite territory, ${user.name}. Keep pushing.`,
      type: "milestone",
    });
    return;
  }

  res.json({
    message: pickRandom(ENCOURAGEMENT_MESSAGES),
    type: "encouragement",
  });
});

export default router;

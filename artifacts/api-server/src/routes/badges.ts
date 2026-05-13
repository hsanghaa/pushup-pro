import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, workoutsTable } from "@workspace/db";
import { GetUserBadgesParams } from "@workspace/api-zod";

const router: IRouter = Router();

const ALL_BADGES = [
  {
    id: "first_workout",
    name: "First Workout",
    description: "Completed your very first push-up session",
    requirement: "Complete 1 workout",
  },
  {
    id: "total_100",
    name: "Century Club",
    description: "Reached 100 total push-ups",
    requirement: "100 total push-ups",
  },
  {
    id: "total_500",
    name: "500 Strong",
    description: "Powered through 500 total push-ups",
    requirement: "500 total push-ups",
  },
  {
    id: "total_1000",
    name: "1K Legend",
    description: "Hit 1,000 total push-ups — that's elite",
    requirement: "1,000 total push-ups",
  },
  {
    id: "streak_3",
    name: "3-Day Streak",
    description: "Trained 3 days in a row",
    requirement: "3-day workout streak",
  },
  {
    id: "streak_7",
    name: "Week Warrior",
    description: "7 consecutive days of training",
    requirement: "7-day workout streak",
  },
  {
    id: "personal_best",
    name: "Personal Best",
    description: "Crushed your previous best set",
    requirement: "Set a new personal best",
  },
  {
    id: "challenge_champion",
    name: "Challenge Champion",
    description: "Won a weekly push-up challenge",
    requirement: "Win a weekly challenge",
  },
  {
    id: "morning_grinder",
    name: "Morning Grinder",
    description: "Completed a workout before 9am",
    requirement: "Complete a morning workout",
  },
  {
    id: "athlete_mode",
    name: "Athlete Mode",
    description: "Reached athlete fitness level",
    requirement: "Set fitness level to athlete",
  },
];

router.get("/badges/user/:userId", async (req, res): Promise<void> => {
  const params = GetUserBadgesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const userId = params.data.userId;
  const workouts = await db.select().from(workoutsTable).where(eq(workoutsTable.userId, userId));

  const totalPushups = workouts.reduce((sum, w) => sum + w.totalReps, 0);

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

  const sortedWorkouts = [...workouts].sort((a, b) => a.totalReps - b.totalReps);
  const personalBest = sortedWorkouts.length > 1 && sortedWorkouts[sortedWorkouts.length - 1].totalReps > sortedWorkouts[0].totalReps;

  const earnedMap: Record<string, Date | null> = {
    first_workout: workouts.length > 0 ? new Date(workouts[0].createdAt) : null,
    total_100: totalPushups >= 100 ? new Date() : null,
    total_500: totalPushups >= 500 ? new Date() : null,
    total_1000: totalPushups >= 1000 ? new Date() : null,
    streak_3: currentStreak >= 3 ? new Date() : null,
    streak_7: currentStreak >= 7 ? new Date() : null,
    personal_best: personalBest ? new Date() : null,
    challenge_champion: null,
    morning_grinder: null,
    athlete_mode: null,
  };

  const badges = ALL_BADGES.map(badge => ({
    ...badge,
    earned: earnedMap[badge.id] !== null,
    earnedDate: earnedMap[badge.id] ? earnedMap[badge.id]!.toISOString() : null,
  }));

  res.json(badges);
});

export default router;

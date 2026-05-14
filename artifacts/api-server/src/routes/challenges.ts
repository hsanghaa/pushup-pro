import { Router, type IRouter } from "express";
import { eq, gte, and, desc } from "drizzle-orm";
import { db, challengesTable, challengeParticipantsTable, workoutsTable, usersTable } from "@workspace/db";
import { JoinChallengeBody } from "@workspace/api-zod";

const router: IRouter = Router();

function getWeekBounds() {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return {
    start: startOfWeek.toISOString().split("T")[0],
    end: endOfWeek.toISOString().split("T")[0],
  };
}

async function ensureCurrentChallenge() {
  const { start, end } = getWeekBounds();

  const [existing] = await db
    .select()
    .from(challengesTable)
    .where(eq(challengesTable.startDate, start));

  if (existing) return existing;

  const [challenge] = await db.insert(challengesTable).values({
    name: "Weekly Push-Up Race",
    target: 500,
    startDate: start,
    endDate: end,
    description: "Race to hit your weekly target. Every level has a personalized goal — stay consistent and you'll be hard to beat.",
  }).returning();

  return challenge;
}

router.get("/challenges/current", async (req, res): Promise<void> => {
  const challenge = await ensureCurrentChallenge();

  const participants = await db
    .select()
    .from(challengeParticipantsTable)
    .where(eq(challengeParticipantsTable.challengeId, challenge.id));

  res.json({ ...challenge, participantCount: participants.length });
});

router.get("/challenges/current/leaderboard", async (req, res): Promise<void> => {
  const challenge = await ensureCurrentChallenge();
  const { start, end } = getWeekBounds();

  const participants = await db
    .select()
    .from(challengeParticipantsTable)
    .where(eq(challengeParticipantsTable.challengeId, challenge.id));

  const leaderboard = await Promise.all(
    participants.map(async (p) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, p.userId));
      if (!user) return null;

      const workouts = await db
        .select()
        .from(workoutsTable)
        .where(eq(workoutsTable.userId, p.userId));

      const weeklyWorkouts = workouts.filter(w => w.date >= start && w.date <= end);
      const weeklyReps = weeklyWorkouts.reduce((sum, w) => sum + w.totalReps, 0);

      const allDates = [...new Set(workouts.map(w => w.date))].sort().reverse();
      let streak = 0;
      const checkDate = new Date();
      for (const d of allDates) {
        if (d === checkDate.toISOString().split("T")[0]) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else break;
      }

      const bestSet = workouts.reduce((best, w) => Math.max(best, w.totalReps), 0);
      const progressScore = weeklyReps + streak * 10 + (bestSet > 0 ? 25 : 0);

      return {
        userId: p.userId,
        name: user.name,
        weeklyReps,
        progressScore,
        fitnessLevel: user.fitnessLevel,
      };
    })
  );

  const sorted = leaderboard
    .filter(Boolean)
    .sort((a, b) => (b!.progressScore - a!.progressScore))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  res.json(sorted);
});

router.post("/challenges/current/join", async (req, res): Promise<void> => {
  const parsed = JoinChallengeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const challenge = await ensureCurrentChallenge();

  const existing = await db
    .select()
    .from(challengeParticipantsTable)
    .where(
      and(
        eq(challengeParticipantsTable.challengeId, challenge.id),
        eq(challengeParticipantsTable.userId, parsed.data.userId)
      )
    );

  if (existing.length === 0) {
    await db.insert(challengeParticipantsTable).values({
      challengeId: challenge.id,
      userId: parsed.data.userId,
    });
  }

  const participants = await db
    .select()
    .from(challengeParticipantsTable)
    .where(eq(challengeParticipantsTable.challengeId, challenge.id));

  res.json({ ...challenge, participantCount: participants.length });
});

export default router;

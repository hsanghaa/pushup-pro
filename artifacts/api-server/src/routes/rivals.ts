import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, rivalsTable } from "@workspace/db";
import { GetUserRivalsParams, GenerateRivalParams, GenerateRivalBody, DeleteRivalParams } from "@workspace/api-zod";

const router: IRouter = Router();

const RIVAL_PERSONAS = [
  { name: "Marcus T.", emoji: "💪", personality: "machine", fitnessLevel: "advanced", baseWeekly: 700, streak: 45 },
  { name: "Sofia K.", emoji: "⚡", personality: "grinder", fitnessLevel: "athlete", baseWeekly: 560, streak: 21 },
  { name: "James W.", emoji: "🎯", personality: "competitor", fitnessLevel: "advanced", baseWeekly: 350, streak: 14 },
  { name: "Priya N.", emoji: "🔥", personality: "comeback_kid", fitnessLevel: "intermediate", baseWeekly: 280, streak: 3 },
  { name: "Tyler B.", emoji: "🌱", personality: "underdog", fitnessLevel: "beginner", baseWeekly: 105, streak: 5 },
  { name: "Chen L.", emoji: "🤖", personality: "machine", fitnessLevel: "athlete", baseWeekly: 840, streak: 87 },
  { name: "Maya R.", emoji: "🏆", personality: "competitor", fitnessLevel: "advanced", baseWeekly: 420, streak: 21 },
  { name: "Diego M.", emoji: "💥", personality: "grinder", fitnessLevel: "intermediate", baseWeekly: 490, streak: 12 },
  { name: "Emma H.", emoji: "🌟", personality: "consistent", fitnessLevel: "intermediate", baseWeekly: 315, streak: 30 },
  { name: "Kai O.", emoji: "⚔️", personality: "competitor", fitnessLevel: "athlete", baseWeekly: 630, streak: 42 },
  { name: "Jordan S.", emoji: "🃏", personality: "weekend_warrior", fitnessLevel: "intermediate", baseWeekly: 200, streak: 2 },
  { name: "Anya P.", emoji: "🌙", personality: "consistent", fitnessLevel: "advanced", baseWeekly: 400, streak: 60 },
  { name: "Ravi C.", emoji: "🦁", personality: "machine", fitnessLevel: "athlete", baseWeekly: 700, streak: 120 },
  { name: "Luna F.", emoji: "💫", personality: "underdog", fitnessLevel: "beginner", baseWeekly: 140, streak: 7 },
  { name: "Noah D.", emoji: "🌊", personality: "comeback_kid", fitnessLevel: "intermediate", baseWeekly: 350, streak: 5 },
  { name: "Zara A.", emoji: "⭐", personality: "grinder", fitnessLevel: "advanced", baseWeekly: 525, streak: 18 },
  { name: "Blake J.", emoji: "🦊", personality: "competitor", fitnessLevel: "intermediate", baseWeekly: 280, streak: 9 },
  { name: "Mia T.", emoji: "🌸", personality: "consistent", fitnessLevel: "beginner", baseWeekly: 175, streak: 14 },
  { name: "Sam G.", emoji: "🚀", personality: "grinder", fitnessLevel: "athlete", baseWeekly: 630, streak: 33 },
  { name: "Leila H.", emoji: "🔮", personality: "machine", fitnessLevel: "advanced", baseWeekly: 588, streak: 75 },
];

const PERSONALITY_LABELS: Record<string, string> = {
  machine: "The Machine",
  grinder: "The Grinder",
  competitor: "The Competitor",
  comeback_kid: "The Comeback Kid",
  underdog: "The Underdog",
  consistent: "The Consistent",
  weekend_warrior: "Weekend Warrior",
};

const PERSONALITY_TAGLINES: Record<string, string> = {
  machine: "Never misses a day. Relentless consistency.",
  grinder: "High volume every session. Doesn't stop.",
  competitor: "Tracks your stats and pushes just past you.",
  comeback_kid: "Takes days off but surges back stronger.",
  underdog: "Just starting out — improving every week.",
  consistent: "5 days a week, no excuses, no drama.",
  weekend_warrior: "Goes hard on weekends, quiet midweek.",
};

function computeLiveWeeklyReps(personality: string, baseWeekly: number): number {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysIntoWeek = dayOfWeek === 0 ? 6 : dayOfWeek;

  switch (personality) {
    case "machine":
    case "consistent":
      return Math.round((baseWeekly / 7) * daysIntoWeek);
    case "grinder":
      return Math.round((baseWeekly / 7) * daysIntoWeek * (0.9 + Math.random() * 0.2));
    case "competitor":
      return Math.round((baseWeekly / 7) * daysIntoWeek);
    case "comeback_kid":
      return daysIntoWeek <= 3 ? Math.round(baseWeekly * 0.15) : Math.round(baseWeekly * 0.8);
    case "underdog":
      return Math.round((baseWeekly / 7) * Math.min(daysIntoWeek, 4));
    case "weekend_warrior":
      return daysIntoWeek >= 5 ? Math.round(baseWeekly * 0.85) : Math.round(baseWeekly * 0.1);
    default:
      return Math.round((baseWeekly / 7) * daysIntoWeek);
  }
}

router.get("/rivals/user/:userId", async (req, res): Promise<void> => {
  const params = GetUserRivalsParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: String(params.error) }); return; }

  const rivals = await db.select().from(rivalsTable).where(eq(rivalsTable.userId, params.data.userId));

  const result = rivals.map(r => ({
    id: r.id,
    userId: r.userId,
    name: r.name,
    avatarEmoji: r.avatarEmoji,
    personality: r.personality,
    personalityLabel: PERSONALITY_LABELS[r.personality] ?? r.personality,
    personalityTagline: PERSONALITY_TAGLINES[r.personality] ?? "",
    fitnessLevel: r.fitnessLevel,
    weeklyReps: computeLiveWeeklyReps(r.personality, r.baseWeeklyReps),
    currentStreak: r.currentStreak,
    createdAt: r.createdAt,
  }));

  res.json(result);
});

router.post("/rivals/user/:userId/generate", async (req, res): Promise<void> => {
  const params = GenerateRivalParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: String(params.error) }); return; }

  const body = GenerateRivalBody.safeParse(req.body);
  const requestedStyle = body.success ? body.data.style : undefined;

  const userId = params.data.userId;
  const existing = await db.select({ name: rivalsTable.name }).from(rivalsTable).where(eq(rivalsTable.userId, userId));
  const existingNames = new Set(existing.map(r => r.name));

  let candidates = RIVAL_PERSONAS.filter(p => !existingNames.has(p.name));
  if (requestedStyle && requestedStyle !== "random") {
    const filtered = candidates.filter(p => p.personality === requestedStyle);
    if (filtered.length > 0) candidates = filtered;
  }

  if (candidates.length === 0) {
    res.status(400).json({ error: "All rival personas have been added already." });
    return;
  }

  const persona = candidates[Math.floor(Math.random() * candidates.length)];

  const [rival] = await db.insert(rivalsTable).values({
    userId,
    name: persona.name,
    avatarEmoji: persona.emoji,
    personality: persona.personality,
    fitnessLevel: persona.fitnessLevel,
    baseWeeklyReps: persona.baseWeekly,
    currentStreak: persona.streak,
  }).returning();

  res.status(201).json({
    id: rival.id,
    userId: rival.userId,
    name: rival.name,
    avatarEmoji: rival.avatarEmoji,
    personality: rival.personality,
    personalityLabel: PERSONALITY_LABELS[rival.personality] ?? rival.personality,
    personalityTagline: PERSONALITY_TAGLINES[rival.personality] ?? "",
    fitnessLevel: rival.fitnessLevel,
    weeklyReps: computeLiveWeeklyReps(rival.personality, rival.baseWeeklyReps),
    currentStreak: rival.currentStreak,
    createdAt: rival.createdAt,
  });
});

router.delete("/rivals/:rivalId", async (req, res): Promise<void> => {
  const params = DeleteRivalParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: String(params.error) }); return; }

  const [deleted] = await db.delete(rivalsTable).where(eq(rivalsTable.id, params.data.rivalId)).returning();
  if (!deleted) { res.status(404).json({ error: "Rival not found" }); return; }

  res.status(204).send();
});

export default router;

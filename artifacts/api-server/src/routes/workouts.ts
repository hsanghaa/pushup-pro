import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, workoutsTable } from "@workspace/db";
import {
  CreateWorkoutBody,
  GetWorkoutParams,
  UpdateWorkoutBody,
  UpdateWorkoutParams,
  GetUserWorkoutsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/workouts", async (req, res): Promise<void> => {
  const parsed = CreateWorkoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const now = new Date();
  const rawDate = parsed.data.date;
  const dateStr = rawDate
    ? rawDate instanceof Date
      ? rawDate.toISOString().split("T")[0]
      : String(rawDate)
    : now.toISOString().split("T")[0];
  const averageReps = parsed.data.sets > 0 ? parsed.data.totalReps / parsed.data.sets : parsed.data.totalReps;

  const [workout] = await db.insert(workoutsTable).values({
    userId: parsed.data.userId,
    date: dateStr,
    totalReps: parsed.data.totalReps,
    verifiedReps: parsed.data.verifiedReps ?? 0,
    unverifiedReps: parsed.data.unverifiedReps ?? 0,
    cameraAngle: parsed.data.cameraAngle ?? null,
    sets: parsed.data.sets,
    averageReps,
    variation: parsed.data.variation,
    usedCamera: parsed.data.usedCamera,
    notes: parsed.data.notes ?? null,
  }).returning();

  res.status(201).json(workout);
});

router.get("/workouts/user/:userId", async (req, res): Promise<void> => {
  const params = GetUserWorkoutsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const workouts = await db
    .select()
    .from(workoutsTable)
    .where(eq(workoutsTable.userId, params.data.userId))
    .orderBy(workoutsTable.date);

  res.json(workouts);
});

router.get("/workouts/:workoutId", async (req, res): Promise<void> => {
  const params = GetWorkoutParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [workout] = await db.select().from(workoutsTable).where(eq(workoutsTable.id, params.data.workoutId));
  if (!workout) {
    res.status(404).json({ error: "Workout not found" });
    return;
  }

  res.json(workout);
});

router.patch("/workouts/:workoutId", async (req, res): Promise<void> => {
  const params = UpdateWorkoutParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateWorkoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.totalReps !== undefined && parsed.data.sets !== undefined) {
    updateData.averageReps = parsed.data.totalReps / parsed.data.sets;
  }

  const [workout] = await db
    .update(workoutsTable)
    .set(updateData)
    .where(eq(workoutsTable.id, params.data.workoutId))
    .returning();

  if (!workout) {
    res.status(404).json({ error: "Workout not found" });
    return;
  }

  res.json(workout);
});

export default router;

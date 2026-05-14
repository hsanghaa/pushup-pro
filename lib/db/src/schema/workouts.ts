import { pgTable, serial, integer, text, boolean, timestamp, date, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const workoutsTable = pgTable("workouts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  date: date("date").notNull(),
  totalReps: integer("total_reps").notNull().default(0),
  sets: integer("sets").notNull().default(1),
  averageReps: real("average_reps").notNull().default(0),
  variation: text("variation").notNull().default("standard"),
  usedCamera: boolean("used_camera").notNull().default(false),
  verifiedReps: integer("verified_reps").notNull().default(0),
  unverifiedReps: integer("unverified_reps").notNull().default(0),
  cameraAngle: text("camera_angle"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWorkoutSchema = createInsertSchema(workoutsTable).omit({ id: true, createdAt: true });
export type InsertWorkout = z.infer<typeof insertWorkoutSchema>;
export type Workout = typeof workoutsTable.$inferSelect;

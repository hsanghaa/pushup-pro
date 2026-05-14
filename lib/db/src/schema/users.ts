import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  fitnessLevel: text("fitness_level").notNull(),
  currentMaxPushups: integer("current_max_pushups").notNull().default(0),
  mainGoal: text("main_goal").notNull(),
  reminderPreference: text("reminder_preference"),
  weeklyAvailabilityDays: integer("weekly_availability_days").notNull().default(3),
  wantsAiGoals: boolean("wants_ai_goals").default(true),
  wantsCompetition: boolean("wants_competition").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

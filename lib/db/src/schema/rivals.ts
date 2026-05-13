import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const rivalsTable = pgTable("rivals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  avatarEmoji: text("avatar_emoji").notNull(),
  personality: text("personality").notNull(),
  fitnessLevel: text("fitness_level").notNull(),
  baseWeeklyReps: integer("base_weekly_reps").notNull().default(0),
  currentStreak: integer("current_streak").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Rival = typeof rivalsTable.$inferSelect;

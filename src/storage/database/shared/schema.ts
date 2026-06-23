import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb, index, serial } from "drizzle-orm/pg-core";

// ─── System table (DO NOT DELETE) ───
export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// ─── Daily Reviews ───
export const dailyReviews = pgTable(
  "daily_reviews",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    day: integer("day").notNull(),
    completed: text("completed").default(''),
    good_things: text("good_things").default(''),
    problems: text("problems").default(''),
    mood: text("mood").default(''),
    reflections: text("reflections").default(''),
    tomorrow_todo: text("tomorrow_todo").default(''),
    mood_score: integer("mood_score").default(3),
    energy: integer("energy").default(3),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("daily_reviews_date_idx").on(table.year, table.month, table.day),
  ]
);

// ─── OKR Objectives ───
export const okrObjectives = pgTable(
  "okr_objectives",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    title: text("title").notNull(),
    period: varchar("period", { length: 50 }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("okr_objectives_period_idx").on(table.period),
  ]
);

// ─── OKR Key Results ───
export const okrKeyResults = pgTable(
  "okr_key_results",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    objective_id: varchar("objective_id", { length: 36 }).notNull().references(() => okrObjectives.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    target_value: integer("target_value").default(1),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("okr_key_results_objective_id_idx").on(table.objective_id),
  ]
);

// ─── OKR Tasks ───
export const okrTasks = pgTable(
  "okr_tasks",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    key_result_id: varchar("key_result_id", { length: 36 }).notNull().references(() => okrKeyResults.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    done: integer("done", { mode: 'boolean' }).default(false).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("okr_tasks_key_result_id_idx").on(table.key_result_id),
  ]
);

// ─── Day View Events ───
export const dayEvents = pgTable(
  "day_events",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    day: integer("day").notNull(),
    title: text("title").notNull(),
    start_hour: integer("start_hour").default(0),
    start_min: integer("start_min").default(0),
    end_hour: integer("end_hour").default(0),
    end_min: integer("end_min").default(0),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("day_events_date_idx").on(table.year, table.month, table.day),
  ]
);

// ─── Day View Todos ───
export const dayTodos = pgTable(
  "day_todos",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    day: integer("day").notNull(),
    text: text("text").notNull(),
    done: integer("done", { mode: 'boolean' }).default(false).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("day_todos_date_idx").on(table.year, table.month, table.day),
  ]
);

// ─── Calendar Overrides (satisfaction check/cross) ───
export const calendarOverrides = pgTable(
  "calendar_overrides",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    year: integer("year").notNull(),
    date_key: varchar("date_key", { length: 20 }).notNull(),
    value: varchar("value", { length: 20 }).notNull(),
  },
  (table) => [
    index("calendar_overrides_year_idx").on(table.year),
    index("calendar_overrides_date_key_idx").on(table.date_key),
  ]
);

// ─── Calendar Notes ───
export const calendarNotes = pgTable(
  "calendar_notes",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    year: integer("year").notNull(),
    date_key: varchar("date_key", { length: 20 }).notNull(),
    content: text("content").default(''),
  },
  (table) => [
    index("calendar_notes_year_idx").on(table.year),
    index("calendar_notes_date_key_idx").on(table.date_key),
  ]
);

// ─── Month Reviews ───
export const monthReviews = pgTable(
  "month_reviews",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    section_key: varchar("section_key", { length: 20 }).notNull(),
    content: text("content").default(''),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("month_reviews_date_idx").on(table.year, table.month),
  ]
);

// ─── Calendar Drawings ───
export const calendarDrawings = pgTable(
  "calendar_drawings",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    year: integer("year").notNull(),
    strokes: jsonb("strokes").default([]),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  }
);

import { pgTable, uuid, varchar, integer, text, serial, timestamp, uniqueIndex, index, foreignKey, boolean, jsonb, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const calendarNotes = pgTable("calendar_notes", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	year: integer().notNull(),
	dateKey: varchar("date_key", { length: 20 }).notNull(),
	content: text().default('),
});

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const calendarOverrides = pgTable("calendar_overrides", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	year: integer().notNull(),
	dateKey: varchar("date_key", { length: 20 }).notNull(),
	value: varchar({ length: 20 }).notNull(),
});

export const dailyReviews = pgTable("daily_reviews", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	year: integer().notNull(),
	month: integer().notNull(),
	day: integer().notNull(),
	completed: text().default('),
	goodThings: text("good_things").default('),
	problems: text().default('),
	mood: text().default('),
	reflections: text().default('),
	tomorrowTodo: text("tomorrow_todo").default('),
	moodScore: integer("mood_score").default(3),
	energy: integer().default(3),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	uniqueIndex("daily_reviews_date_unique").using("btree", table.year.asc().nullsLast().op("int4_ops"), table.month.asc().nullsLast().op("int4_ops"), table.day.asc().nullsLast().op("int4_ops")),
]);

export const dayEvents = pgTable("day_events", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	year: integer().notNull(),
	month: integer().notNull(),
	day: integer().notNull(),
	title: text().notNull(),
	startHour: integer("start_hour").default(0),
	startMin: integer("start_min").default(0),
	endHour: integer("end_hour").default(0),
	endMin: integer("end_min").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const okrObjectives = pgTable("okr_objectives", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	title: text().notNull(),
	period: varchar({ length: 50 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("okr_objectives_period_idx").using("btree", table.period.asc().nullsLast().op("text_ops")),
]);

export const okrKeyResults = pgTable("okr_key_results", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	objectiveId: varchar("objective_id", { length: 36 }).notNull(),
	title: text().notNull(),
	targetValue: integer("target_value").default(1),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("okr_key_results_objective_id_idx").using("btree", table.objectiveId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.objectiveId],
			foreignColumns: [okrObjectives.id],
			name: "okr_key_results_objective_id_fkey"
		}).onDelete("cascade"),
]);

export const okrTasks = pgTable("okr_tasks", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	keyResultId: varchar("key_result_id", { length: 36 }).notNull(),
	title: text().notNull(),
	done: boolean().default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	plannedYear: integer("planned_year"),
	plannedMonth: integer("planned_month"),
	plannedDay: integer("planned_day"),
}, (table) => [
	index("okr_tasks_key_result_id_idx").using("btree", table.keyResultId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.keyResultId],
			foreignColumns: [okrKeyResults.id],
			name: "okr_tasks_key_result_id_fkey"
		}).onDelete("cascade"),
]);

export const dayTodos = pgTable("day_todos", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	year: integer().notNull(),
	month: integer().notNull(),
	day: integer().notNull(),
	text: text().notNull(),
	done: boolean().default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("day_todos_date_idx").using("btree", table.year.asc().nullsLast().op("int4_ops"), table.month.asc().nullsLast().op("int4_ops"), table.day.asc().nullsLast().op("int4_ops")),
]);

export const monthReviews = pgTable("month_reviews", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	year: integer().notNull(),
	month: integer().notNull(),
	sectionKey: varchar("section_key", { length: 20 }).notNull(),
	content: text().default('),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("month_reviews_date_idx").using("btree", table.year.asc().nullsLast().op("int4_ops"), table.month.asc().nullsLast().op("int4_ops")),
]);

export const calendarDrawings = pgTable("calendar_drawings", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	year: integer().notNull(),
	strokes: jsonb().default([]),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	uniqueIndex("calendar_drawings_year_idx").using("btree", table.year.asc().nullsLast().op("int4_ops")),
]);

export const customLinks = pgTable("custom_links", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").default('default'),
	title: text().notNull(),
	url: text().notNull(),
	sortOrder: integer("sort_order").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// ─── User Key-Value Store (login user's localStorage data synced to DB) ───
// 通用键值存储：登录用户的所有 localStorage 数据通过 key-value 形式持久化到数据库
// user_id 直接关联 supabase auth.users，登录后通过 RLS 自动隔离
export const userKvStore = pgTable("user_kv_store", {
	userId: uuid("user_id").notNull(),
	key: text().notNull(),
	value: jsonb().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	primaryKey({ columns: [table.userId, table.key] }),
	index("user_kv_store_user_id_idx").using("btree", table.userId.asc().nullsLast()),
]);

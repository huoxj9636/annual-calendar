import { pgTable, serial, timestamp, index, uniqueIndex, pgPolicy, varchar, integer, text, foreignKey, numeric, boolean, jsonb, primaryKey, uuid } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const calendarOverrides = pgTable("calendar_overrides", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	year: integer().notNull(),
	dateKey: varchar("date_key", { length: 20 }).notNull(),
	value: varchar({ length: 20 }).notNull(),
	userId: text("user_id").notNull(),
}, (table) => [
	index("idx_calendar_overrides_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	uniqueIndex("uniq_calendar_overrides_user_year_date").using("btree", table.userId.asc().nullsLast().op("int4_ops"), table.year.asc().nullsLast().op("int4_ops"), table.dateKey.asc().nullsLast().op("int4_ops")),
	pgPolicy("calendar_overrides_用户私有", { as: "permissive", for: "all", to: ["public"], using: sql`((user_id = 'legacy'::text) OR ((( SELECT auth.uid() AS uid))::text = user_id))`, withCheck: sql`((( SELECT auth.uid() AS uid))::text = user_id)`  }),
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
	userId: text("user_id").notNull(),
	color: text(),
	eventType: text("event_type"),
	notes: text(),
	priority: text(),
}, (table) => [
	index("idx_day_events_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	pgPolicy("day_events_用户私有", { as: "permissive", for: "all", to: ["public"], using: sql`((user_id = 'legacy'::text) OR ((( SELECT auth.uid() AS uid))::text = user_id))`, withCheck: sql`((( SELECT auth.uid() AS uid))::text = user_id)`  }),
]);

export const okrObjectives = pgTable("okr_objectives", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	title: text().notNull(),
	period: varchar({ length: 50 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	userId: text("user_id").notNull(),
}, (table) => [
	index("idx_okr_objectives_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	index("okr_objectives_period_idx").using("btree", table.period.asc().nullsLast().op("text_ops")),
	pgPolicy("okr_objectives_用户私有", { as: "permissive", for: "all", to: ["public"], using: sql`((user_id = 'legacy'::text) OR ((( SELECT auth.uid() AS uid))::text = user_id))`, withCheck: sql`((( SELECT auth.uid() AS uid))::text = user_id)`  }),
]);

export const okrKeyResults = pgTable("okr_key_results", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	objectiveId: varchar("objective_id", { length: 36 }).notNull(),
	title: text().notNull(),
	targetValue: integer("target_value").default(1),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	userId: text("user_id").notNull(),
	progress: numeric().default('0'),
}, (table) => [
	index("idx_okr_key_results_objective_id").using("btree", table.objectiveId.asc().nullsLast().op("text_ops")),
	index("idx_okr_key_results_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	index("okr_key_results_objective_id_idx").using("btree", table.objectiveId.asc().nullsLast().op("text_ops")),
	uniqueIndex("uniq_okr_key_results_user_obj_kr").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.objectiveId.asc().nullsLast().op("text_ops"), table.id.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.objectiveId],
			foreignColumns: [okrObjectives.id],
			name: "okr_key_results_objective_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("okr_key_results_用户私有", { as: "permissive", for: "all", to: ["public"], using: sql`((user_id = 'legacy'::text) OR ((( SELECT auth.uid() AS uid))::text = user_id))`, withCheck: sql`((( SELECT auth.uid() AS uid))::text = user_id)`  }),
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
	userId: text("user_id").notNull(),
	status: text().default('pending'),
	objectiveId: text("objective_id"),
}, (table) => [
	index("idx_okr_tasks_key_result_id").using("btree", table.keyResultId.asc().nullsLast().op("text_ops")),
	index("idx_okr_tasks_objective_id").using("btree", table.objectiveId.asc().nullsLast().op("text_ops")),
	index("idx_okr_tasks_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	index("idx_okr_tasks_user_kr_id").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.keyResultId.asc().nullsLast().op("text_ops")),
	index("okr_tasks_key_result_id_idx").using("btree", table.keyResultId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.keyResultId],
			foreignColumns: [okrKeyResults.id],
			name: "okr_tasks_key_result_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("okr_tasks_用户私有", { as: "permissive", for: "all", to: ["public"], using: sql`((user_id = 'legacy'::text) OR ((( SELECT auth.uid() AS uid))::text = user_id))`, withCheck: sql`((( SELECT auth.uid() AS uid))::text = user_id)`  }),
]);

export const monthReviews = pgTable("month_reviews", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	year: integer().notNull(),
	month: integer().notNull(),
	sectionKey: varchar("section_key", { length: 20 }).notNull(),
	content: text().default('),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	userId: text("user_id").notNull(),
}, (table) => [
	index("idx_month_reviews_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	index("month_reviews_date_idx").using("btree", table.year.asc().nullsLast().op("int4_ops"), table.month.asc().nullsLast().op("int4_ops")),
	uniqueIndex("uniq_month_reviews_user_year_month_section").using("btree", table.userId.asc().nullsLast().op("int4_ops"), table.year.asc().nullsLast().op("int4_ops"), table.month.asc().nullsLast().op("int4_ops"), table.sectionKey.asc().nullsLast().op("int4_ops")),
	pgPolicy("month_reviews_用户私有", { as: "permissive", for: "all", to: ["public"], using: sql`((user_id = 'legacy'::text) OR ((( SELECT auth.uid() AS uid))::text = user_id))`, withCheck: sql`((( SELECT auth.uid() AS uid))::text = user_id)`  }),
]);

export const calendarDrawings = pgTable("calendar_drawings", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	year: integer().notNull(),
	strokes: jsonb().default([]),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	userId: text("user_id").notNull(),
	dateKey: text("date_key"),
}, (table) => [
	uniqueIndex("calendar_drawings_user_year_unique").using("btree", table.userId.asc().nullsLast().op("int4_ops"), table.year.asc().nullsLast().op("int4_ops")),
	index("idx_calendar_drawings_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	uniqueIndex("uniq_calendar_drawings_user_year_date").using("btree", table.userId.asc().nullsLast().op("int4_ops"), table.year.asc().nullsLast().op("int4_ops"), table.dateKey.asc().nullsLast().op("int4_ops")),
	pgPolicy("calendar_drawings_用户私有", { as: "permissive", for: "all", to: ["public"], using: sql`((user_id = 'legacy'::text) OR ((( SELECT auth.uid() AS uid))::text = user_id))`, withCheck: sql`((( SELECT auth.uid() AS uid))::text = user_id)`  }),
]);

export const calendarNotes = pgTable("calendar_notes", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	year: integer().notNull(),
	dateKey: varchar("date_key", { length: 20 }).notNull(),
	content: text().default('),
	userId: text("user_id").notNull(),
}, (table) => [
	index("idx_calendar_notes_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	uniqueIndex("uniq_calendar_notes_user_year_date").using("btree", table.userId.asc().nullsLast().op("int4_ops"), table.year.asc().nullsLast().op("int4_ops"), table.dateKey.asc().nullsLast().op("int4_ops")),
	pgPolicy("calendar_notes_用户私有", { as: "permissive", for: "all", to: ["public"], using: sql`((user_id = 'legacy'::text) OR ((( SELECT auth.uid() AS uid))::text = user_id))`, withCheck: sql`((( SELECT auth.uid() AS uid))::text = user_id)`  }),
]);

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
	userId: text("user_id").notNull(),
}, (table) => [
	uniqueIndex("daily_reviews_user_year_month_day_unique").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.year.asc().nullsLast().op("text_ops"), table.month.asc().nullsLast().op("int4_ops"), table.day.asc().nullsLast().op("int4_ops")),
	index("idx_daily_reviews_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	pgPolicy("daily_reviews_用户私有", { as: "permissive", for: "all", to: ["public"], using: sql`((user_id = 'legacy'::text) OR ((( SELECT auth.uid() AS uid))::text = user_id))`, withCheck: sql`((( SELECT auth.uid() AS uid))::text = user_id)`  }),
]);

export const dayTodos = pgTable("day_todos", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	year: integer().notNull(),
	month: integer().notNull(),
	day: integer().notNull(),
	text: text().notNull(),
	done: boolean().default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	userId: text("user_id").notNull(),
	content: text(),
	priority: text(),
}, (table) => [
	index("day_todos_date_idx").using("btree", table.year.asc().nullsLast().op("int4_ops"), table.month.asc().nullsLast().op("int4_ops"), table.day.asc().nullsLast().op("int4_ops")),
	index("idx_day_todos_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	pgPolicy("day_todos_用户私有", { as: "permissive", for: "all", to: ["public"], using: sql`((user_id = 'legacy'::text) OR ((( SELECT auth.uid() AS uid))::text = user_id))`, withCheck: sql`((( SELECT auth.uid() AS uid))::text = user_id)`  }),
]);

export const customLinks = pgTable("custom_links", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").default('default').notNull(),
	title: text().notNull(),
	url: text().notNull(),
	sortOrder: integer("sort_order").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_custom_links_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	pgPolicy("custom_links_用户私有", { as: "permissive", for: "all", to: ["public"], using: sql`((user_id = 'legacy'::text) OR ((( SELECT auth.uid() AS uid))::text = user_id))`, withCheck: sql`((( SELECT auth.uid() AS uid))::text = user_id)`  }),
]);

export const userKvStore = pgTable("user_kv_store", {
	userId: uuid("user_id").notNull(),
	key: text().notNull(),
	value: jsonb().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("user_kv_store_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	primaryKey({ columns: [table.userId, table.key], name: "user_kv_store_pkey"}),
	pgPolicy("user_kv_store_用户私有_全操作", { as: "permissive", for: "all", to: ["public"], using: sql`(( SELECT auth.uid() AS uid) = user_id)`, withCheck: sql`(( SELECT auth.uid() AS uid) = user_id)`  }),
]);

export const knowledgeTrees = pgTable("knowledge_trees", {
	id: varchar({ length: 36 }).default(gen_random_uuid()).primaryKey().notNull(),
	name: text().notNull(),
	industry: text().notNull(),
	description: text(),
	species: varchar({ length: 32 }).default('oak').notNull(),
	link: text(),
	positionX: integer("position_x").default(50).notNull(),
	positionY: integer("position_y").default(50).notNull(),
	scale: integer().default(100).notNull(),
	nodes: jsonb().default([]).notNull(),
	nodeCount: integer("node_count").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

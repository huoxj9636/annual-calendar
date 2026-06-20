import { z } from 'zod';

// ─── 通用 ───
export const yearSchema = z.coerce.number().int().min(1900).max(2200);
export const monthSchema = z.coerce.number().int().min(1).max(12);
export const daySchema = z.coerce.number().int().min(1).max(31);

// ─── calendar-data ───
// 前端实际传参: { type: 'overrides'|'notes'|'month_reviews'|'drawings'|'drawings', year, data: {...} }
// 或 { type: 'month_reviews', year, month, data: {...} }
const overridesValue = z.union([z.string(), z.array(z.unknown())]);
const notesValue = z.string();
const drawingsValue = z.object({
  strokes: z.array(z.array(z.unknown())).max(5000),
  color: z.string().max(50).optional(),
}).passthrough();

const monthReviewData = z.object({
  summary: z.string().max(5000).optional(),
  highlights: z.array(z.string()).max(100).optional(),
  challenges: z.array(z.string()).max(100).optional(),
  nextMonthFocus: z.array(z.string()).max(100).optional(),
  satisfaction: z.number().min(0).max(10).optional(),
}).passthrough();

export const calendarDataSchema = z.union([
  // overrides: data is { "month-day": "checked" | "crossed" }
  z.object({ type: z.literal('overrides'), year: yearSchema, data: z.record(z.string(), overridesValue) }).passthrough(),
  // notes: data is { "month-day": "text" }
  z.object({ type: z.literal('notes'), year: yearSchema, data: z.record(z.string(), notesValue) }).passthrough(),
  // drawings: data is { "month-day": { strokes, color } }
  z.object({ type: z.literal('drawings'), year: yearSchema, data: z.record(z.string(), drawingsValue) }).passthrough(),
  // month_reviews: data is the review object
  z.object({ type: z.literal('month_reviews'), year: yearSchema, month: monthSchema, data: monthReviewData }).passthrough(),
]);

// ─── daily-review ───
// 前端传: { year, month, day, completed, goodThings, problems, mood, moodScore, energy, reflections, tomorrowTodo }
const dailyReviewBody = z.object({
  year: yearSchema,
  month: monthSchema,
  day: daySchema,
  completed: z.union([z.boolean(), z.string()]).optional(),
  goodThings: z.string().max(5000).optional(),
  problems: z.string().max(5000).optional(),
  mood: z.string().max(100).optional(),
  moodScore: z.number().int().min(0).max(10).optional(),
  energy: z.number().int().min(0).max(10).optional(),
  reflections: z.string().max(5000).optional(),
  tomorrowTodo: z.string().max(5000).optional(),
}).passthrough();

export const dailyReviewSchema = dailyReviewBody;

// ─── day-data ───
// 前端传: { type: 'events'|'todos'|'note', year, month, day, data: ... }
export const dayDataSchema = z.object({
  year: yearSchema,
  month: monthSchema,
  day: daySchema,
  type: z.enum(['events', 'todos', 'note']).optional(),
  data: z.unknown().optional(),
}).passthrough();

// ─── okr ───
// 前端传: { objectives: [...] } 或 { action, ... } 兼容老格式
const okrTask = z.object({
  id: z.string().min(1).max(100),
  title: z.string().max(500).optional(),
  status: z.string().max(50).optional(),
  done: z.boolean().optional(),
}).passthrough();

const okrKeyResult = z.object({
  id: z.string().min(1).max(100),
  title: z.string().max(500).optional(),
  progress: z.number().min(0).max(1).optional(),
  tasks: z.array(okrTask).max(500).optional(),
}).passthrough();

const okrObjective = z.object({
  id: z.string().min(1).max(100),
  title: z.string().max(500).optional(),
  period: z.string().max(50).optional(),
  children: z.array(okrKeyResult).max(100).optional(),
  tasks: z.array(okrTask).max(500).optional(),
}).passthrough();

const okrBody = z.union([
  // 1) 整树 upsert: { objectives: [...] }
  z.object({ objectives: z.array(okrObjective).max(200) }).passthrough(),
  // 2) 兼容老格式: { action, objective | tasks | ... }
  z.object({ action: z.string().max(50) }).passthrough(),
]);

export const okrSchema = okrBody;

// ─── user-data ───
// POST: { items: [{ key, value }] }
const userDataItem = z.object({
  key: z.string().min(1).max(200),
  value: z.unknown(),
});

export const userDataPostSchema = z.object({
  items: z.array(userDataItem).max(500),
}).passthrough();

export const userDataDeleteSchema = z.object({
  keys: z.array(z.string().min(1).max(200)).min(1).max(500),
}).passthrough();

// ─── migrate-legacy ───
// POST: { action: 'claim' | 'clear' }
export const migrateLegacyPostSchema = z.object({
  action: z.enum(['claim', 'clear']),
}).passthrough();

// ─── add-day-events ───
// POST: { year, month, day, events: [...], todos?: [...] }
const addDayEvent = z.object({
  id: z.string().min(1).max(200).optional(),
  title: z.string().min(1).max(500),
  startHour: z.number().int().min(0).max(23).optional(),
  startMin: z.number().int().min(0).max(59).optional(),
  endHour: z.number().int().min(0).max(23).optional(),
  endMin: z.number().int().min(0).max(59).optional(),
}).passthrough();

const addDayTodo = z.object({
  id: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(2000).optional(),
  text: z.string().min(1).max(2000).optional(),
  priority: z.string().max(20).optional(),
  done: z.boolean().optional(),
}).passthrough();

export const addDayEventsSchema = z.object({
  year: yearSchema,
  month: monthSchema,
  day: daySchema,
  events: z.array(addDayEvent).max(500).optional(),
  todos: z.array(addDayTodo).max(500).optional(),
}).passthrough();

// ─── okr delete ───
// POST: { action: 'delete', ids: { objectives: [...], keyResults: [...], tasks: [...] } }
export const okrDeleteSchema = z.object({
  action: z.literal('delete'),
  ids: z.object({
    objectives: z.array(z.string()).optional(),
    keyResults: z.array(z.string()).optional(),
    tasks: z.array(z.string()).optional(),
  }).optional(),
}).passthrough();

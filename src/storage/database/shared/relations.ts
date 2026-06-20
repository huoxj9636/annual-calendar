import { relations } from "drizzle-orm/relations";
import { okrObjectives, okrKeyResults, okrTasks } from "./schema";

export const okrKeyResultsRelations = relations(okrKeyResults, ({one, many}) => ({
	okrObjective: one(okrObjectives, {
		fields: [okrKeyResults.objectiveId],
		references: [okrObjectives.id]
	}),
	okrTasks: many(okrTasks),
}));

export const okrObjectivesRelations = relations(okrObjectives, ({many}) => ({
	okrKeyResults: many(okrKeyResults),
}));

export const okrTasksRelations = relations(okrTasks, ({one}) => ({
	okrKeyResult: one(okrKeyResults, {
		fields: [okrTasks.keyResultId],
		references: [okrKeyResults.id]
	}),
}));
import { z } from "zod";

export const createTaskSchema = z.object({
  assignmentId: z.string(),
  name: z.string().min(1, "Task name should need to be more than 1 character"),
  description: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional().default("TODO"),
  attachmentUrl: z.string().optional(),
  attachmentName: z.string().optional(),
});

export const updateTaskSchema = createTaskSchema.partial();

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;

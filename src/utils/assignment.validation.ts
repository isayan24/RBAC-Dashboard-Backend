import { z } from "zod";

export const createAssignmentSchema = z.object({
  projectId: z.string(),
  userId: z.string(),
  name: z
    .string()
    .min(1, "Assignment name should need to be more than 1 character"),
  description: z.string().optional(),
});

export const updateAssignmentSchema = createAssignmentSchema.partial();

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignment = z.infer<typeof updateAssignmentSchema>;

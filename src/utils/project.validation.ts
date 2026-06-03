import { z } from "zod";

export const createProject = z.object({
  name: z
    .string()
    .min(1, "Project name should need to be more than 1 character")
    .max(100, "Project name cannot exceed 100 characters"),
  description: z
    .string()
    .max(500, "Description cannot exceed 500 characters")
    .optional(),
  image: z.string().optional(),
});
export const updateProject = createProject.partial();

export type CreateProjectInput = z.infer<typeof createProject>;
export type UpdateProjectInput = z.infer<typeof updateProject>;

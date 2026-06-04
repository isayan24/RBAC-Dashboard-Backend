import { Response, Request } from "express";
import { ZodError } from "zod";
import prisma from "../utils/db";
import { handleError } from "../libs/handleError";
import { handleSuccess } from "../libs/handleSuccess";
import {
  RequestWithUser,
  authenticateCheck,
} from "../middlewares/auth.middleware";
import {
  createAssignmentSchema,
  updateAssignmentSchema,
} from "../utils/assignment.validation";

// Create a new Project Assignment
export const createAssignment = async (req: RequestWithUser, res: Response) => {
  try {
    const validatedData = createAssignmentSchema.parse(req.body);
    const { name, projectId, userId, description } = validatedData;

    // Verify parent project exists
    const projectExists = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!projectExists) {
      return handleError(res, 404, "Target project not found in database.");
    }

    // Verify target user (Staff) exists
    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) {
      return handleError(
        res,
        404,
        "Target staff member not found in database.",
      );
    }

    const assignment = await prisma.assignment.create({
      data: {
        projectId,
        userId,
        name,
        description,
      },
    });

    return handleSuccess(
      res,
      201,
      "Assignment created successfully!",
      assignment,
    );
  } catch (error: any) {
    return handleError(res, 500, error.message || "Internal Server Error");
  }
};

// Fetch a single Assignment detail
export const getAssignment = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return handleError(res, 400, "Assignment ID is required.");
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            name: true,
            description: true,
            image: true,
          },
        },
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        tasks: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!assignment) {
      return handleError(res, 404, "No assignment found with this id.");
    }

    return handleSuccess(
      res,
      200,
      "Assignment fetched successfully!",
      assignment,
    );
  } catch (error: any) {
    return handleError(res, 500, error.message || "Internal Server Error");
  }
};

// Get all Assignments (ADMIN can seee all, STAFF sees only their own
export const getAllAssignments = async (
  req: RequestWithUser,
  res: Response,
) => {
  try {
    if (!req.user) {
      return handleError(res, 401, "User is not authenticated.");
    }

    const search = (req.query.search as string) || "";

    const projectId = req.query.projectId as string;
    const filterUserId = req.query.userId as string;
    const taskStatus = req.query.taskStatus as string;

    // STAFF can only see their own assignments. Admins can view all or filter by staff.
    const userId = req.user.role === "STAFF" ? req.user.userId : filterUserId;

    const filterFOrmat: any = {};

    if (userId) filterFOrmat.userId = userId;
    if (projectId) filterFOrmat.projectId = projectId;

    if (search) {
      filterFOrmat.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (taskStatus && ["TODO", "IN_PROGRESS", "DONE"].includes(taskStatus)) {
      filterFOrmat.tasks = {
        some: {
          status: taskStatus,
        },
      };
    }

    // Counting total items nd assignments
    const [totalItems, assignments] = await Promise.all([
      prisma.assignment.count({ where: filterFOrmat }),

      prisma.assignment.findMany({
        where: filterFOrmat,
        include: {
          project: {
            select: {
              name: true,
              description: true,
            },
          },
          user: {
            select: {
              name: true,
              email: true,
            },
          },
          tasks: {
            select: {
              id: true,
              status: true,
            },
          },
          _count: {
            select: { tasks: true },
          },
        },
      }),
    ]);

    // calculating assignment completion rate
    const assignmentSort = assignments.map((a) => {
      const total = a.tasks.length;
      const completed = a.tasks.filter((t: any) => t.status === "DONE").length;
      const completionRate = total > 0 ? completed / total : 0;
      const { tasks, ...rest } = a;
      return {
        ...rest,
        completionRate,
      };
    });

    // Sort by completion rate descending, fallback to createdAt ascending
    assignmentSort.sort((a, b) => {
      if (b.completionRate !== a.completionRate) {
        return b.completionRate - a.completionRate;
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    return handleSuccess(res, 200, "Assignments retrieved successfully!", {
      totalItems,
      assignments: assignmentSort,
    });
  } catch (error: any) {
    return handleError(res, 500, error.message || "Internal Server Error");
  }
};

export const updateAssignment = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return handleError(res, 400, "Assignment ID is required.");
    }

    // Verify assignment exists in DB
    const existingAssignment = await prisma.assignment.findUnique({
      where: { id },
    });
    if (!existingAssignment) {
      return handleError(res, 404, "Assignment not found with this id");
    }

    // Validate request body
    const validatedData = updateAssignmentSchema.parse(req.body);
    const { projectId, userId } = validatedData;

    // If changing project, verify new project exists
    if (projectId) {
      const projectExists = await prisma.project.findUnique({
        where: { id: projectId },
      });
      if (!projectExists) {
        return handleError(res, 404, "Project not found in database.");
      }
    }

    // If reassigning, verify new staff member exists
    if (userId) {
      const userExists = await prisma.user.findUnique({
        where: { id: userId },
      });
      if (!userExists) {
        return handleError(
          res,
          404,
          "Target staff member not found in database.",
        );
      }
    }

    const updatedAssignment = await prisma.assignment.update({
      where: { id },
      data: validatedData,
    });

    return handleSuccess(
      res,
      200,
      "Assignment updated successfully!",
      updatedAssignment,
    );
  } catch (error: any) {
    if (error instanceof ZodError) {
      return handleError(res, 400, "Validation Error", error);
    }
    return handleError(res, 500, error.message || "Internal Server Error");
  }
};

// Delete an Assignment and all its tasks
export const deleteAssignment = async (req: RequestWithUser, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return handleError(res, 400, "Assignment ID is required.");
    }

    const existingAssignment = await prisma.assignment.findUnique({
      where: { id },
    });
    if (!existingAssignment) {
      return handleError(res, 404, "Assignment not found with this id.");
    }

    await prisma.assignment.delete({ where: { id } });

    return handleSuccess(
      res,
      200,
      "Assignment successfully deleted from database.",
    );
  } catch (error: any) {
    return handleError(res, 500, error.message || "Internal Server Error");
  }
};

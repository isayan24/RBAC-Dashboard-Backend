import { Response } from "express";
import prisma from "../utils/db";
import { RequestWithUser } from "../middlewares/auth.middleware";
import { handleError } from "../libs/handleError";
import { handleSuccess } from "../libs/handleSuccess";

export const getDashboardAnalytics = async (
  req: RequestWithUser,
  res: Response,
) => {
  try {
    if (!req.user) {
      return handleError(res, 401, "User is not authenticated.");
    }

    const { userId, role } = req.user;
    let projects: any[] = [];

    // Fetch projects, assignments, and tasks based on user role
    if (role === "STAFF") {
      projects = await prisma.project.findMany({
        where: {
          assignments: {
            some: {
              userId: userId,
            },
          },
        },
        include: {
          assignments: {
            where: {
              userId: userId,
            },
            include: {
              tasks: true,
            },
          },
        },
      });
    } else {
      // ADMIN role sees all projects, assignments, and tasks
      projects = await prisma.project.findMany({
        include: {
          assignments: {
            include: {
              tasks: true,
            },
          },
        },
      });
    }

    // analytics counting
    let completedProjects = 0;
    let pendingProjects = 0;

    let totalAssignments = 0;
    let totalTasks = 0;
    let completedTasks = 0;
    let pendingTasks = 0;

    let todoCount = 0;
    let inProgressCount = 0;
    let doneCount = 0;

    // anlyze per project and overall totals
    const projectBreakdown = projects.map((project) => {
      const projAssignmentsCount = project.assignments.length;
      let projTasksCount = 0;
      let projCompletedTasksCount = 0;

      // first count project tasks
      project.assignments.forEach((assignment: any) => {
        projTasksCount += assignment.tasks.length;
        assignment.tasks.forEach((task: any) => {
          if (task.status === "DONE") {
            projCompletedTasksCount++;
          }
        });
      });

      const projPendingTasksCount = projTasksCount - projCompletedTasksCount;

      // Project is fully done if it has tasks/assignments and all tasks are completed
      const isProjectCompleted =
        projTasksCount > 0 && projCompletedTasksCount === projTasksCount;

      if (isProjectCompleted) {
        completedProjects++;
      } else {
        pendingProjects++;
      }

      // Add to overall totals
      totalAssignments += projAssignmentsCount;
      totalTasks += projTasksCount;
      completedTasks += projCompletedTasksCount;
      pendingTasks += projPendingTasksCount;

      project.assignments.forEach((assignment: any) => {
        assignment.tasks.forEach((task: any) => {
          if (task.status === "TODO") {
            todoCount++;
          } else if (task.status === "IN_PROGRESS") {
            inProgressCount++;
          } else if (task.status === "DONE") {
            doneCount++;
          }
        });
      });

      const progressPercentage =
        projTasksCount > 0
          ? Math.round((projCompletedTasksCount / projTasksCount) * 100)
          : 0;

      return {
        id: project.id,
        name: project.name,
        description: project.description,
        image: project.image,
        totalAssignments: projAssignmentsCount,
        totalTasks: projTasksCount,
        completedTasks: projCompletedTasksCount,
        pendingTasks: projPendingTasksCount,
        isCompleted: isProjectCompleted,
        progressPercentage,
      };
    });

    const analyticsData = {
      summary: {
        totalProjects: projects.length,
        completedProjects,
        pendingProjects,
        totalAssignments,
        totalTasks,
        completedTasks,
        pendingTasks,
        taskStatusBreakdown: {
          TODO: todoCount,
          IN_PROGRESS: inProgressCount,
          DONE: doneCount,
        },
      },
      projects: projectBreakdown,
    };

    return handleSuccess(
      res,
      200,
      "Dashboard analytics fetched successfully!",
      analyticsData,
    );
  } catch (error: any) {
    return handleError(res, 500, error.message || "Failed to fetch analytics");
  }
};

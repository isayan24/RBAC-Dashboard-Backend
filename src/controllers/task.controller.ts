import { Request, Response } from "express";
import { ZodError } from "zod";
import { handleError } from "../libs/handleError";
import { createTaskSchema, updateTaskSchema } from "../utils/task.validation";
import prisma from "../utils/db";
import { handleSuccess } from "../libs/handleSuccess";
import { uploadToCloudinary } from "../libs/cloudinary";

export const createTaskController = async (req: Request, res: Response) => {
  try {
    const validatedTask = createTaskSchema.parse(req.body);

    let attachmentUrl: string | undefined = undefined;
    let attachmentName: string | undefined = undefined;
    const file = req.file;

    if (file) {
      const uploadResult = await uploadToCloudinary(file.buffer, file.mimetype, "task_attachments");
      attachmentUrl = uploadResult.url;
      attachmentName = file.originalname;
    }

    const task = await prisma.task.create({
      data: {
        ...validatedTask,
        attachmentUrl,
        attachmentName,
      },
      include: {
        assignment: {
          select: {
            name: true,
            description: true,
          },
        },
      },
    });

    return handleSuccess(res, 201, "Task created successfully", task);
  } catch (error: any) {
    if (error instanceof ZodError) {
      return handleError(
        res,
        400,
        "Validation Error",
        error.errors.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      );
    }
    return handleError(res, 500, error.message || "Internal Server Error");
  }
};

export const getTaskByIdController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return handleError(res, 400, "No task id provided!");
    }

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignment: {
          select: {
            name: true,
            description: true,
          },
        },
      },
    });

    if (!task) {
      return handleError(res, 404, "No task found with this id");
    }

    return handleSuccess(res, 200, "Task fetched successfully", task);
  } catch (error: any) {
    return handleError(res, 500, error.message || "Internal Server Error");
  }
};

export const getAllTasksController = async (req: Request, res: Response) => {
  try {
    const { assignmentId, status } = req.query;

    const filterOption: any = {};
    if (assignmentId) {
      filterOption.assignmentId = assignmentId as string;
    }
    if (status) {
      filterOption.status = status as any;
    }

    const tasks = await prisma.task.findMany({
      where: filterOption,
      orderBy: {
        createdAt: "asc",
      },
    });

    return handleSuccess(res, 200, "Tasks fetched successfully", tasks);
  } catch (error: any) {
    return handleError(res, 500, error.message || "Internal Server Error");
  }
};

export const updateTaskController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return handleError(res, 400, "No task id provided!");
    }

    const existingTask = await prisma.task.findUnique({
      where: { id },
    });

    if (!existingTask) {
      return handleError(res, 404, "No task found with this id");
    }

    const validatedData = updateTaskSchema.parse(req.body);

    let attachmentUrl: string | undefined = undefined;
    let attachmentName: string | undefined = undefined;
    const file = req.file;

    if (file) {
      const uploadResult = await uploadToCloudinary(file.buffer, file.mimetype, "task_attachments");
      attachmentUrl = uploadResult.url;
      attachmentName = file.originalname;
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        ...validatedData,
        ...(attachmentUrl !== undefined && { attachmentUrl, attachmentName }),
      },
    });

    return handleSuccess(res, 200, "Task updated successfully", updatedTask);
  } catch (error: any) {
    if (error instanceof ZodError) {
      return handleError(
        res,
        400,
        "Validation Error",
        error.errors.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      );
    }
    return handleError(res, 500, error.message || "Internal Server Error");
  }
};

export const deleteTaskController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return handleError(res, 400, "No task id provided!");
    }

    const existingTask = await prisma.task.findUnique({
      where: { id },
    });

    if (!existingTask) {
      return handleError(res, 404, "No task found with this id");
    }

    await prisma.task.delete({
      where: { id },
    });

    return handleSuccess(res, 200, "Task deleted successfully");
  } catch (error: any) {
    return handleError(res, 500, error.message || "Internal Server Error");
  }
};

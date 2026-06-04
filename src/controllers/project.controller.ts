import { Response } from "express";
import prisma from "../utils/db";
import { ZodError } from "zod";
import { RequestWithUser } from "../middlewares/auth.middleware";
import { createProject, updateProject } from "../utils/project.validation";
import { handleError } from "../libs/handleError";
import { handleSuccess } from "../libs/handleSuccess";
import { uploadToCloudinary } from "../libs/cloudinary";

export const createProjectController = async (
  req: RequestWithUser,
  res: Response,
) => {
  try {
    if (!req.user) {
      return handleError(res, 401, "User is not authenticated.");
    }

    const validatedData = createProject.parse(req.body);
    const { name, description } = validatedData;

    let imageUrl: string | undefined = undefined;
    const image = req.file;

    if (image) {
      const uploadResult = await uploadToCloudinary(
        image.buffer,
        image.mimetype,
      );
      imageUrl = uploadResult.url;
    }

    const newProject = await prisma.project.create({
      data: {
        name,
        description,
        image: imageUrl,
        userId: req.user.userId,
      },
    });

    return handleSuccess(res, 201, "Project created successfully", newProject);
  } catch (error: any) {
    return handleError(res, 500, error.message || "Internal Server Error");
  }
};

// fetches all projects -> Only ADMIN
export const getAllProjectsController = async (
  req: RequestWithUser,
  res: Response,
) => {
  try {
    if (!req.user) {
      return handleError(res, 401, "User is not authenticated");
    }

    const search = (req.query.search as string) || "";
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const userRole = req.user.role;
    const userId = req.user.userId;

    const searchFormat = search
      ? { name: { contains: search, mode: "insensitive" as const } }
      : {};

    const filters: any = { ...searchFormat };

    // If user is STAFF, only show the project with there access
    if (userRole === "STAFF") {
      filters.assignments = {
        some: {
          userId: userId,
        },
      };
    }

    // Fetch count and list in parallel
    const [totalItems, projects] = await Promise.all([
      prisma.project.count({ where: filters }),

      prisma.project.findMany({
        where: filters,
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return handleSuccess(res, 200, "Projects retrieved successfully", {
      projects,
      totalItems,
      page,
      limit,
      totalPages,
    });
  } catch (error: any) {
    return handleError(res, 500, error.message || "Internal Server Error");
  }
};

// Get Project by ID
export const getProjectByIdController = async (
  req: RequestWithUser,
  res: Response,
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return handleError(res, 400, "Project ID is required.");
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        assignments: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
            tasks: true,
          },
        },
      },
    });

    if (!project) {
      return handleError(res, 404, "Project not found.");
    }

    return handleSuccess(
      res,
      200,
      "Project profile fetched successfully!",
      project,
    );
  } catch (error: any) {
    return handleError(res, 500, error.message || "Internal Server Error");
  }
};

export const updateProjectController = async (
  req: RequestWithUser,
  res: Response,
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return handleError(res, 400, "Project ID is required.");
    }

    // Verify project exists in DB
    const existingProject = await prisma.project.findUnique({ where: { id } });
    if (!existingProject) {
      return handleError(res, 404, "Project not found with this id.");
    }

    // Validate update parameters
    const validatedData = updateProject.parse(req.body);

    let imageUrl: string | undefined = undefined;
    const image = req.file;

    if (image) {
      const uploadResult = await uploadToCloudinary(
        image.buffer,
        image.mimetype,
      );
      imageUrl = uploadResult.url;
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        ...validatedData,
        ...(imageUrl !== undefined && { image: imageUrl }),
      },
    });

    return handleSuccess(
      res,
      200,
      "Project updated successfully",
      updatedProject,
    );
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

export const deleteProjectController = async (
  req: RequestWithUser,
  res: Response,
) => {
  try {
    const { id } = req.params;

    if (!id) {
      return handleError(res, 400, "Project ID is required.");
    }

    // Verify project exists in DB
    const existingProject = await prisma.project.findUnique({ where: { id } });
    if (!existingProject) {
      return handleError(res, 404, "Project not found with this id.");
    }

    // Delete Project automatically deletes all nested join table rows
    await prisma.project.delete({ where: { id } });

    return handleSuccess(
      res,
      200,
      "Project successfully deleted from database",
    );
  } catch (error: any) {
    return handleError(res, 500, error.message || "Internal Server Error");
  }
};

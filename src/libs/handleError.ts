import { Response } from "express";

export const handleError = (
  res: Response,
  status: number,
  message: string,
  details?: any,
) => {
  return res.status(status).json({
    success: false,
    error: {
      status,
      message,
      ...(details !== undefined && { details }), // Only includes 'details' key if passed
    },
  });
};

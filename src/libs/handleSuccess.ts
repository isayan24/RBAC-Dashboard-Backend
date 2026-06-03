import { Response } from "express";

export const handleSuccess = (
  res: Response,
  status: number,
  message: string,
  data?: any,
) => {
  return res.status(status).json({
    success: true,
    message,
    ...(data !== undefined && { data }),
  });
};

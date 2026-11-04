import { Response } from 'express';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  timestamp: string;
}

export function sendSuccess<T>(res: Response, data: T, message?: string, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  });
}

export function sendError(res: Response, error: string, statusCode = 400, code?: string) {
  return res.status(statusCode).json({
    success: false,
    error,
    code,
    timestamp: new Date().toISOString()
  });
}

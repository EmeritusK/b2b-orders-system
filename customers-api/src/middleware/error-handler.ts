import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '../lib/logger';

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    logger.warn({ err, path: req.path, status: err.status }, err.message);
    return res.status(err.status).json({ error: err.message, details: err.details ?? null });
  }

  if (err instanceof z.ZodError) {
    logger.warn({ err, path: req.path }, 'Validation error');
    return res.status(400).json({
      error: 'Validation error',
      details: z.treeifyError(err),
    });
  }

  logger.error({ err, path: req.path }, err instanceof Error ? err.message : 'Internal Server Error');
  const message = err instanceof Error ? err.message : 'Internal Server Error';
  return res.status(500).json({ error: message });
}

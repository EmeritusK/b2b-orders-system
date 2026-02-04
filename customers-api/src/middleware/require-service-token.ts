import type { Request, Response, NextFunction } from 'express';

export function requireServiceToken(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  const token = process.env.SERVICE_TOKEN;
  if (!token || auth !== `Bearer ${token}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

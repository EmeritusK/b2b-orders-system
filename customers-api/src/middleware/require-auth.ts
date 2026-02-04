import type { Request, Response, NextFunction } from 'express';
import { requireJwt } from './require-jwt';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const path = req.path || req.originalUrl?.split('?')[0] || '';
  if (path.startsWith('/internal')) {
    const auth = req.headers.authorization;
    const token = process.env.SERVICE_TOKEN;
    if (token && auth === `Bearer ${token}`) {
      return next();
    }
    return requireJwt(req, res, next);
  }
  return requireJwt(req, res, next);
}


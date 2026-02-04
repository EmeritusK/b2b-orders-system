import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { loginSchema } from './auth.types';
import { verifyCredentials, issueToken } from './auth.service';

const router = Router();

const asyncWrap =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new HttpError(400, 'Validation error', parsed.error.flatten());
  return parsed.data;
}

router.post(
  '/login',
  asyncWrap(async (req, res) => {
    const data = parseOrThrow(loginSchema, req.body);
    const valid = verifyCredentials(data.email, data.password);
    if (!valid) {
      throw new HttpError(401, 'Invalid email or password');
    }
    const token = issueToken(data.email);
    return res.json({ token });
  })
);

export default router;

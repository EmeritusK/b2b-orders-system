// src/modules/customers/customers.routes.ts
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import {
  createCustomerSchema,
  updateCustomerSchema,
  listCustomersQuerySchema,
} from './customers.types';
import * as customersService from './customers.service';

const router = Router();


const asyncWrap =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

function isZodError(err: unknown): err is z.ZodError {
  return err instanceof z.ZodError;
}

function isDupEmailError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as any).code === 'ER_DUP_ENTRY';
}

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new HttpError(400, 'Validation error', parsed.error.flatten());
  }
  return parsed.data;
}


function requireServiceToken(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  const token = process.env.SERVICE_TOKEN;

  if (!token || auth !== `Bearer ${token}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

router.post(
  '/customers',
  asyncWrap(async (req, res) => {
    const data = parseOrThrow(createCustomerSchema, req.body);

    try {
      const customer = await customersService.createCustomer(data);
      return res.status(201).json(customer);
    } catch (err: unknown) {
      if (isDupEmailError(err) || (err instanceof Error && err.message.includes('email ya existe'))) {
        throw new HttpError(409, 'Email already exists');
      }
      throw err;
    }
  })
);

router.get(
  '/customers/:id',
  asyncWrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) throw new HttpError(400, 'Invalid id');

    const customer = await customersService.getById(id);
    if (!customer) throw new HttpError(404, 'Customer not found');

    return res.json(customer);
  })
);

router.get(
  '/customers',
  asyncWrap(async (req, res) => {
    const query = parseOrThrow(listCustomersQuerySchema, req.query);
    const { customers, nextCursor } = await customersService.listCustomers(query);
    return res.json({ customers, nextCursor });
  })
);

router.put(
  '/customers/:id',
  asyncWrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) throw new HttpError(400, 'Invalid id');

    const data = parseOrThrow(updateCustomerSchema, req.body);

    try {
      const customer = await customersService.updateCustomer(id, data);
      if (!customer) throw new HttpError(404, 'Customer not found');
      return res.json(customer);
    } catch (err: unknown) {
      if (isDupEmailError(err) || (err instanceof Error && err.message.includes('email ya existe'))) {
        throw new HttpError(409, 'Email already exists');
      }
      throw err;
    }
  })
);

router.delete(
  '/customers/:id',
  asyncWrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) throw new HttpError(400, 'Invalid id');

    const deleted = await customersService.deleteCustomer(id);
    if (!deleted) throw new HttpError(404, 'Customer not found');

    return res.status(204).send();
  })
);

router.get(
  '/internal/customers/:id',
  requireServiceToken,
  asyncWrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) throw new HttpError(400, 'Invalid id');

    const customer = await customersService.getById(id);
    if (!customer) throw new HttpError(404, 'Customer not found');

    return res.json(customer);
  })
);


export default router;

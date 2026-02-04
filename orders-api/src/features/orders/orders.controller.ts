import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { createOrderSchema, listOrdersQuerySchema } from './orders.types';
import * as ordersService from './orders.service';

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
  '/orders',
  asyncWrap(async (req, res) => {
    const data = parseOrThrow(createOrderSchema, req.body);
    try {
      const order = await ordersService.createOrder(data);
      return res.status(201).json(order);
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === 'Customer not found') throw new HttpError(404, 'Customer not found');
        if (err.message.startsWith('Product') && err.message.includes('not found'))
          throw new HttpError(404, err.message);
        if (err.message.startsWith('Insufficient stock')) throw new HttpError(409, err.message);
      }
      throw err;
    }
  })
);

router.get(
  '/orders/:id',
  asyncWrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) throw new HttpError(400, 'Invalid id');
    const order = await ordersService.getById(id);
    if (!order) throw new HttpError(404, 'Order not found');
    return res.json(order);
  })
);

router.get(
  '/orders',
  asyncWrap(async (req, res) => {
    const query = parseOrThrow(listOrdersQuerySchema, req.query);
    const { orders, nextCursor } = await ordersService.listOrders(query);
    return res.json({ orders, nextCursor });
  })
);

router.post(
  '/orders/:id/confirm',
  asyncWrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) throw new HttpError(400, 'Invalid id');
    const key = (req.headers['x-idempotency-key'] as string)?.trim();
    if (!key) throw new HttpError(400, 'X-Idempotency-Key header is required');
    try {
      const { order, fromCache } = await ordersService.confirmOrder(id, key);
      return res.status(fromCache ? 200 : 200).json(order);
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === 'Order not found') throw new HttpError(404, 'Order not found');
        if (err.message === 'Order cannot be confirmed') throw new HttpError(409, err.message);
        if (err.message === 'Idempotency key in progress') throw new HttpError(409, err.message);
      }
      throw err;
    }
  })
);

router.post(
  '/orders/:id/cancel',
  asyncWrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) throw new HttpError(400, 'Invalid id');
    try {
      const order = await ordersService.cancelOrder(id);
      if (!order) throw new HttpError(404, 'Order not found');
      return res.json(order);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('Cannot cancel CONFIRMED'))
        throw new HttpError(409, err.message);
      throw err;
    }
  })
);

export default router;

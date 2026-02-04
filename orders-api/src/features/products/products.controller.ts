import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import {
  createProductSchema,
  patchProductSchema,
  listProductsQuerySchema,
} from './products.types';
import * as productsService from './products.service';

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
  '/products',
  asyncWrap(async (req, res) => {
    const data = parseOrThrow(createProductSchema, req.body);
    try {
      const product = await productsService.createProduct(data);
      return res.status(201).json(product);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'SKU already exists') throw new HttpError(409, 'SKU already exists');
      throw err;
    }
  })
);

router.get(
  '/products/:id',
  asyncWrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) throw new HttpError(400, 'Invalid id');
    const product = await productsService.getById(id);
    if (!product) throw new HttpError(404, 'Product not found');
    return res.json(product);
  })
);

router.get(
  '/products',
  asyncWrap(async (req, res) => {
    const query = parseOrThrow(listProductsQuerySchema, req.query);
    const { products, nextCursor } = await productsService.listProducts(query);
    return res.json({ products, nextCursor });
  })
);

router.patch(
  '/products/:id',
  asyncWrap(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) throw new HttpError(400, 'Invalid id');
    const data = parseOrThrow(patchProductSchema, req.body);
    const product = await productsService.patchProduct(id, data);
    if (!product) throw new HttpError(404, 'Product not found');
    return res.json(product);
  })
);

export default router;

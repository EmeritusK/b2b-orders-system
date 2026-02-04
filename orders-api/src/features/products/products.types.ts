import { z } from 'zod';

export const createProductSchema = z.object({
  sku: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(255),
  price_cents: z.coerce.number().int().min(0),
  stock: z.coerce.number().int().min(0).default(0),
});

export const patchProductSchema = z.object({
  price_cents: z.coerce.number().int().min(0).optional(),
  stock: z.coerce.number().int().min(0).optional(),
});

export const listProductsQuerySchema = z.object({
  search: z.string().trim().optional(),
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type PatchProductInput = z.infer<typeof patchProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

export interface Product {
  id: number;
  sku: string;
  name: string;
  price_cents: number;
  stock: number;
  created_at: Date;
}

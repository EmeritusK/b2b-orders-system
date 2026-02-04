import { z } from 'zod';

const orderItemSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  qty: z.coerce.number().int().min(1),
});

export const createOrderSchema = z.object({
  customer_id: z.coerce.number().int().positive(),
  items: z.array(orderItemSchema).min(1),
});

export const listOrdersQuerySchema = z.object({
  status: z.enum(['CREATED', 'CONFIRMED', 'CANCELED']).optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;

export type OrderStatus = 'CREATED' | 'CONFIRMED' | 'CANCELED';

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  qty: number;
  unit_price_cents: number;
  subtotal_cents: number;
}

export interface Order {
  id: number;
  customer_id: number;
  status: OrderStatus;
  total_cents: number;
  created_at: Date;
  items?: OrderItem[];
}

export interface OrderItemPayload {
  product_id: number;
  qty: number;
  unit_price_cents: number;
  subtotal_cents: number;
}

export type OrderWithItemsPayload = Omit<Order, 'items'> & { items: OrderItemPayload[] };

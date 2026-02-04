import { z } from 'zod';

// Normalización centralizada
const EmailNormalized = z.email().trim().toLowerCase().max(255); // Primero limitar, luego email
const Phone = z.string().trim().max(50);

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1).max(255),
  email: EmailNormalized,
  phone: Phone.optional(),
});

export const updateCustomerSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  email: EmailNormalized.optional(),
  phone: Phone.optional(),
});

export const listCustomersQuerySchema = z.object({
  search: z.string().trim().optional(),
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  created_at: Date;
}

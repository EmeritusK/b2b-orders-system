import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../lib/db';
import type { CreateCustomerInput, UpdateCustomerInput, ListCustomersQuery, Customer } from './customers.types';

type CustomerRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  created_at: Date | string;
};

function rowToCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? null,
    created_at: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}

function isDupEmailError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as any).code === 'ER_DUP_ENTRY';
}

export async function createCustomer(data: CreateCustomerInput): Promise<Customer> {
  try {
    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)',
      [data.name, data.email, data.phone ?? null]
    );

    const customer = await getById(result.insertId);
    if (!customer) throw new Error('No se pudo crear el cliente.');
    return customer;
  } catch (err: unknown) {
    if (isDupEmailError(err)) throw new Error('El email ya existe.');
    throw new Error('Ocurrio un error al crear el cliente.');
  }
}

export async function getById(id: number): Promise<Customer | null> {
  const [rows] = await pool.execute<CustomerRow[]>(
    'SELECT id, name, email, phone, created_at FROM customers WHERE id = ? LIMIT 1',
    [id]
  );
  if (rows.length === 0) return null;
  return rowToCustomer(rows[0]);
}

export async function listCustomers(
  query: ListCustomersQuery
): Promise<{ customers: Customer[]; nextCursor: string | null }> {
  const { search, cursor, limit } = query;

  let sql = 'SELECT id, name, email, phone, created_at FROM customers WHERE 1=1';
  const params: (string | number)[] = [];

  if (search) {
    sql += ' AND (name LIKE ? OR email LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term);
  }

  if (cursor !== undefined) {
    sql += ' AND id > ?';
    params.push(cursor);
  }

  const limitVal = Math.min(Math.max(1, Number(limit) || 20), 100);
  const fetchLimit = limitVal + 1;
  sql += ` ORDER BY id ASC LIMIT ${fetchLimit}`;

  const [rows] = await pool.execute<CustomerRow[]>(sql, params);

  const customers = rows.slice(0, limitVal).map(rowToCustomer);

  const nextCursor =
    rows.length > limitVal && customers.length > 0
      ? String(customers[customers.length - 1].id)
      : null;

  return { customers, nextCursor };
}

export async function updateCustomer(id: number, data: UpdateCustomerInput): Promise<Customer | null> {
  const current = await getById(id);
  if (!current) return null;

  const name = data.name ?? current.name;
  const email = data.email ?? current.email;
  const phone = data.phone !== undefined ? data.phone : current.phone;

  try {
    await pool.execute<ResultSetHeader>(
      'UPDATE customers SET name = ?, email = ?, phone = ? WHERE id = ?',
      [name, email, phone ?? null, id]
    );
  } catch (err: unknown) {
    if (isDupEmailError(err)) throw new Error('El email ya existe.');
    throw new Error('Ocurrió un error al actualizar el cliente.');
  }

  return getById(id);
}

export async function deleteCustomer(id: number): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    'DELETE FROM customers WHERE id = ?',
    [id]
  );
  return result.affectedRows > 0;
}

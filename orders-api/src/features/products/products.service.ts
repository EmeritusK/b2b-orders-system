import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../lib/db';
import type { CreateProductInput, PatchProductInput, ListProductsQuery, Product } from './products.types';

type ProductRow = RowDataPacket & {
  id: number;
  sku: string;
  name: string;
  price_cents: number;
  stock: number;
  created_at: Date | string;
};

function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    price_cents: row.price_cents,
    stock: row.stock,
    created_at: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}

function isDupSkuError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'ER_DUP_ENTRY';
}

export async function createProduct(data: CreateProductInput): Promise<Product> {
  try {
    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO products (sku, name, price_cents, stock) VALUES (?, ?, ?, ?)',
      [data.sku, data.name, data.price_cents, data.stock ?? 0]
    );
    const product = await getById(result.insertId);
    if (!product) throw new Error('Failed to create product');
    return product;
  } catch (err: unknown) {
    if (isDupSkuError(err)) throw new Error('SKU already exists');
    throw err;
  }
}

export async function getById(id: number): Promise<Product | null> {
  const [rows] = await pool.execute<ProductRow[]>(
    'SELECT id, sku, name, price_cents, stock, created_at FROM products WHERE id = ? LIMIT 1',
    [id]
  );
  if (rows.length === 0) return null;
  return rowToProduct(rows[0]);
}

export async function listProducts(query: ListProductsQuery): Promise<{ products: Product[]; nextCursor: string | null }> {
  const { search, cursor, limit } = query;
  let sql = 'SELECT id, sku, name, price_cents, stock, created_at FROM products WHERE 1=1';
  const params: (string | number)[] = [];

  if (search) {
    sql += ' AND (name LIKE ? OR sku LIKE ?)';
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

  const [rows] = await pool.execute<ProductRow[]>(sql, params);
  const products = rows.slice(0, limitVal).map(rowToProduct);
  const nextCursor =
    rows.length > limitVal && products.length > 0 ? String(products[products.length - 1].id) : null;
  return { products, nextCursor };
}

export async function patchProduct(id: number, data: PatchProductInput): Promise<Product | null> {
  const current = await getById(id);
  if (!current) return null;
  const price_cents = data.price_cents ?? current.price_cents;
  const stock = data.stock ?? current.stock;
  await pool.execute<ResultSetHeader>(
    'UPDATE products SET price_cents = ?, stock = ? WHERE id = ?',
    [price_cents, stock, id]
  );
  return getById(id);
}

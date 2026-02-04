import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../../lib/db';
import { getCustomerById } from '../../lib/customers-client';
import type {
  CreateOrderInput,
  ListOrdersQuery,
  Order,
  OrderItem,
  OrderStatus,
  OrderWithItemsPayload,
} from './orders.types';

type OrderRow = RowDataPacket & {
  id: number;
  customer_id: number;
  status: string;
  total_cents: number;
  created_at: Date | string;
};

type OrderItemRow = RowDataPacket & {
  id: number;
  order_id: number;
  product_id: number;
  qty: number;
  unit_price_cents: number;
  subtotal_cents: number;
};

const CONFIRMED_CANCEL_WINDOW_MS = 10 * 60 * 1000;
const IDEMPOTENCY_EXPIRY_HOURS = 24;

function rowToOrder(row: OrderRow): Order {
  return {
    id: row.id,
    customer_id: row.customer_id,
    status: row.status as OrderStatus,
    total_cents: row.total_cents,
    created_at: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
  };
}

function rowToOrderItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    order_id: row.order_id,
    product_id: row.product_id,
    qty: row.qty,
    unit_price_cents: row.unit_price_cents,
    subtotal_cents: row.subtotal_cents,
  };
}

export async function createOrder(data: CreateOrderInput): Promise<OrderWithItemsPayload> {
  const customer = await getCustomerById(data.customer_id);
  if (!customer) throw new Error('Customer not found');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const productIds = [...new Set(data.items.map((i) => i.product_id))];
    const placeholders = productIds.map(() => '?').join(',');
    const [productRows] = await conn.execute<RowDataPacket[]>(
      `SELECT id, price_cents, stock FROM products WHERE id IN (${placeholders})`,
      productIds
    );
    const productMap = new Map(
      (productRows as { id: number; price_cents: number; stock: number }[]).map((p) => [p.id, p])
    );
    let totalCents = 0;
    const orderItems: { product_id: number; qty: number; unit_price_cents: number; subtotal_cents: number }[] = [];
    for (const item of data.items) {
      const product = productMap.get(item.product_id);
      if (!product) throw new Error(`Product ${item.product_id} not found`);
      if (product.stock < item.qty) throw new Error(`Insufficient stock for product ${item.product_id}`);
      const subtotal = product.price_cents * item.qty;
      totalCents += subtotal;
      orderItems.push({
        product_id: item.product_id,
        qty: item.qty,
        unit_price_cents: product.price_cents,
        subtotal_cents: subtotal,
      });
    }
    const [orderResult] = await conn.execute<ResultSetHeader>(
      'INSERT INTO orders (customer_id, status, total_cents) VALUES (?, ?, ?)',
      [data.customer_id, 'CREATED', totalCents]
    );
    const orderId = orderResult.insertId;
    for (const oi of orderItems) {
      await conn.execute(
        'INSERT INTO order_items (order_id, product_id, qty, unit_price_cents, subtotal_cents) VALUES (?, ?, ?, ?, ?)',
        [orderId, oi.product_id, oi.qty, oi.unit_price_cents, oi.subtotal_cents]
      );
      await conn.execute('UPDATE products SET stock = stock - ? WHERE id = ?', [oi.qty, oi.product_id]);
    }
    await conn.commit();
    const order = await getById(orderId);
    if (!order) throw new Error('Order not created');
    return { ...order, items: orderItems };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function getById(id: number): Promise<(Order & { items: OrderItem[] }) | null> {
  const [orderRows] = await pool.execute<OrderRow[]>(
    'SELECT id, customer_id, status, total_cents, created_at FROM orders WHERE id = ? LIMIT 1',
    [id]
  );
  if (orderRows.length === 0) return null;
  const order = rowToOrder(orderRows[0]);
  const [itemRows] = await pool.execute<OrderItemRow[]>(
    'SELECT id, order_id, product_id, qty, unit_price_cents, subtotal_cents FROM order_items WHERE order_id = ?',
    [id]
  );
  const items = itemRows.map(rowToOrderItem);
  return { ...order, items };
}

export async function listOrders(
  query: ListOrdersQuery
): Promise<{ orders: Order[]; nextCursor: string | null }> {
  const { status, from, to, cursor, limit } = query;
  let sql = 'SELECT id, customer_id, status, total_cents, created_at FROM orders WHERE 1=1';
  const params: (string | number)[] = [];
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (from) {
    sql += ' AND created_at >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND created_at <= ?';
    params.push(to);
  }
  if (cursor !== undefined) {
    sql += ' AND id > ?';
    params.push(cursor);
  }
  const limitVal = Math.min(Math.max(1, Number(limit) || 20), 100);
  const fetchLimit = limitVal + 1;
  sql += ` ORDER BY id ASC LIMIT ${fetchLimit}`;
  const [rows] = await pool.execute<OrderRow[]>(sql, params);
  const orders = rows.slice(0, limitVal).map(rowToOrder);
  const nextCursor =
    rows.length > limitVal && orders.length > 0 ? String(orders[orders.length - 1].id) : null;
  return { orders, nextCursor };
}

export async function confirmOrder(
  orderId: number,
  idempotencyKey: string
): Promise<{ order: Order & { items: OrderItem[] }; fromCache: boolean }> {
  const key = idempotencyKey.trim();
  if (!key) throw new Error('X-Idempotency-Key is required');

  const [existing] = await pool.execute<RowDataPacket[]>(
    'SELECT status, response_body FROM idempotency_keys WHERE `key` = ? LIMIT 1',
    [key]
  );
  if (existing.length > 0) {
    const row = existing[0];
    if (row.status === 'COMPLETED' && row.response_body != null) {
      const body = row.response_body;
      const order = typeof body === 'string' ? JSON.parse(body) : body;
      return { order: order as Order & { items: OrderItem[] }, fromCache: true };
    }
    if (row.status === 'PROCESSING') throw new Error('Idempotency key in progress');
  }

  const orderWithItems = await getById(orderId);
  if (!orderWithItems) throw new Error('Order not found');
  if (orderWithItems.status !== 'CREATED') throw new Error('Order cannot be confirmed');

  const expiresAt = new Date(Date.now() + IDEMPOTENCY_EXPIRY_HOURS * 60 * 60 * 1000);
  await pool.execute(
    `INSERT INTO idempotency_keys (\`key\`, target_type, target_id, status, response_body, expires_at)
     VALUES (?, 'ORDER_CONFIRMATION', ?, 'PROCESSING', NULL, ?)
     ON DUPLICATE KEY UPDATE status = 'PROCESSING'`,
    [key, orderId, expiresAt]
  );

  try {
    await pool.execute('UPDATE orders SET status = ? WHERE id = ?', ['CONFIRMED', orderId]);
    const updated = await getById(orderId);
    if (!updated) throw new Error('Order not found');
    await pool.execute(
      `UPDATE idempotency_keys SET status = 'COMPLETED', response_body = ? WHERE \`key\` = ?`,
      [JSON.stringify(updated), key]
    );
    return { order: updated, fromCache: false };
  } catch (err) {
    await pool.execute(
      `UPDATE idempotency_keys SET status = 'FAILED' WHERE \`key\` = ?`,
      [key]
    );
    throw err;
  }
}

export async function cancelOrder(orderId: number): Promise<Order & { items: OrderItem[] } | null> {
  const orderWithItems = await getById(orderId);
  if (!orderWithItems) return null;
  if (orderWithItems.status === 'CANCELED') return orderWithItems;

  if (orderWithItems.status === 'CONFIRMED') {
    const elapsed = Date.now() - orderWithItems.created_at.getTime();
    if (elapsed > CONFIRMED_CANCEL_WINDOW_MS) throw new Error('Cannot cancel CONFIRMED order after 10 minutes');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('UPDATE orders SET status = ? WHERE id = ?', ['CANCELED', orderId]);
    if (orderWithItems.items?.length) {
      for (const item of orderWithItems.items) {
        await conn.execute('UPDATE products SET stock = stock + ? WHERE id = ?', [item.qty, item.product_id]);
      }
    }
    await conn.commit();
    return getById(orderId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

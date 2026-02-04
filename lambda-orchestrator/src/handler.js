const { z } = require('zod');

const requestSchema = z.object({
  customer_id: z.coerce.number().int().positive(),
  items: z
    .array(
      z.object({
        product_id: z.coerce.number().int().positive(),
        qty: z.coerce.number().int().min(1),
      })
    )
    .min(1),
  idempotency_key: z.string().trim().min(1),
  correlation_id: z.string().trim().min(1).optional(),
});

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function requireOrchestratorAuth(event) {
  const expected = process.env.ORCHESTRATOR_TOKEN;
  if (!expected) return; // allow if not set (dev convenience)
  const auth = event.headers?.authorization || event.headers?.Authorization;
  if (auth !== `Bearer ${expected}`) {
    const err = new Error('Unauthorized');
    err.statusCode = 401;
    throw err;
  }
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    const err = new Error(`Upstream error ${res.status}`);
    err.statusCode = 502;
    err.details = { url, status: res.status, body: parsed };
    throw err;
  }
  return parsed;
}

module.exports.createAndConfirm = async (event) => {
  try {
    requireOrchestratorAuth(event);

    const rawBody = event.body ? JSON.parse(event.body) : {};
    const data = requestSchema.parse(rawBody);

    const customersBase = (process.env.CUSTOMERS_API_BASE || '').replace(/\/$/, '');
    const ordersBase = (process.env.ORDERS_API_BASE || '').replace(/\/$/, '');
    const serviceToken = process.env.SERVICE_TOKEN;
    if (!customersBase || !ordersBase || !serviceToken) {
      return json(500, { error: 'Missing env: CUSTOMERS_API_BASE, ORDERS_API_BASE, SERVICE_TOKEN' });
    }

    const customer = await fetchJson(`${customersBase}/internal/customers/${data.customer_id}`, {
      headers: { Authorization: `Bearer ${serviceToken}` },
    });

    const existingOrder = await fetchJson(
      `${ordersBase}/orders/by-idempotency-key/${encodeURIComponent(data.idempotency_key)}`,
      {
        headers: { Authorization: `Bearer ${serviceToken}` },
      }
    ).catch(() => null);

    if (existingOrder && existingOrder.id) {
      return json(200, {
        success: true,
        correlationId: data.correlation_id ?? null,
        data: {
          customer,
          order: existingOrder,
        },
      });
    }

    const orderCreated = await fetchJson(`${ordersBase}/orders`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${serviceToken}`,
      },
      body: JSON.stringify({ customer_id: data.customer_id, items: data.items }),
    });

    const orderId = orderCreated?.id;
    if (!orderId) {
      return json(502, { error: 'Orders API did not return order id', details: orderCreated });
    }

    const orderConfirmed = await fetchJson(`${ordersBase}/orders/${orderId}/confirm`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceToken}`,
        'X-Idempotency-Key': data.idempotency_key,
      },
    });

    return json(201, {
      success: true,
      correlationId: data.correlation_id ?? null,
      data: {
        customer,
        order: orderConfirmed,
      },
    });
  } catch (err) {
    const statusCode = err?.statusCode || (err?.name === 'ZodError' ? 400 : 500);
    const payload = { error: err?.message || 'Internal error' };
    if (err?.details) payload.details = err.details;
    return json(statusCode, payload);
  }
};


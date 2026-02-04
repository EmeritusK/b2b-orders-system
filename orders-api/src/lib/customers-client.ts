export interface CustomerFromApi {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
}

export async function getCustomerById(customerId: number): Promise<CustomerFromApi | null> {
  const base = process.env.CUSTOMERS_API_BASE;
  const token = process.env.SERVICE_TOKEN;
  if (!base || !token) {
    throw new Error('CUSTOMERS_API_BASE and SERVICE_TOKEN are required');
  }
  const url = `${base.replace(/\/$/, '')}/internal/customers/${customerId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Customers API error: ${res.status} ${text}`);
  }
  return res.json() as Promise<CustomerFromApi>;
}

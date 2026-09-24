import * as productsService from '../products.service';
import { pool } from '../../../lib/db';
import { ResultSetHeader } from 'mysql2';

jest.mock('../../../lib/db', () => ({
  pool: {
    execute: jest.fn(),
  },
}));

describe('products.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getById', () => {
    it('should return null if product is not found', async () => {
      (pool.execute as jest.Mock).mockResolvedValue([[]]);

      const result = await productsService.getById(99);

      expect(result).toBeNull();
      expect(pool.execute).toHaveBeenCalledWith(
        'SELECT id, sku, name, price_cents, stock, created_at FROM products WHERE id = ? LIMIT 1',
        [99],
      );
    });

    it('should return the product if found', async () => {
      const mockProduct = {
        id: 1,
        sku: 'PROD1',
        name: 'Product A',
        price_cents: 1000,
        stock: 100,
        created_at: new Date('2023-01-01T00:00:00Z'),
      };
      (pool.execute as jest.Mock).mockResolvedValue([[mockProduct]]);

      const result = await productsService.getById(1);

      expect(result).toEqual(mockProduct);
      expect(pool.execute).toHaveBeenCalledWith(
        'SELECT id, sku, name, price_cents, stock, created_at FROM products WHERE id = ? LIMIT 1',
        [1],
      );
    });
  });

  describe('createProduct', () => {
    it('should throw error if SKU already exists', async () => {
      (pool.execute as jest.Mock).mockRejectedValue({ code: 'ER_DUP_ENTRY' });

      await expect(
        productsService.createProduct({ sku: 'PROD1', name: 'P1', price_cents: 100, stock: 0 }),
      ).rejects.toThrow('SKU already exists');
    });

    it('should create and return the product', async () => {
      (pool.execute as jest.Mock).mockResolvedValueOnce([{ insertId: 1 }] as ResultSetHeader[]);
      const mockProduct = {
        id: 1,
        sku: 'PROD1',
        name: 'Product A',
        price_cents: 1000,
        stock: 100,
        created_at: new Date('2023-01-01T00:00:00Z'),
      };
      (pool.execute as jest.Mock).mockResolvedValueOnce([[mockProduct]]);

      const result = await productsService.createProduct({
        sku: 'PROD1',
        name: 'Product A',
        price_cents: 1000,
        stock: 100,
      });

      expect(result).toEqual(mockProduct);
      expect(pool.execute).toHaveBeenCalledTimes(2);
    });
  });
});

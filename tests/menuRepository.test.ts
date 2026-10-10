import assert from 'node:assert/strict';
import test from 'node:test';
import type { Pool, PoolClient } from 'pg';
import { PostgresMenuRepository } from '../src/server/menuRepository';

test('PostgreSQL menu reads query categories and products sequentially', async () => {
  let activeQueries = 0;
  let maxActiveQueries = 0;
  const pool = {
    query: async (sql: string) => {
      activeQueries += 1;
      maxActiveQueries = Math.max(maxActiveQueries, activeQueries);
      await new Promise((resolve) => setTimeout(resolve, 5));
      activeQueries -= 1;
      if (sql.includes('FROM categories')) {
        return { rows: [{ id: 'category-1', name: 'Sweets', description: null, created_at: '2026-01-01', updated_at: '2026-01-01' }] };
      }
      return { rows: [{
        id: 'product-1', name: 'Ladoo', category_id: 'category-1', price: '12.50',
        description: null, image_url: null, status: 'available', created_at: '2026-01-01', updated_at: '2026-01-01',
      }] };
    },
  } as unknown as Pool;

  const state = await new PostgresMenuRepository(pool).list();
  assert.equal(maxActiveQueries, 1);
  assert.equal(state.categories.length, 1);
  assert.equal(state.products[0].price, 12.5);
});

test('transaction releases its checked-out client after a database error', async () => {
  const queries: string[] = [];
  let releaseCount = 0;
  const client = {
    query: async (sql: string) => {
      queries.push(sql);
      if (sql.startsWith('DELETE FROM products')) throw Object.assign(new Error('database unavailable'), { code: '08006' });
      return { rows: [], rowCount: 0 };
    },
    release: () => { releaseCount += 1; },
  } as unknown as PoolClient;
  const pool = { connect: async () => client } as unknown as Pool;

  await assert.rejects(() => new PostgresMenuRepository(pool).deleteProduct('product-1'));
  assert.deepEqual(queries, ['BEGIN', 'DELETE FROM products WHERE id = $1 RETURNING id', 'ROLLBACK']);
  assert.equal(releaseCount, 1);
});

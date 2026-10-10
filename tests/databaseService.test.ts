import assert from 'node:assert/strict';
import test from 'node:test';
import { dbService } from '../src/services/database';

test('menu state loading makes one API request for a refresh', async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    return new Response(JSON.stringify({ categories: [], products: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const state = await dbService.getMenuState();
    assert.deepEqual(state, { categories: [], products: [] });
    assert.equal(requestCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

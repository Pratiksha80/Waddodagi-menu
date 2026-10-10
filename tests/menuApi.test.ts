import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import express, { type RequestHandler } from 'express';
import test from 'node:test';
import { InMemoryMenuRepository } from '../src/server/menuRepository';
import { createMenuRouter } from '../src/server/menuRoutes';

const requireTestOwner: RequestHandler = (req, res, next) => {
  if (req.header('x-test-owner') === 'authorized') return next();
  return res.status(401).json({ error: 'Owner sign in required.', code: 'UNAUTHORIZED' });
};

async function startTestApi(repository = new InMemoryMenuRepository({ categories: [], products: [] })) {
  const app = express();
  app.use(express.json());
  app.use('/api', createMenuRouter(repository, requireTestOwner));
  const server: Server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind a TCP port.');
  const base = `http://127.0.0.1:${address.port}`;
  return {
    repository,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
    request: async (path: string, method = 'GET', body?: unknown, authorized = false) => {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(authorized ? { 'x-test-owner': 'authorized' } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: response.status === 204 ? null : await response.json() as any };
    },
  };
}

test('individual menu mutations enforce auth, validation, status codes, and persistence', async () => {
  const api = await startTestApi();
  try {
    const unauthorized = await api.request('/api/categories', 'POST', { name: 'Sweets' });
    assert.equal(unauthorized.status, 401);
    assert.equal((await api.request('/api/products/example/availability', 'PATCH', { status: 'available' })).status, 401);
    assert.equal((await api.request('/api/menu/reset', 'POST', {})).status, 401);

    const badCategory = await api.request('/api/categories', 'POST', { name: '   ' }, true);
    assert.equal(badCategory.status, 400);
    assert.equal(badCategory.body.code, 'INVALID_INPUT');

    const createdCategory = await api.request('/api/categories', 'POST', { name: ' Sweets ', description: 'Fresh' }, true);
    assert.equal(createdCategory.status, 201);
    assert.equal(createdCategory.body.category.name, 'Sweets');
    const categoryId = createdCategory.body.category.id as string;

    const duplicate = await api.request('/api/categories', 'POST', { name: 'sweets' }, true);
    assert.equal(duplicate.status, 409);

    const createdProduct = await api.request('/api/products', 'POST', {
      name: 'Ladoo', category_id: categoryId, price: 12.5,
    }, true);
    assert.equal(createdProduct.status, 201);
    assert.equal(createdProduct.body.product.category_id, categoryId);
    const productId = createdProduct.body.product.id as string;

    const invalidPrice = await api.request('/api/products', 'POST', {
      name: 'Broken', category_id: categoryId, price: 1.239,
    }, true);
    assert.equal(invalidPrice.status, 400);

    const invalidImage = await api.request('/api/products', 'POST', {
      name: 'Broken', category_id: categoryId, price: 1, image_url: 'javascript:alert(1)',
    }, true);
    assert.equal(invalidImage.status, 400);

    const newInlineImage = await api.request('/api/products', 'POST', {
      name: 'Inline image', category_id: categoryId, price: 1, image_url: 'data:image/png;base64,iVBORw==',
    }, true);
    assert.equal(newInlineImage.status, 400);

    const missingCategory = await api.request('/api/products', 'POST', {
      name: 'Broken', category_id: 'missing-category', price: 2,
    }, true);
    assert.equal(missingCategory.status, 400);

    const updatedCategory = await api.request(`/api/categories/${categoryId}`, 'PUT', { name: 'Mithai' }, true);
    assert.equal(updatedCategory.status, 200);
    assert.equal(updatedCategory.body.category.id, categoryId);

    const updatedProduct = await api.request(`/api/products/${productId}`, 'PUT', { name: 'Besan Ladoo', price: 14 }, true);
    assert.equal(updatedProduct.status, 200);
    assert.equal(updatedProduct.body.product.id, productId);
    assert.equal(updatedProduct.body.product.category_id, categoryId);
    assert.equal(updatedProduct.body.product.price, 14);

    const availability = await api.request(`/api/products/${productId}/availability`, 'PATCH', { status: 'out_of_stock' }, true);
    assert.equal(availability.status, 200);
    assert.equal(availability.body.product.status, 'out_of_stock');

    const categoryInUse = await api.request(`/api/categories/${categoryId}`, 'DELETE', undefined, true);
    assert.equal(categoryInUse.status, 409);

    const missingProduct = await api.request('/api/products/missing-product', 'DELETE', undefined, true);
    assert.equal(missingProduct.status, 404);
    assert.equal((await api.request('/api/products/missing-product', 'PUT', { name: 'Missing' }, true)).status, 404);
    assert.equal((await api.request('/api/categories/missing-category', 'PUT', { name: 'Missing' }, true)).status, 404);

    assert.equal((await api.request(`/api/products/${productId}`, 'DELETE', undefined, true)).status, 200);
    assert.equal((await api.request(`/api/categories/${categoryId}`, 'DELETE', undefined, true)).status, 200);
    assert.equal((await api.request(`/api/categories/${categoryId}`, 'DELETE', undefined, true)).status, 404);
    const resetCategory = await api.request('/api/categories', 'POST', { name: 'Reset test' }, true);
    const resetCategoryId = resetCategory.body.category.id as string;
    await api.request('/api/products', 'POST', { name: 'Reset item', category_id: resetCategoryId, price: 1 }, true);
    assert.equal((await api.request('/api/menu/reset', 'POST', {}, true)).status, 200);
    assert.deepEqual((await api.request('/api/menu')).body, { categories: [], products: [] });
  } finally {
    await api.close();
  }
});

test('database connection errors return a consistent 503 response', async () => {
  const repository = new InMemoryMenuRepository({ categories: [], products: [] });
  repository.createCategory = async () => { throw Object.assign(new Error('private database detail'), { code: '08006' }); };
  const api = await startTestApi(repository);
  try {
    const result = await api.request('/api/categories', 'POST', { name: 'Sweets' }, true);
    assert.equal(result.status, 503);
    assert.equal(result.body.code, 'DATABASE_UNAVAILABLE');
    assert.equal(JSON.stringify(result.body).includes('private database detail'), false);
  } finally {
    await api.close();
  }
});

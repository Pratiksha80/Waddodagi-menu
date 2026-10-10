import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import express, { type RequestHandler } from 'express';
import test from 'node:test';
import { createMenuRouter } from '../src/server/menuRoutes';
import { InMemoryMenuRepository } from '../src/server/menuRepository';
import { hasValidImageSignature, MAX_PRODUCT_IMAGE_BYTES, SupabaseImageStorage } from '../src/server/imageStorage';

const owner: RequestHandler = (req, res, next) => req.header('x-owner') === 'yes' ? next() : res.status(401).json({ error: 'Owner sign in required.' });
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);

test('storage upload validates signatures, uses unique paths and returns a public URL', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const storage = new SupabaseImageStorage({ url: 'https://project.supabase.co', serviceRoleKey: 'server-secret', bucket: 'menu-images' }, async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response('{}', { status: 200 });
  });
  assert.equal(hasValidImageSignature(png, 'image/png'), true);
  assert.equal(hasValidImageSignature(Buffer.from('not png'), 'image/png'), false);
  const url = await storage.upload(png, 'image/png');
  assert.match(url, /^https:\/\/project\.supabase\.co\/storage\/v1\/object\/public\/menu-images\/products\/[a-f0-9-]+\.png$/);
  assert.equal(calls[0].init?.method, 'POST');
  assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, 'Bearer server-secret');
  assert.equal((calls[0].init?.headers as Record<string, string>)['x-upsert'], 'false');
  assert.equal((calls[0].url).includes('server-secret'), false);
});

test('storage cleanup only deletes this bucket product object and leaves legacy/external URLs alone', async () => {
  const calls: string[] = [];
  const storage = new SupabaseImageStorage({ url: 'https://project.supabase.co', serviceRoleKey: 'secret', bucket: 'menu-images' }, async (input) => {
    calls.push(String(input)); return new Response('[]', { status: 200 });
  });
  await storage.deleteOwnedPublicUrl('data:image/png;base64,abc');
  await storage.deleteOwnedPublicUrl('https://elsewhere.test/image.png');
  await storage.deleteOwnedPublicUrl('https://project.supabase.co/storage/v1/object/public/menu-images/products/abc.png');
  assert.equal(calls.length, 0);
  const ownUrl = 'https://project.supabase.co/storage/v1/object/public/menu-images/products/123e4567-e89b-12d3-a456-426614174000.png';
  await storage.deleteOwnedPublicUrl(ownUrl);
  assert.equal(calls.length, 1);
});

test('image endpoint requires owner, rejects bad MIME/signature, and returns clear storage configuration error', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', createMenuRouter(new InMemoryMenuRepository({ categories: [], products: [] }), owner));
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error?.type === 'entity.too.large') return res.status(413).json({ code: 'IMAGE_TOO_LARGE' });
    return res.status(500).json({ code: 'INTERNAL_ERROR' });
  });
  const server: Server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const send = (type: string, body: Buffer, authorized = true) => fetch(`${base}/api/images`, {
      method: 'POST', headers: { 'Content-Type': type, ...(authorized ? { 'x-owner': 'yes' } : {}) }, body: new Uint8Array(body).buffer,
    });
    assert.equal((await send('image/png', png, false)).status, 401);
    assert.equal((await send('image/svg+xml', png)).status, 415);
    assert.equal((await send('image/png', Buffer.from('wrong'))).status, 415);
    const tooLarge = await send('image/png', Buffer.alloc(MAX_PRODUCT_IMAGE_BYTES + 1));
    assert.equal(tooLarge.status, 413);
    const notConfigured = await send('image/png', png);
    assert.equal(notConfigured.status, 503);
    assert.equal((await notConfigured.json() as any).code, 'IMAGE_STORAGE_UNAVAILABLE');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('image size limit is 5 MiB', () => assert.equal(MAX_PRODUCT_IMAGE_BYTES, 5 * 1024 * 1024));

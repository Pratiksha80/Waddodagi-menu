import express from 'express';
import dotenv from 'dotenv';
import path from 'node:path';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';
const root = path.dirname(fileURLToPath(import.meta.url));
const cookieName = 'mithai_owner_session';
const sessionDurationSeconds = 8 * 60 * 60;
const devFallbackOwner = {
  email: 'owner@example.com',
  password: 'Owner@12345',
  name: 'Shop Owner',
  sessionSecret: 'dev-session-secret-32-characters-long',
};
app.disable('x-powered-by');
// Menu images are sent as base64 data URLs. Increase JSON_BODY_LIMIT on the host
// if large catalogs or images need more space (for example, 250mb).
const jsonBodyLimit = process.env.JSON_BODY_LIMIT || '100mb';
app.use(express.json({ limit: jsonBodyLimit }));

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl?.includes('[YOUR-PASSWORD]') || databaseUrl?.includes('YOUR-PASSWORD')) {
  throw new Error('Replace the Supabase [YOUR-PASSWORD] placeholder in DATABASE_URL with your database password.');
}
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, ssl: process.env.DATABASE_SSL === 'false' ? undefined : { rejectUnauthorized: false } }) : null;
const inMemoryMenuState = { categories: [] as any[], products: [] as any[] };

async function ensureMenuTables() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
    );
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
      price NUMERIC(10,2) NOT NULL CHECK (price >= 0), description TEXT NOT NULL DEFAULT '', image_url TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK (status IN ('available', 'out_of_stock')),
      created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
    );
  `);
}

function requireDatabase(_req: express.Request, res: express.Response, next: express.NextFunction) {
  if (pool) return next();
  return next();
}

function requireOwner(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!sessionUser(req)) return res.status(401).json({ error: 'Owner sign in required.' });
  next();
}

app.get('/api/menu', requireDatabase, async (_req, res) => {
  try {
    if (!pool) {
      res.set('Cache-Control', 'no-store');
      return res.json({ categories: inMemoryMenuState.categories, products: inMemoryMenuState.products });
    }

    const [categories, products] = await Promise.all([
      pool.query('SELECT * FROM categories ORDER BY created_at DESC'),
      pool.query('SELECT * FROM products ORDER BY created_at DESC'),
    ]);
    res.set('Cache-Control', 'no-store');
    return res.json({ categories: categories.rows, products: products.rows });
  } catch (error) {
    console.error('Failed to load shared menu:', error);
    return res.status(500).json({ error: 'Could not load the shared menu.' });
  }
});

app.put('/api/menu', requireDatabase, requireOwner, async (req, res) => {
  const categories = req.body?.categories;
  const products = req.body?.products;
  if (!Array.isArray(categories) || !Array.isArray(products)) return res.status(400).json({ error: 'Categories and products are required.' });

  if (!pool) {
    inMemoryMenuState.categories = categories;
    inMemoryMenuState.products = products;
    return res.json({ success: true });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const publishedAt = new Date().toISOString();
    const normalizedCategories = categories.map((category: any) => ({
      id: String(category.id || ''), name: String(category.name || '').trim(),
      description: String(category.description || ''), created_at: category.created_at || publishedAt, updated_at: category.updated_at || publishedAt,
    }));
    const normalizedProducts = products.map((product: any) => ({
      id: String(product.id || ''), name: String(product.name || '').trim(), category_id: String(product.category_id || ''),
      price: Number(product.price), description: String(product.description || ''), image_url: String(product.image_url || ''),
      status: product.status, created_at: product.created_at || publishedAt, updated_at: product.updated_at || publishedAt,
    }));
    if (normalizedCategories.some((category: any) => !category.id || !category.name)) throw new Error('Invalid category data.');
    if (normalizedProducts.some((product: any) => !product.id || !product.name || !Number.isFinite(product.price) || product.price < 0 || !['available', 'out_of_stock'].includes(product.status))) throw new Error('Invalid product data.');
    await client.query('CREATE TEMP TABLE next_categories (LIKE categories INCLUDING ALL) ON COMMIT DROP');
    await client.query('CREATE TEMP TABLE next_products (LIKE products INCLUDING ALL) ON COMMIT DROP');
    for (const category of normalizedCategories) {
      await client.query('INSERT INTO next_categories (id, name, description, created_at, updated_at) VALUES ($1,$2,$3,$4,$5)', [category.id, category.name, category.description, category.created_at, category.updated_at || publishedAt]);
    }
    for (const product of normalizedProducts) {
      await client.query('INSERT INTO next_products (id, name, category_id, price, description, image_url, status, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [product.id, product.name, product.category_id, product.price, product.description, product.image_url, product.status, product.created_at, product.updated_at || publishedAt]);
    }
    await client.query('DELETE FROM products');
    await client.query('DELETE FROM categories');
    await client.query('INSERT INTO categories SELECT * FROM next_categories');
    await client.query('INSERT INTO products SELECT * FROM next_products');
    await client.query('COMMIT');
    return res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to save shared menu:', error);
    return res.status(400).json({ error: 'Could not save the shared menu. Check category references and menu values.' });
  } finally {
    client.release();
  }
});

function getOwnerConfig() {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase() || (isProduction ? null : devFallbackOwner.email);
  const password = process.env.OWNER_PASSWORD || (isProduction ? null : devFallbackOwner.password);
  const name = process.env.OWNER_NAME?.trim() || (isProduction ? 'Shop Owner' : devFallbackOwner.name);
  return { email, password, name };
}

function signingKey() {
  const key = process.env.SESSION_SECRET || (isProduction ? undefined : devFallbackOwner.sessionSecret);
  if (!key || key.length < 32) throw new Error('SESSION_SECRET must be configured with at least 32 characters.');
  return key;
}

function signature(payload: string) {
  return createHmac('sha256', signingKey()).update(payload).digest('base64url');
}

function sessionUser(req: express.Request) {
  const cookie = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`));
  const value = cookie?.slice(cookieName.length + 1);
  if (!value) return null;
  const [payload, suppliedSignature] = value.split('.');
  if (!payload || !suppliedSignature) return null;
  try {
    const expected = Buffer.from(signature(payload));
    const supplied = Buffer.from(suppliedSignature);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { email: string; exp: number };
    const ownerEmail = getOwnerConfig().email;
    if (session.exp <= Date.now() || session.email !== ownerEmail) return null;
    return { email: session.email, name: getOwnerConfig().name, role: 'owner' as const };
  } catch {
    return null;
  }
}

const attempts = new Map<string, { count: number; resetAt: number }>();
app.post('/api/auth/login', (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const owner = getOwnerConfig();
  const configuredEmail = owner.email;
  const configuredPassword = owner.password;
  if (!configuredEmail || !configuredPassword) return res.status(503).json({ error: 'Owner authentication is not configured on the server.' });

  const now = Date.now();
  const ip = req.ip || 'unknown';
  const attempt = attempts.get(ip);
  if (attempt && attempt.resetAt > now && attempt.count >= 10) return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
  if (!attempt || attempt.resetAt <= now) attempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
  else attempt.count += 1;

  const suppliedHash = createHmac('sha256', 'login-compare').update(`${email}\0${password}`).digest();
  const expectedHash = createHmac('sha256', 'login-compare').update(`${configuredEmail}\0${configuredPassword}`).digest();
  if (!timingSafeEqual(suppliedHash, expectedHash)) return res.status(401).json({ error: 'Invalid email or password.' });

  attempts.delete(ip);
  const payload = Buffer.from(JSON.stringify({ email: configuredEmail, exp: now + sessionDurationSeconds * 1000 })).toString('base64url');
  res.cookie(cookieName, `${payload}.${signature(payload)}`, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: sessionDurationSeconds * 1000,
  });
  return res.json({ user: { email: configuredEmail, name: owner.name, role: 'owner' } });
});

app.get('/api/auth/session', (req, res) => {
  const user = sessionUser(req);
  return user ? res.json({ user }) : res.status(401).json({ user: null });
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie(cookieName, { httpOnly: true, secure: isProduction, sameSite: 'strict', path: '/' });
  return res.status(204).end();
});

app.get('/api/admin/session', (req, res) => {
  const user = sessionUser(req);
  return user ? res.json({ user }) : res.status(401).json({ error: 'Authentication required.' });
});

app.use((req, res, next) => {
  if (req.path.startsWith('/admin') && req.path !== '/admin/login' && !sessionUser(req)) {
    return res.redirect(302, `/admin/login?redirect=${encodeURIComponent(req.originalUrl)}`);
  }
  return next();
});

app.use((error: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ error: `Upload exceeds the server request limit (${jsonBodyLimit}). Increase JSON_BODY_LIMIT in the server environment.` });
  }
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: 'Request data is invalid.' });
  }
  return next(error);
});

if (isProduction) {
  await ensureMenuTables();
  app.use(express.static(path.join(root, 'dist')));
  app.get('*', (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
  app.listen(port, '0.0.0.0', () => console.log(`App listening on ${port}`));
} else {
  await ensureMenuTables();
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
  app.listen(port, '0.0.0.0', () => console.log(`Dev app listening on http://localhost:${port}`));
}

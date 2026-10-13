import express from 'express';
import dotenv from 'dotenv';
import path from 'node:path';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { loadServerConfig } from './src/server/config';
import { InMemoryMenuRepository, PostgresMenuRepository } from './src/server/menuRepository';
import { createMenuRouter } from './src/server/menuRoutes';
import { SupabaseImageStorage } from './src/server/imageStorage';
import type { DatabaseState } from './src/types/database';

// Use one ignored local env file. Host-level environment variables take precedence.
dotenv.config({ path: '.env', override: false, quiet: true });

const isProduction = process.env.NODE_ENV === 'production';
const config = loadServerConfig(process.env, isProduction);
const app = express();
const port = config.port;
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
// JSON_BODY_LIMIT applies to API JSON payloads. Product files use a separate 5 MiB raw-body limit.
const jsonBodyLimit = config.jsonBodyLimit;
// Public client error reports have a much smaller limit than menu mutation payloads.
app.use('/api/client-errors', express.json({ limit: '8kb' }));
app.use(express.json({ limit: jsonBodyLimit }));

const databaseUrl = config.databaseUrl;
const pool = databaseUrl ? new Pool({
  connectionString: databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: config.databaseConnectionTimeoutMs,
  idleTimeoutMillis: config.databaseIdleTimeoutMs,
  max: config.databasePoolMax,
}) : null;
pool?.on('error', (error) => {
  const code = (error as { code?: string }).code || 'UNCLASSIFIED';
  console.error('Unexpected idle PostgreSQL client error (details redacted).', { code });
});
const inMemoryMenuState: DatabaseState = { categories: [], products: [] };
const menuRepository = pool ? new PostgresMenuRepository(pool) : new InMemoryMenuRepository(inMemoryMenuState);

async function ensureMenuTables() {
  if (!pool) {
    if (isProduction) throw new Error('DATABASE_URL is required in production; refusing to use temporary in-memory menu storage.');
    return;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT '', image_url TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
    );
    ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT '';
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
      price NUMERIC(10,2) NOT NULL CHECK (price >= 0), description TEXT NOT NULL DEFAULT '', image_url TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK (status IN ('available', 'out_of_stock')),
      created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL
    );
  `);
}

function requireOwner(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!sessionUser(req)) return res.status(401).json({ error: 'Owner sign in required.' });
  next();
}

const imageStorage = new SupabaseImageStorage({
  url: config.supabaseUrl,
  serviceRoleKey: config.supabaseServiceRoleKey,
  bucket: config.supabaseStorageBucket,
});
app.use('/api', createMenuRouter(menuRepository, requireOwner, imageStorage));

function getOwnerConfig() {
  const email = config.ownerEmail || (isProduction ? null : devFallbackOwner.email);
  const password = config.ownerPassword || (isProduction ? null : devFallbackOwner.password);
  const name = config.ownerName || (isProduction ? 'Shop Owner' : devFallbackOwner.name);
  return { email, password, name };
}

function signingKey() {
  const key = config.sessionSecret || (isProduction ? undefined : devFallbackOwner.sessionSecret);
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
    if (_req.path === '/api/images') return res.status(413).json({ error: 'Image exceeds the 5 MiB per-file limit.', code: 'IMAGE_TOO_LARGE' });
    return res.status(413).json({ error: `Upload exceeds the server request limit (${jsonBodyLimit}). Increase JSON_BODY_LIMIT in the server environment.` });
  }
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: 'Request data is invalid.' });
  }
  const code = typeof error?.code === 'string' ? error.code : undefined;
  console.error('Unhandled HTTP request error (details redacted).', { name: error instanceof Error ? error.name : 'UnknownError', code: code || 'UNCLASSIFIED' });
  return res.status(500).json({ error: 'The request could not be completed.', code: 'INTERNAL_ERROR' });
});

process.on('unhandledRejection', (reason) => {
  const code = typeof reason === 'object' && reason !== null && 'code' in reason && typeof reason.code === 'string' ? reason.code : undefined;
  console.error('Unhandled promise rejection (details redacted).', { name: reason instanceof Error ? reason.name : 'UnknownError', code: code || 'UNCLASSIFIED' });
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught server exception (details redacted).', { name: error.name, code: (error as NodeJS.ErrnoException).code || 'UNCLASSIFIED' });
  setTimeout(() => process.exit(1), 5500).unref();
});

if (isProduction) {
  try {
    await ensureMenuTables();
    console.log('PostgreSQL connection and menu schema are ready.');
  } catch (error) {
    const code = (error as { code?: string })?.code || 'UNCLASSIFIED';
    console.error('PostgreSQL startup check failed; verify the configured database URI, network access, and schema permissions. Details redacted.', { code });
    process.exit(1);
  }
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

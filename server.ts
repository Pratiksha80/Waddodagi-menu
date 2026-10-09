import express from 'express';
import dotenv from 'dotenv';
import path from 'node:path';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';
const root = path.dirname(fileURLToPath(import.meta.url));
const cookieName = 'mithai_owner_session';
const sessionDurationSeconds = 8 * 60 * 60;
app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));

function signingKey() {
  const key = process.env.SESSION_SECRET;
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
    if (session.exp <= Date.now() || session.email !== process.env.OWNER_EMAIL?.trim().toLowerCase()) return null;
    return { email: session.email, name: process.env.OWNER_NAME?.trim() || 'Shop Owner', role: 'owner' as const };
  } catch {
    return null;
  }
}

const attempts = new Map<string, { count: number; resetAt: number }>();
app.post('/api/auth/login', (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const configuredEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const configuredPassword = process.env.OWNER_PASSWORD;
  if (!configuredEmail || !configuredPassword || !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) return res.status(503).json({ error: 'Owner authentication is not configured on the server.' });

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
  return res.json({ user: { email: configuredEmail, name: process.env.OWNER_NAME?.trim() || 'Shop Owner', role: 'owner' } });
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

if (isProduction) {
  app.use(express.static(path.join(root, 'dist')));
  app.get('*', (_req, res) => res.sendFile(path.join(root, 'dist', 'index.html')));
  app.listen(port, '0.0.0.0', () => console.log(`App listening on ${port}`));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
  app.listen(port, '0.0.0.0', () => console.log(`Dev app listening on http://localhost:${port}`));
}

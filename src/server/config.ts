export interface ServerConfig {
  port: number;
  databaseUrl?: string;
  databaseSsl: boolean;
  databaseConnectionTimeoutMs: number;
  databaseIdleTimeoutMs: number;
  databasePoolMax: number;
  jsonBodyLimit: string;
  ownerEmail?: string;
  ownerPassword?: string;
  ownerName?: string;
  sessionSecret?: string;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  supabaseStorageBucket?: string;
}

function fail(message: string): never {
  throw new Error(`Invalid server configuration: ${message}`);
}

function positiveInteger(env: NodeJS.ProcessEnv, name: string, fallback: number, maximum = Number.MAX_SAFE_INTEGER): number {
  const raw = env[name];
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw.trim())) fail(`${name} must be a positive integer.`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    fail(`${name} must be between 1 and ${maximum}.`);
  }
  return value;
}

function parseBodyLimit(value: string): string {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i);
  if (!match) fail('JSON_BODY_LIMIT must be a positive byte size such as 1048576, 1mb, or 100mb.');
  const amount = Number(match[1]);
  const units: Record<string, number> = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };
  const bytes = amount * units[(match[2] || 'b').toLowerCase()];
  if (!Number.isFinite(bytes) || bytes < 1 || bytes > Number.MAX_SAFE_INTEGER) {
    fail('JSON_BODY_LIMIT must represent a positive, safe byte size.');
  }
  return value.trim();
}

export function loadServerConfig(env: NodeJS.ProcessEnv, isProduction: boolean): ServerConfig {
  const databaseUrl = env.DATABASE_URL?.trim() || undefined;
  if (isProduction && !databaseUrl) fail('DATABASE_URL is required in production.');
  if (databaseUrl) {
    if (databaseUrl.includes('YOUR-PASSWORD') || databaseUrl.includes('YOUR_POOLER_HOST')) {
      fail('DATABASE_URL contains a template placeholder. Copy the complete provider URI.');
    }
    try {
      const parsed = new URL(databaseUrl);
      if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname || !parsed.username || !parsed.pathname.slice(1)) {
        fail('DATABASE_URL must be a PostgreSQL URI with a host, username, and database name.');
      }
      if (isProduction && parsed.hostname.startsWith('db.') && parsed.hostname.endsWith('.supabase.co')) {
        fail('The Supabase direct endpoint may be unreachable from an IPv4-only host; use the Session Pooler URI or verify IPv6 support.');
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Invalid server configuration:')) throw error;
      fail('DATABASE_URL is not a valid PostgreSQL connection URI.');
    }
  }

  const sslRaw = env.DATABASE_SSL === undefined ? 'true' : env.DATABASE_SSL.trim().toLowerCase();
  if (sslRaw !== 'true' && sslRaw !== 'false') fail('DATABASE_SSL must be either true or false.');

  const ownerEmail = env.OWNER_EMAIL?.trim().toLowerCase() || undefined;
  const ownerPassword = env.OWNER_PASSWORD;
  if (isProduction && !ownerEmail) fail('OWNER_EMAIL is required in production.');
  if (isProduction && (!ownerPassword || !ownerPassword.trim())) fail('OWNER_PASSWORD is required in production.');
  if (ownerEmail && (ownerEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail))) fail('OWNER_EMAIL must be a valid email address.');

  const sessionSecret = env.SESSION_SECRET;
  if (isProduction && !sessionSecret) fail('SESSION_SECRET is required in production.');
  if (sessionSecret && sessionSecret.trim().length < 32) fail('SESSION_SECRET must contain at least 32 non-whitespace characters.');

  const supabaseUrl = env.SUPABASE_URL?.trim() || undefined;
  const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined;
  const supabaseStorageBucket = env.SUPABASE_STORAGE_BUCKET?.trim() || undefined;
  const storageValues = [supabaseUrl, supabaseServiceRoleKey, supabaseStorageBucket];
  if (storageValues.some(Boolean) && !storageValues.every(Boolean)) {
    fail('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_STORAGE_BUCKET must be configured together to enable image storage.');
  }
  if (supabaseUrl) {
    try {
      const parsed = new URL(supabaseUrl);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
        fail('SUPABASE_URL must be an HTTPS project URL without credentials or a path.');
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Invalid server configuration:')) throw error;
      fail('SUPABASE_URL is invalid.');
    }
  }
  if (supabaseStorageBucket && !/^[a-z0-9][a-z0-9_-]{0,62}$/.test(supabaseStorageBucket)) {
    fail('SUPABASE_STORAGE_BUCKET must be a valid bucket name.');
  }

  return {
    port: positiveInteger(env, 'PORT', 3000, 65535),
    databaseUrl,
    databaseSsl: sslRaw === 'true',
    databaseConnectionTimeoutMs: positiveInteger(env, 'DATABASE_CONNECTION_TIMEOUT_MS', 10000),
    databaseIdleTimeoutMs: positiveInteger(env, 'DATABASE_IDLE_TIMEOUT_MS', 30000),
    databasePoolMax: positiveInteger(env, 'DATABASE_POOL_MAX', 3),
    jsonBodyLimit: parseBodyLimit(env.JSON_BODY_LIMIT === undefined ? '100mb' : env.JSON_BODY_LIMIT),
    ownerEmail,
    ownerPassword,
    ownerName: env.OWNER_NAME?.trim() || undefined,
    sessionSecret,
    supabaseUrl: supabaseUrl?.replace(/\/$/, ''),
    supabaseServiceRoleKey,
    supabaseStorageBucket,
  };
}

import assert from 'node:assert/strict';
import test from 'node:test';
import { loadServerConfig } from '../src/server/config';

const goodProductionEnv: NodeJS.ProcessEnv = {
  DATABASE_URL: 'postgresql://menu_user:private-value@db.example.test:5432/menu',
  DATABASE_SSL: 'true',
  OWNER_EMAIL: 'owner@example.com',
  OWNER_PASSWORD: 'private-owner-password',
  SESSION_SECRET: '12345678901234567890123456789012',
};

test('production requires database, owner credentials, and session secret', () => {
  for (const key of ['DATABASE_URL', 'OWNER_EMAIL', 'OWNER_PASSWORD', 'SESSION_SECRET']) {
    const env = { ...goodProductionEnv };
    delete env[key];
    assert.throws(() => loadServerConfig(env, true), new RegExp(`${key} is required`));
  }
});

test('valid production config applies defaults and parses optional settings', () => {
  const defaults = loadServerConfig({ ...goodProductionEnv }, true);
  assert.equal(defaults.port, 3000);
  assert.equal(defaults.databaseConnectionTimeoutMs, 10000);
  assert.equal(defaults.databaseIdleTimeoutMs, 30000);
  assert.equal(defaults.databasePoolMax, 3);
  assert.equal(defaults.jsonBodyLimit, '100mb');

  const configured = loadServerConfig({
    ...goodProductionEnv,
    PORT: '8080',
    DATABASE_SSL: 'false',
    DATABASE_CONNECTION_TIMEOUT_MS: '5000',
    DATABASE_IDLE_TIMEOUT_MS: '45000',
    DATABASE_POOL_MAX: '4',
    JSON_BODY_LIMIT: '32mb',
  }, true);
  assert.equal(configured.port, 8080);
  assert.equal(configured.databaseSsl, false);
  assert.equal(configured.databaseConnectionTimeoutMs, 5000);
  assert.equal(configured.databaseIdleTimeoutMs, 45000);
  assert.equal(configured.databasePoolMax, 4);
  assert.equal(configured.jsonBodyLimit, '32mb');
});

test('invalid supplied optional settings fail with redacted messages', () => {
  const invalidValues: Array<[string, string]> = [
    ['DATABASE_SSL', 'sometimes'], ['PORT', '70000'], ['DATABASE_CONNECTION_TIMEOUT_MS', '0'],
    ['DATABASE_IDLE_TIMEOUT_MS', '-1'], ['DATABASE_POOL_MAX', 'one'], ['JSON_BODY_LIMIT', 'huge'],
  ];
  for (const [key, value] of invalidValues) {
    const env = { ...goodProductionEnv, [key]: value };
    assert.throws(() => loadServerConfig(env, true), (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, new RegExp(key));
      assert.equal(error.message.includes('private-value'), false);
      assert.equal(error.message.includes('private-owner-password'), false);
      return true;
    });
  }
});

test('production rejects malformed required values without echoing values', () => {
  assert.throws(() => loadServerConfig({ ...goodProductionEnv, DATABASE_URL: 'not-a-uri-private-value' }, true), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /DATABASE_URL/);
    assert.equal(error.message.includes('not-a-uri-private-value'), false);
    return true;
  });
  assert.throws(() => loadServerConfig({ ...goodProductionEnv, OWNER_EMAIL: 'bad-email' }, true), /OWNER_EMAIL/);
  assert.throws(() => loadServerConfig({ ...goodProductionEnv, OWNER_PASSWORD: '   ' }, true), /OWNER_PASSWORD/);
  assert.throws(() => loadServerConfig({ ...goodProductionEnv, SESSION_SECRET: 'short-secret' }, true), /SESSION_SECRET/);
  assert.throws(() => loadServerConfig({ ...goodProductionEnv, SESSION_SECRET: ' '.repeat(40) }, true), /SESSION_SECRET/);
});

test('development keeps database and owner fallbacks while validating supplied options', () => {
  const config = loadServerConfig({}, false);
  assert.equal(config.databaseUrl, undefined);
  assert.equal(config.port, 3000);
  assert.equal(config.databaseSsl, true);
  assert.throws(() => loadServerConfig({ PORT: 'invalid' }, false), /PORT/);
});

test('image storage settings are optional but must be supplied as a complete set', () => {
  const config = loadServerConfig({ ...goodProductionEnv }, true);
  assert.equal(config.supabaseUrl, undefined);
  assert.throws(() => loadServerConfig({ ...goodProductionEnv, SUPABASE_URL: 'https://project.supabase.co' }, true), /must be configured together/);
  assert.throws(() => loadServerConfig({ ...goodProductionEnv, SUPABASE_URL: 'http://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'private-storage-key', SUPABASE_STORAGE_BUCKET: 'menu' }, true), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message.includes('private-storage-key'), false);
    return true;
  });
});

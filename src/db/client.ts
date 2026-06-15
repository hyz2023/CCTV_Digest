import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

type DB = NeonHttpDatabase<typeof schema>;

let cached: DB | undefined;

/**
 * Lazily create the Drizzle client. The connection (and the DATABASE_URL
 * requirement) is deferred to first use, so importing this module never throws —
 * pure code paths (e.g. config merging) can import alongside it in tests without
 * a live database.
 */
export function getDb(): DB {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  cached = drizzle(neon(url), { schema });
  return cached;
}

/**
 * Convenience handle. Property access is forwarded to the lazily-initialized
 * client, so `db.select(...)` works while merely importing `db` does not connect.
 */
export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const instance = getDb() as unknown as Record<string | symbol, unknown>;
    return instance[prop];
  },
});

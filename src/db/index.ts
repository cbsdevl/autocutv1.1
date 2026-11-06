// src/db/index.ts
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

// Add global connection pool caching to persist across hot-reloads
declare global {
  var _postgresPool: Pool | undefined;
}

// Function to create or retrieve the connection pool.
export const createPool = () => {
  if (!global._postgresPool) {
    const connectionString = process.env.DATABASE_URL;
    const host = process.env.SQL_HOST || process.env.PGHOST;
    const user = process.env.SQL_USER || process.env.PGUSER;
    const database = process.env.SQL_DB_NAME || process.env.PGDATABASE;

    if (!connectionString && (!host || !user || !database)) {
      console.warn(
        '[Database] Configuration is incomplete. Set DATABASE_URL or SQL_HOST, SQL_USER, and SQL_DB_NAME.',
      );
    }

    global._postgresPool = new Pool({
      ...(connectionString ? { connectionString } : {
        host,
        user,
        password: process.env.SQL_PASSWORD || process.env.PGPASSWORD,
        database,
        port: Number(process.env.SQL_PORT || process.env.PGPORT) || 5432,
      }),
      max: 10,
      connectionTimeoutMillis: 15000,
    });

    // Prevent unhandled pool-level errors from crashing the application
    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

// Create or retrieve the pool instance.
const pool = createPool();

// Initialize Drizzle with the pool and schema.
export const db = drizzle(pool, { schema });
export { schema };

// lib/db.ts
import { Pool } from "pg";

declare global {
    // eslint-disable-next-line no-var
    var __pgPool: Pool | undefined;
}

function makePool(): Pool | null {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) return null;

    // Railway commonly needs SSL in hosted environments
    const ssl =
        process.env.PGSSLMODE === "require" || connectionString.includes("sslmode=require")
            ? { rejectUnauthorized: false }
            : undefined;

    return new Pool({ connectionString, ssl });
}

/**
 * Lazy singleton Pool.
 * - Returns null if DATABASE_URL isn't set (lets JSON fallback work in local dev/build).
 * - In production with DATABASE_URL set, you'll always get a Pool.
 */
export function getPool(): Pool | null {
    if (global.__pgPool) return global.__pgPool;

    const pool = makePool();
    if (!pool) return null;

    if (process.env.NODE_ENV !== "production") global.__pgPool = pool;
    return pool;
}


import { Pool } from "pg";
export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString)
    throw new Error(
      "DATABASE_URL is missing. Run scripts/setup-local.ps1 or configure .env.",
    );
  return new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 3000,
    statement_timeout: 15000,
  });
}

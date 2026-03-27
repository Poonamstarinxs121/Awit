import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function query(text: string, params?: unknown[]) {
  return pool.query(text, params);
}

export async function setTenantContext(client: pg.PoolClient, tenantId: string) {
  await client.query(`SET LOCAL app.tenant_id = $1`, [tenantId]);
}

export { pool };

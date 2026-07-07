import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

if (!process.env.LAMBDA_TASK_ROOT) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

let pool: InstanceType<typeof Pool> | null = null;

async function getPool(): Promise<InstanceType<typeof Pool>> {
  if (pool) return pool;

  let user = process.env.DB_USER;
  let password = process.env.DB_PASSWORD;

  if (process.env.DATABASE_SECRET_ARN) {
    const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');
    const client = new SecretsManagerClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
    const response = await client.send(new GetSecretValueCommand({ SecretId: process.env.DATABASE_SECRET_ARN }));
    const secret = JSON.parse(response.SecretString!);
    user = secret.username;
    password = secret.password;
  }

  pool = new Pool({
    user,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password,
    // Aurora/RDS Postgres enforces SSL (rds.force_ssl); the RDS CA isn't in
    // Node's trust store, so skip chain verification rather than bundle it.
    ssl: process.env.DATABASE_SECRET_ARN ? { rejectUnauthorized: false } : undefined,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    // A paused Aurora Serverless v2 cluster takes ~15s to resume on first
    // connection, so the timeout must comfortably exceed that.
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT_MS ?? '30000', 10),
    idleTimeoutMillis: 30000,
  });

  pool.on('connect', () => console.log('Connected to PostgreSQL database.'));
  pool.on('error', (err: Error) => console.error('Unexpected error on idle database client:', err.message));

  return pool;
}

export const query = async (text: string, params: any[] = []) => {
  const p = await getPool();
  return p.query(text, params);
};

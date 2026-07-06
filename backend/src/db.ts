import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// In Lambda, env vars are injected by the runtime — skip dotenv entirely.
// Locally, walk up two directories to find the root .env file.
if (!process.env.LAMBDA_TASK_ROOT) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

// 🔬 Debug Log: Confirm the system reads your root configuration
console.log("🔍 DB Debug Init - Password Loaded:", process.env.DB_PASSWORD ? "YES (secret)" : "NO (undefined)");

export const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD, 
  port: parseInt(process.env.DB_PORT || '5432', 10),
  connectionTimeoutMillis: 5000, 
  idleTimeoutMillis: 30000
});

pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database.');
});

pool.on('error', (err: Error) => {
  console.error('❌ Unexpected error on idle database client:', err.message);
});

export const query = (text: string, params: any[] = []) => pool.query(text, params);
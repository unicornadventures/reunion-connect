import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 🚨 Step backwards out of "src" and "backend" to reach your root folder
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, '../../.env');

// Force dotenv to load the root file explicitly
dotenv.config({ path: rootEnvPath });

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
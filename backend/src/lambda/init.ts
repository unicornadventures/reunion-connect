import { initializeDatabase } from '../schema.js';

// Runs once per Lambda container cold start. All handlers await this before
// touching the DB so migrations are always applied before any query.
export const dbReady: Promise<void> = initializeDatabase().catch(err => {
  console.error('Database initialization failed:', err);
});

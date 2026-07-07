import { initializeDatabase } from '../schema.js';
import { seedAdminUser } from '../seed.js';

// The seed password lives in an SSM SecureString parameter so it never
// appears in the repo, the template, or the Lambda environment.
async function fetchAdminSeedPassword(): Promise<string | null> {
  const paramName = process.env.ADMIN_SEED_PASSWORD_PARAM;
  if (!paramName) return null;

  try {
    const { SSMClient, GetParameterCommand } = await import('@aws-sdk/client-ssm');
    const client = new SSMClient({ region: process.env.AWS_REGION ?? 'us-east-1' });
    const response = await client.send(new GetParameterCommand({ Name: paramName, WithDecryption: true }));
    return response.Parameter?.Value ?? null;
  } catch (err: any) {
    if (err.name === 'ParameterNotFound') {
      console.warn(`Admin seed parameter ${paramName} not found. Skipping seeding.`);
      return null;
    }
    throw err;
  }
}

// Runs once per Lambda container cold start. All handlers await this before
// touching the DB so migrations are always applied before any query.
export const dbReady: Promise<void> = initializeDatabase()
  .then(async () => {
    // seedAdminUser is a no-op if the admin already exists
    const password = await fetchAdminSeedPassword();
    if (password) {
      await seedAdminUser(password);
    }
  })
  .catch(err => {
    console.error('Database initialization failed:', err);
  });

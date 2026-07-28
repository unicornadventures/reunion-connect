import { RDSDataClient, ExecuteStatementCommand, SqlParameter, TypeHint } from '@aws-sdk/client-rds-data';

// For Lambdas that run outside the VPC (no direct Postgres connection) and
// reach Aurora via the Data API's public HTTPS endpoint instead.
const client = new RDSDataClient({ region: process.env.AWS_REGION ?? 'us-east-1' });

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// A paused Aurora Serverless v2 cluster takes ~15s to resume (see db.ts), and
// the Data API returns this immediately on the first call instead of
// blocking like a direct pg connection does — so callers must retry it
// themselves. Backoff totals ~15s across 5 attempts, comfortably inside API
// Gateway's 29s hard timeout ceiling alongside the rest of the handler.
const RESUME_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];

const isDatabaseResuming = (err: any): boolean => err?.name === 'DatabaseResumingException';

export interface DataApiParam {
  name: string;
  value: string | number | boolean | null;
  typeHint?: TypeHint;
}

const toField = (param: DataApiParam): SqlParameter => {
  const { name, value, typeHint } = param;
  if (value === null) return { name, value: { isNull: true } };
  if (typeof value === 'number') return { name, value: { longValue: value } };
  if (typeof value === 'boolean') return { name, value: { booleanValue: value } };
  return { name, value: { stringValue: value }, typeHint };
};

// Data API's TIMESTAMP type hint expects Postgres wire format
// ("YYYY-MM-DD HH:MM:SS.sss"), not ISO 8601's "T"/"Z" separators.
export const toPgTimestamp = (date: Date): string => date.toISOString().replace('T', ' ').replace('Z', '');

// Runs a single SQL statement against the Aurora cluster via Data API and
// returns rows as plain objects keyed by column name. Transparently retries
// with backoff if the cluster is resuming from an auto-pause.
export const dataApiQuery = async (sql: string, parameters: DataApiParam[] = []): Promise<any[]> => {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await client.send(new ExecuteStatementCommand({
        resourceArn: process.env.DB_CLUSTER_ARN,
        secretArn: process.env.DATABASE_SECRET_ARN,
        database: process.env.DB_NAME,
        sql,
        parameters: parameters.map(toField),
        formatRecordsAs: 'JSON',
      }));

      return response.formattedRecords ? JSON.parse(response.formattedRecords) : [];
    } catch (err: any) {
      if (!isDatabaseResuming(err) || attempt >= RESUME_RETRY_DELAYS_MS.length) throw err;
      await sleep(RESUME_RETRY_DELAYS_MS[attempt]);
    }
  }
};

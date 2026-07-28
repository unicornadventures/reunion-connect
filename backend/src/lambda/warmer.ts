import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const client = new LambdaClient({ region: process.env.AWS_REGION ?? 'us-east-1' });

// Runs on a schedule to keep hot-path Lambdas' execution environments warm.
// Invoked with an empty payload, every target rejects on auth or missing
// parameters before its first `query()` call, so this never wakes the
// (deliberately pausable) Aurora cluster — see RDSCluster in template.yaml.
export const warmerHandler = async (): Promise<void> => {
  const targets = (process.env.WARM_FUNCTION_NAMES ?? '').split(',').filter(Boolean);

  await Promise.all(
    targets.map(FunctionName =>
      client
        .send(new InvokeCommand({
          FunctionName,
          InvocationType: 'Event',
          Payload: Buffer.from('{}')
        }))
        .catch(err => console.error(`Warm ping failed for ${FunctionName}:`, err))
    )
  );
};

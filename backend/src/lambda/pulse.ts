import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export const pulseHandler = async (_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => ({
  statusCode: 200,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  },
  body: JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() })
});

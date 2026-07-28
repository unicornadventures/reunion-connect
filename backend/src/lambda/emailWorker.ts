import { SQSEvent, SQSHandler } from 'aws-lambda';
import { sendPasswordResetEmail } from '../services/emailService.js';

// Runs outside the VPC (SES has no VPC endpoint here), triggered by messages
// forgotPasswordHandler enqueues after generating a reset token via Data API.
export const sendPasswordResetEmailHandler: SQSHandler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    const { email, token } = JSON.parse(record.body);
    await sendPasswordResetEmail(email, token, process.env.FRONTEND_URL);
  }
};

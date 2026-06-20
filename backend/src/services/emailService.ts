import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

// Initialize AWS SES Client
const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

// Determine if we're in development mode (use console logging if no AWS credentials)
const isDevelopment = !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY;

const sendEmail = async (options: EmailOptions): Promise<void> => {
  if (isDevelopment) {
    // Development mode: log to console
    console.log('\n📧 EMAIL SERVICE (Development Mode - AWS SES Disabled)');
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log('---');
    console.log(options.html);
    console.log('---\n');
    return;
  }

  try {
    const command = new SendEmailCommand({
      Source: process.env.SES_FROM_EMAIL || 'noreply@classyear.com',
      Destination: {
        ToAddresses: [options.to]
      },
      Message: {
        Subject: {
          Data: options.subject,
          Charset: 'UTF-8'
        },
        Body: {
          Html: {
            Data: options.html,
            Charset: 'UTF-8'
          }
        }
      }
    });

    await sesClient.send(command);
    console.log(`✅ Email sent to ${options.to}`);
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    throw new Error('Failed to send email');
  }
};

export const sendPasswordResetEmail = async (
  email: string,
  resetToken: string,
  frontendUrl: string = 'http://localhost:5174'
): Promise<void> => {
  const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

  const html = `
    <h2>Password Reset Request</h2>
    <p>You requested a password reset for your ClassYear account.</p>
    <p>Click the link below to reset your password (valid for 1 hour):</p>
    <p><a href="${resetLink}">${resetLink}</a></p>
    <p>If you didn't request this, you can safely ignore this email.</p>
  `;

  await sendEmail({
    to: email,
    subject: 'ClassYear - Password Reset',
    html
  });
};

export const sendVerificationEmail = async (
  email: string,
  verificationToken: string,
  frontendUrl: string = 'http://localhost:5174'
): Promise<void> => {
  const verificationLink = `${frontendUrl}/verify-email?token=${verificationToken}`;

  const html = `
    <h2>Verify Your Email</h2>
    <p>Welcome to ClassYear! Click the link below to verify your email address:</p>
    <p><a href="${verificationLink}">${verificationLink}</a></p>
    <p>This link is valid for 24 hours.</p>
  `;

  await sendEmail({
    to: email,
    subject: 'ClassYear - Verify Your Email',
    html
  });
};

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  console.log('\n📧 EMAIL SERVICE (Development Mode)');
  console.log(`To: ${options.to}`);
  console.log(`Subject: ${options.subject}`);
  console.log('---');
  console.log(options.html);
  console.log('---\n');
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

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';

const VerifyEmail: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyToken = async () => {
      const verificationToken = searchParams.get('token');
      if (!verificationToken) {
        setError('Invalid or missing verification token. Please request a new verification link.');
        setLoading(false);
        return;
      }

      setToken(verificationToken);

      try {
        await api.post('/auth/verify-email', { token: verificationToken });
        setSuccess(true);
        setTimeout(() => navigate('/login'), 3000);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to verify email. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [searchParams, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-5">
        <div className="w-full max-w-[600px] flex flex-col items-center gap-10">
          <div className="text-center mt-10">
            <div className="text-6xl mb-4">🎓</div>
            <h1 className="text-5xl font-bold text-[#4CAF50] mb-2">ReunionConnect</h1>
          </div>

          <div className="w-full bg-white rounded-2xl px-12 py-14 shadow-md border border-[#E0E0E0]">
            <div className="text-center">
              <div className="text-4xl mb-4 animate-pulse">⏳</div>
              <h2 className="text-2xl font-bold text-[#333333] mb-4">Verifying Your Email</h2>
              <p className="text-[#666666]">Please wait while we verify your email address...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-5">
        <div className="w-full max-w-[600px] flex flex-col items-center gap-10">
          <div className="text-center mt-10">
            <div className="text-6xl mb-4">🎓</div>
            <h1 className="text-5xl font-bold text-[#4CAF50] mb-2">ReunionConnect</h1>
          </div>

          <div className="w-full bg-white rounded-2xl px-12 py-14 shadow-md border border-[#E0E0E0]">
            <div className="text-center">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-[#4CAF50] mb-4">Email Verified!</h2>
              <p className="text-[#666666] mb-6">
                Your email has been successfully verified. You can now sign in to your account.
              </p>
              <p className="text-sm text-[#999999]">Redirecting to login...</p>
            </div>
          </div>

          <div className="text-center text-sm text-[#999999] mb-10">
            🔒 Your account is now fully activated
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-5">
      <div className="w-full max-w-[600px] flex flex-col items-center gap-10">
        <div className="text-center mt-10">
          <div className="text-6xl mb-4">🎓</div>
          <h1 className="text-5xl font-bold text-[#4CAF50] mb-2">ReunionConnect</h1>
          <p className="text-[#666666] text-base">Email Verification</p>
        </div>

        <div className="w-full bg-white rounded-2xl px-12 py-14 shadow-md border border-[#E0E0E0]">
          <div className="text-center">
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-2xl font-bold text-[#C62828] mb-4">Verification Failed</h2>
            <p className="text-[#666666] mb-6">{error}</p>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/register')}
                className="w-full bg-[#4CAF50] text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity"
              >
                Create New Account
              </button>
              <button
                onClick={() => navigate('/login')}
                className="w-full bg-[#2196F3] text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity"
              >
                Back to Login
              </button>
            </div>
          </div>
        </div>

        <div className="text-center text-sm text-[#999999] mb-10">
          🔒 Your account is safe with us
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;

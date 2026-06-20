import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await api.post('/auth/forgot-password', { email });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
              <div className="text-5xl mb-4">✉️</div>
              <h2 className="text-2xl font-bold text-[#4CAF50] mb-4">Check Your Email</h2>
              <p className="text-[#666666] mb-4">
                If an account exists with that email address, we've sent a password reset link.
              </p>
              <p className="text-sm text-[#999999] mb-6">
                The link will expire in 1 hour. You'll be redirected to login shortly.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="text-[#2196F3] font-semibold hover:opacity-80 transition-opacity"
              >
                Back to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-5">
      <div className="w-full max-w-[600px] flex flex-col items-center gap-10">
        {/* Header */}
        <div className="text-center mt-10">
          <div className="text-6xl mb-4">🎓</div>
          <h1 className="text-5xl font-bold text-[#4CAF50] mb-2">ReunionConnect</h1>
          <p className="text-[#666666] text-base">Reset Your Password</p>
        </div>

        {/* Forgot Password Card */}
        <div className="w-full bg-white rounded-2xl px-12 py-14 shadow-md border border-[#E0E0E0]">
          <h2 className="text-3xl font-bold text-[#333333] mb-4">Forgot Your Password?</h2>
          <p className="text-[#666666] text-base mb-8">
            Enter your email address and we'll send you a link to reset your password.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-[#FFEBEE] text-[#C62828] border border-[#EF5350] rounded px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-base font-semibold text-[#333333]">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                placeholder="your@email.com"
                className="w-full border border-[#DDDDDD] rounded-lg px-4 py-3 text-base focus:outline-none focus:border-[#4CAF50] placeholder:text-[#999999]"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className={`w-full font-bold py-3 rounded-lg text-lg transition-opacity mt-2 ${
                loading || !email
                  ? 'bg-[#CCCCCC] text-gray-700 cursor-not-allowed'
                  : 'bg-[#4CAF50] text-white hover:opacity-90 cursor-pointer'
              }`}
            >
              {loading ? 'Sending Email...' : 'Send Reset Link'}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-[#EEEEEE] text-center">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-[#2196F3] text-sm font-semibold hover:opacity-80 transition-opacity bg-none border-none cursor-pointer"
            >
              Back to Login
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-[#999999] mb-10">
          🔒 Your account is safe with us
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const resetToken = searchParams.get('token');
    if (!resetToken) {
      setError('Invalid or missing reset token. Please request a new password reset.');
    } else {
      setToken(resetToken);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      await api.post('/auth/reset-password', {
        token,
        password,
        confirmPassword
      });

      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset password. Please try again.');
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
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-[#4CAF50] mb-4">Password Reset Successful!</h2>
              <p className="text-[#666666] mb-6">
                Your password has been reset. You can now sign in with your new password.
              </p>
              <p className="text-sm text-[#999999]">Redirecting to login...</p>
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

        {/* Reset Password Card */}
        <div className="w-full bg-white rounded-2xl px-12 py-14 shadow-md border border-[#E0E0E0]">
          <h2 className="text-3xl font-bold text-[#333333] mb-8">Create New Password</h2>

          {error && token && error.includes('Invalid') ? (
            <div className="bg-[#FFEBEE] text-[#C62828] border border-[#EF5350] rounded px-4 py-3 text-sm">
              {error}
              <p className="mt-4">
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-[#2196F3] font-semibold hover:opacity-80 transition-opacity"
                >
                  Request a new reset link
                </button>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-[#FFEBEE] text-[#C62828] border border-[#EF5350] rounded px-4 py-3 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-base font-semibold text-[#333333]">New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="••••••••"
                  className="w-full border border-[#DDDDDD] rounded-lg px-4 py-3 text-base focus:outline-none focus:border-[#4CAF50] placeholder:text-[#999999]"
                />
                <p className="text-xs text-[#999999]">At least 6 characters</p>
              </div>

              <div className="space-y-2">
                <label className="block text-base font-semibold text-[#333333]">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="••••••••"
                  className="w-full border border-[#DDDDDD] rounded-lg px-4 py-3 text-base focus:outline-none focus:border-[#4CAF50] placeholder:text-[#999999]"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !password || !confirmPassword}
                className={`w-full font-bold py-3 rounded-lg text-lg transition-opacity mt-2 ${
                  loading || !password || !confirmPassword
                    ? 'bg-[#CCCCCC] text-gray-700 cursor-not-allowed'
                    : 'bg-[#4CAF50] text-white hover:opacity-90 cursor-pointer'
                }`}
              >
                {loading ? 'Resetting Password...' : 'Reset Password'}
              </button>
            </form>
          )}

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

export default ResetPassword;

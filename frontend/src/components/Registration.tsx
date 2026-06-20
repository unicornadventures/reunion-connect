import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const Registration: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

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
      await api.post('/auth/register', {
        email,
        firstName,
        lastName,
        password,
        confirmPassword
      });

      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
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
              <h2 className="text-2xl font-bold text-[#4CAF50] mb-4">Registration Successful!</h2>
              <p className="text-[#666666] mb-6">
                Please check your email to verify your account. You'll be redirected to login shortly.
              </p>
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
          <p className="text-[#666666] text-base">Join your alumni community</p>
        </div>

        {/* Registration Card */}
        <div className="w-full bg-white rounded-2xl px-12 py-14 shadow-md border border-[#E0E0E0]">
          <h2 className="text-3xl font-bold text-[#333333] mb-8">Create Your Account</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-[#FFEBEE] text-[#C62828] border border-[#EF5350] rounded px-4 py-3 text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-base font-semibold text-[#333333]">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={loading}
                  placeholder="John"
                  className="w-full border border-[#DDDDDD] rounded-lg px-4 py-3 text-base focus:outline-none focus:border-[#4CAF50] placeholder:text-[#999999]"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-base font-semibold text-[#333333]">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={loading}
                  placeholder="Doe"
                  className="w-full border border-[#DDDDDD] rounded-lg px-4 py-3 text-base focus:outline-none focus:border-[#4CAF50] placeholder:text-[#999999]"
                />
              </div>
            </div>

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

            <div className="space-y-2">
              <label className="block text-base font-semibold text-[#333333]">Password</label>
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
              disabled={loading || !email || !password || !confirmPassword}
              className={`w-full font-bold py-3 rounded-lg text-lg transition-opacity mt-2 ${
                loading || !email || !password || !confirmPassword
                  ? 'bg-[#CCCCCC] text-gray-700 cursor-not-allowed'
                  : 'bg-[#4CAF50] text-white hover:opacity-90 cursor-pointer'
              }`}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-[#EEEEEE] text-center">
            <p className="text-sm text-[#999999]">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="text-[#2196F3] font-semibold hover:opacity-80 transition-opacity bg-none border-none cursor-pointer"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-[#999999] mb-10">
          🔒 Your data is secure and private
        </div>
      </div>
    </div>
  );
};

export default Registration;

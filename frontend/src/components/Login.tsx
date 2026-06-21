import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import api from '../api';
import { CurrentUser } from '../types';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAppContext();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await api.post(`/auth/login`, { email, password });

      const { user: userData, token } = response.data;

      // Build CurrentUser object from auth response
      const user: CurrentUser = {
        id: userData.user_id,
        email: userData.email,
        is_admin: userData.is_admin,
        created_at: userData.created_at,
        profile: userData.profile || null,
        user_id: userData.user_id,
        first_name: userData.profile?.first_name || '',
        last_name: userData.profile?.last_name || ''
      };

      // Store token for subsequent requests
      localStorage.setItem('token', token);
      login(user);
      navigate('/');
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-5">
      <div className="w-full max-w-[600px] flex flex-col items-center gap-10">
        {/* Header */}
        <div className="text-center mt-10">
          <div className="text-6xl mb-4">🎓</div>
          <h1 className="text-5xl font-bold text-[#4CAF50] mb-2">ReunionConnect</h1>
          <p className="text-[#666666] text-base">Westbrook High School — Class of 2004</p>
        </div>

        {/* Login Card */}
        <div className="w-full bg-white rounded-2xl px-12 py-14 shadow-md border border-[#E0E0E0]">
          <h2 className="text-3xl font-bold text-[#333333] mb-8">Welcome Back</h2>

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
            </div>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className={`w-full font-bold py-3 rounded-lg text-lg transition-opacity mt-2 ${
                loading || !email || !password
                  ? 'bg-[#CCCCCC] text-gray-700 cursor-not-allowed'
                  : 'bg-[#4CAF50] text-white hover:opacity-90 cursor-pointer'
              }`}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="text-[#2196F3] text-sm font-semibold hover:opacity-80 transition-opacity bg-none border-none cursor-pointer"
            >
              Forgot your password?
            </button>
          </div>

          <div className="mt-5 pt-5 border-t border-[#EEEEEE] text-center">
            <p className="text-sm text-[#999999]">
              Not registered yet?{' '}
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="text-[#2196F3] font-semibold hover:opacity-80 transition-opacity bg-none border-none cursor-pointer"
              >
                Sign up here
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-[#999999] mb-10">
          🔒 Secure access for alumni only
        </div>
      </div>
    </div>
  );
};

export default Login;
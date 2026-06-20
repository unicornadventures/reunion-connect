import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';

interface SchoolInfo {
  id: number;
  name: string;
  location: string;
}

interface ClassInfo {
  id: number;
  year: number;
}

const RegisterWithLink: React.FC = () => {
  const { hash } = useParams<{ hash: string }>();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [linkLoading, setLinkLoading] = useState(false);
  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);

  useEffect(() => {
    if (hash) {
      fetchRegistrationLink();
    }
  }, [hash]);

  const fetchRegistrationLink = async () => {
    if (!hash) return;

    try {
      const response = await api.get(`/auth/registration-link/${hash}`);
      setSchool(response.data.school);
      setClassInfo(response.data.class);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching registration link:', err);
      setError(err.response?.data?.error || 'Invalid registration link.');
      setSchool(null);
      setClassInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLinkLoading(true);

    try {
      await api.post('/auth/register', {
        email,
        firstName,
        lastName,
        password,
        confirmPassword,
        schoolId: school?.id,
        classId: classInfo?.id
      });

      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLinkLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-5">
        <div className="w-full max-w-[600px] flex flex-col items-center gap-10">
          <div className="text-center mt-10">
            <div className="text-6xl mb-4">🎓</div>
            <h1 className="text-5xl font-bold text-[#4CAF50] mb-2">ReunionConnect</h1>
          </div>
          <div className="w-full bg-white rounded-2xl px-12 py-14 shadow-md border border-[#E0E0E0]">
            <div className="text-center text-[#999] text-base">Loading registration details...</div>
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

  if (!school || !classInfo) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-5">
        <div className="w-full max-w-[600px] flex flex-col items-center gap-10">
          <div className="text-center mt-10">
            <div className="text-6xl mb-4">🎓</div>
            <h1 className="text-5xl font-bold text-[#4CAF50] mb-2">ReunionConnect</h1>
          </div>

          <div className="w-full bg-white rounded-2xl px-12 py-14 shadow-md border border-[#E0E0E0]">
            <div className="px-3 py-3 bg-[#FFEBEE] text-[#C62828] rounded border border-[#EF5350] text-sm">
              {error || 'Invalid registration link.'}
            </div>
            <div className="text-center mt-6">
              <button
                onClick={() => navigate('/register')}
                className="px-6 py-2 bg-[#4CAF50] text-white border-none rounded text-base font-bold cursor-pointer hover:opacity-90"
              >
                Go to Standard Registration
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
          <p className="text-[#666666] text-base">Join your alumni community</p>
        </div>

        {/* Registration Card */}
        <div className="w-full bg-white rounded-2xl px-12 py-14 shadow-md border border-[#E0E0E0]">
          {/* Class Info Display */}
          <div className="mb-6 p-4 bg-[#F0F7FF] rounded-lg border border-[#B3E5FC]">
            <p className="text-sm text-[#555] mb-2">
              <strong>School:</strong> {school.name}
              {school.location && ` - ${school.location}`}
            </p>
            <p className="text-sm text-[#555]">
              <strong>Class Year:</strong> {classInfo.year}
            </p>
          </div>

          {error && (
            <div className="mb-6 px-4 py-3 bg-[#FFEBEE] text-[#C62828] rounded border border-[#EF5350] text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[#333] font-bold text-sm mb-2">First Name *</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                className="w-full px-4 py-3 border border-[#DDDDDD] rounded-lg text-base focus:outline-none focus:border-[#4CAF50]"
                disabled={linkLoading}
              />
            </div>

            <div>
              <label className="block text-[#333] font-bold text-sm mb-2">Last Name *</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                className="w-full px-4 py-3 border border-[#DDDDDD] rounded-lg text-base focus:outline-none focus:border-[#4CAF50]"
                disabled={linkLoading}
              />
            </div>

            <div>
              <label className="block text-[#333] font-bold text-sm mb-2">Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john.doe@example.com"
                className="w-full px-4 py-3 border border-[#DDDDDD] rounded-lg text-base focus:outline-none focus:border-[#4CAF50]"
                disabled={linkLoading}
              />
            </div>

            <div>
              <label className="block text-[#333] font-bold text-sm mb-2">Password *</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-[#DDDDDD] rounded-lg text-base focus:outline-none focus:border-[#4CAF50]"
                disabled={linkLoading}
              />
              <p className="text-xs text-[#999] mt-1">Minimum 6 characters</p>
            </div>

            <div>
              <label className="block text-[#333] font-bold text-sm mb-2">Confirm Password *</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-[#DDDDDD] rounded-lg text-base focus:outline-none focus:border-[#4CAF50]"
                disabled={linkLoading}
              />
            </div>

            <button
              type="submit"
              disabled={linkLoading}
              className={`w-full py-3 border-none rounded-lg font-bold text-base transition-opacity ${
                linkLoading
                  ? 'bg-gray-300 text-[#666] cursor-not-allowed'
                  : 'bg-[#4CAF50] text-white cursor-pointer hover:opacity-90'
              }`}
            >
              {linkLoading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-[#999] text-sm mt-6">
            Already have an account?{' '}
            <a href="/login" className="text-[#4CAF50] font-bold hover:underline">
              Sign In
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterWithLink;

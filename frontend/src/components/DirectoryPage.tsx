import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import api from '../api';
import { getColorForInitials } from '../avatarColors';

interface DirectoryUser {
  id: number;
  email: string | null;
  is_deceased: boolean;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  former_first_name: string | null;
  former_last_name: string | null;
  now_photo_url: string | null;
  avatar_color: string | null;
  tags: string[] | null;
}

interface ClassInfo {
  id: number;
  year: number;
  school_id?: number;
  school_name?: string;
}

const getInitials = (firstName?: string | null, lastName?: string | null): string => {
  const first = (firstName || '').charAt(0).toUpperCase();
  const last = (lastName || '').charAt(0).toUpperCase();
  return (first + last) || '?';
};

const getDisplayName = (user: DirectoryUser): { first: string | null; last: string | null } => ({
  first: user.former_first_name || user.first_name,
  last: user.former_last_name || user.last_name,
});

const DirectoryPage: React.FC = () => {
  const { currentUser } = useAppContext();
  const navigate = useNavigate();
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (currentUser?.user_id) {
      fetchClassAndUsers();
    }
  }, [currentUser?.user_id]);

  const fetchClassAndUsers = async () => {
    if (!currentUser?.user_id) return;

    setLoading(true);
    try {
      const classResponse = await api.get(`/users/${currentUser.user_id}/class`);
      const userClass = classResponse.data.class;
      setClassInfo(userClass);

      const usersResponse = await api.get(`/classes/${userClass.id}/directory`, {
        params: { userId: currentUser.user_id }
      });
      setUsers(usersResponse.data.users || []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching directory:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Failed to load directory.';
      setError(errorMsg);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const searchLower = search.toLowerCase();
  const filtered = users.filter(u =>
    (u.first_name?.toLowerCase() || '').includes(searchLower) ||
    (u.last_name?.toLowerCase() || '').includes(searchLower) ||
    (u.former_first_name?.toLowerCase() || '').includes(searchLower) ||
    (u.former_last_name?.toLowerCase() || '').includes(searchLower) ||
    (u.email?.toLowerCase() || '').includes(searchLower) ||
    (u.tags || []).some(tag => tag.toLowerCase().includes(searchLower))
  );
  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto px-5 py-8">
        <div className="text-center text-[#94A3B8] text-sm">Loading directory...</div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-5 py-8">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          {classInfo && (
            <p className="text-[10px] font-semibold text-[#94A3B8] tracking-[0.15em] uppercase mb-1">
              {classInfo.school_name} · Class of {classInfo.year}
            </p>
          )}
          <h1 className="font-display text-4xl font-bold text-[#0E2240] uppercase tracking-tight">
            Alumni Directory
          </h1>
          <p className="text-sm text-[#64748B] mt-1">{users.length} classmates registered</p>
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search classmates or tags..."
          className="border border-[#E2E8F0] rounded px-4 py-2.5 text-sm w-64 focus:outline-none focus:border-[#E8A93E] focus:ring-1 focus:ring-[#E8A93E] placeholder:text-[#CBD5E1] transition-colors"
        />
      </div>

      {error && (
        <div className="bg-[#FFEBEE] text-[#C62828] border border-[#EF5350] rounded px-4 py-3 text-sm mb-5">
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#E2E8F0] p-10 text-center text-[#94A3B8] text-sm">
          {search ? `No classmates match "${search}"` : 'No classmates found yet.'}
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(128px, 1fr))' }}>
          {filtered.map((user) => {
            const displayName = getDisplayName(user);
            const deceased = user.is_deceased;
            return (
              <button
                key={user.id}
                onClick={() => navigate(`/user/${user.id}`)}
                className={`rounded-lg border p-2 text-center hover:shadow-sm transition-all duration-200 cursor-pointer flex flex-col items-center justify-center gap-2 min-h-[140px] ${
                  deceased
                    ? 'bg-[#F8FAFC] border-[#E2E8F0] hover:border-[#94A3B8] opacity-75'
                    : 'bg-white border-[#E2E8F0] hover:border-[#E8A93E]'
                }`}
              >
                {user.now_photo_url ? (
                  <img
                    src={user.now_photo_url}
                    alt={`${displayName.first} ${displayName.last}`}
                    className={`w-24 h-24 rounded-full object-cover ${deceased ? 'grayscale' : ''}`}
                  />
                ) : (
                  <div
                    className="flex items-center justify-center rounded-full font-bold flex-shrink-0"
                    style={{
                      width: 96,
                      height: 96,
                      fontSize: 30,
                      background: deceased ? '#CBD5E1' : (user.avatar_color || getColorForInitials(getInitials(displayName.first, displayName.last))),
                      color: deceased ? '#64748B' : '#FFFFFF',
                    }}
                  >
                    {getInitials(displayName.first, displayName.last)}
                  </div>
                )}
                <div className="w-full">
                  <div className={`font-display text-sm font-bold uppercase tracking-wide leading-tight ${deceased ? 'text-[#64748B]' : 'text-[#0E2240]'}`}>
                    {displayName.last || displayName.first || 'Alumni'}
                  </div>
                  {displayName.first && displayName.last && (
                    <div className={`text-xs mt-0.5 ${deceased ? 'text-[#94A3B8]' : 'text-[#64748B]'}`}>{displayName.first}</div>
                  )}
                  {user.nickname && (
                    <div className={`text-[10px] mt-0.5 ${deceased ? 'text-[#CBD5E1]' : 'text-[#94A3B8]'}`}>"{user.nickname}"</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DirectoryPage;

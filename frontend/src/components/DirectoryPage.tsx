import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import api from '../api';

interface DirectoryUser {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  nickname_school: string | null;
  now_photo_url: string | null;
}

interface ClassInfo {
  id: number;
  year: number;
  school_id: number;
  school_name: string;
}

const getColorForInitials = (initials: string): string => {
  const colors = ['#E91E63', '#3F51B5', '#009688', '#FF5722', '#9C27B0', '#4CAF50', '#FF9800', '#607D8B', '#795548', '#00BCD4', '#F06292', '#7986CB'];
  let hash = 0;
  for (let i = 0; i < initials.length; i++) {
    hash = initials.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const getInitials = (firstName?: string | null, lastName?: string | null): string => {
  const first = (firstName || '').charAt(0).toUpperCase();
  const last = (lastName || '').charAt(0).toUpperCase();
  return (first + last) || '?';
};

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

  const handleUserClick = (userId: number) => {
    navigate(`/user/${userId}`);
  };

  const filtered = users.filter(u =>
    (u.first_name?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (u.last_name?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (u.email?.toLowerCase() || '').includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto px-5 py-8">
        <div className="text-center text-[#999999] text-base">Loading directory...</div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-5 py-8">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-[32px] font-bold text-[#333333]">Alumni Directory</h1>
          <p className="text-[#555555] text-sm mt-1">{users.length} classmates registered</p>
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="border border-[#DDDDDD] rounded-lg px-4 py-3 text-sm w-96 focus:outline-none focus:border-[#4CAF50] placeholder:text-[#999999]"
        />
      </div>

      {error && (
        <div className="bg-[#FFEBEE] text-[#C62828] border border-[#EF5350] rounded px-4 py-3 text-sm mb-5">
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#E0E0E0] p-10 text-center text-[#999999] text-sm">
          {search ? `No classmates found matching "${search}"` : 'No classmates found yet.'}
        </div>
      ) : (
        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
          {filtered.map((user) => (
            <button
              key={user.id}
              onClick={() => handleUserClick(user.id)}
              className="bg-white rounded-lg border border-[#E0E0E0] shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-5 text-center hover:shadow-[0_2px_4px_rgba(0,0,0,0.1)] hover:scale-[1.02] transition-all duration-200 cursor-pointer min-h-[200px] flex flex-col items-center justify-center gap-3"
            >
              {user.now_photo_url ? (
                <img
                  src={user.now_photo_url}
                  alt={`${user.first_name} ${user.last_name}`}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div
                  className="flex items-center justify-center rounded-full text-white font-bold flex-shrink-0 text-sm"
                  style={{
                    width: 64,
                    height: 64,
                    background: getColorForInitials(getInitials(user.first_name, user.last_name)),
                  }}
                >
                  {getInitials(user.first_name, user.last_name)}
                </div>
              )}
              <div>
                <div className="text-sm font-semibold text-[#333333] leading-tight">
                  {user.first_name} {user.last_name}
                </div>
                {user.nickname_school && (
                  <div className="text-xs text-[#666666] mt-1">"{user.nickname_school}"</div>
                )}
                <div className="text-xs text-[#999999] mt-0.5">{user.email}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default DirectoryPage;

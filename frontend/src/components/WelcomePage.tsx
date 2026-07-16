import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import api from '../api';
import { CurrentUser } from '../types';

interface DirectoryUser {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  nickname: string | null;
  now_photo_url: string | null;
}

interface ClassInfo {
  id: number;
  year: number;
  school_id?: number;
  school_name?: string;
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

const Avatar: React.FC<{ initials: string; size?: number }> = ({ initials, size = 48 }) => (
  <div
    className="flex items-center justify-center rounded-full text-white font-bold flex-shrink-0"
    style={{
      width: size,
      height: size,
      background: getColorForInitials(initials),
      fontSize: size * 0.35,
    }}
  >
    {initials}
  </div>
);

const WelcomePage: React.FC<{ currentUser: CurrentUser }> = ({ currentUser }) => {
  const navigate = useNavigate();
  const isSuperAdmin = currentUser?.is_admin || false;
  const [recentlyJoined, setRecentlyJoined] = useState<DirectoryUser[]>([]);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [daysUntilNextEvent, setDaysUntilNextEvent] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSuperAdmin && currentUser?.user_id) {
      fetchClassAndUsers();
    } else {
      setLoading(false);
    }
  }, [currentUser?.user_id, isSuperAdmin]);

  const fetchClassAndUsers = async () => {
    if (!currentUser?.user_id) return;
    try {
      const classResponse = await api.get(`/users/${currentUser.user_id}/class`);
      const userClass = classResponse.data.class;
      setClassInfo(userClass);

      const recentlyJoinedResponse = await api.get(`/classes/${userClass.id}/recently-joined`);
      setRecentlyJoined(recentlyJoinedResponse.data.users || []);

      const eventsResponse = userClass.school_id
        ? await api.get(`/schools/${userClass.school_id}/classes/${userClass.id}/events`)
        : { data: { events: [] } };
      const events: Array<{ event_date: string }> = eventsResponse.data.events || [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const future = events
        .map(e => new Date(e.event_date))
        .filter(d => d >= today)
        .sort((a, b) => a.getTime() - b.getTime());
      if (future.length > 0) {
        const diff = Math.ceil((future[0].getTime() - today.getTime()) / 86400000);
        setDaysUntilNextEvent(diff);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (isSuperAdmin) {
    return (
      <div className="max-w-[1200px] mx-auto px-5 py-10">
        <p className="text-[10px] font-semibold text-[#94A3B8] tracking-[0.15em] uppercase mb-2">
          Administrator
        </p>
        <h2 className="font-display text-4xl font-bold text-[#0E2240] uppercase tracking-tight">
          Welcome back, {currentUser.first_name}
        </h2>
        <p className="text-sm text-[#64748B] mt-3 max-w-md">
          Use the navigation above to manage schools, classes, and users.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-5 py-8">

      {/* Greeting */}
      <div className="mb-6">
        {classInfo && (
          <p className="text-[10px] font-semibold text-[#94A3B8] tracking-[0.15em] uppercase mb-1">
            {classInfo.school_name} · Class of {classInfo.year}
          </p>
        )}
        <h1 className="font-display text-4xl font-bold text-[#0E2240] uppercase tracking-tight">
          Welcome back, {currentUser.first_name}
        </h1>
      </div>

      {/* Countdown Strip */}
      {daysUntilNextEvent !== null && (
        <div className="bg-[#0E2240] rounded-lg px-8 py-8 mb-6 text-center">
          <p className="text-[10px] font-semibold text-white/50 tracking-[0.2em] uppercase mb-3">
            Reunion Countdown
          </p>
          <div className="font-display text-[88px] font-bold text-[#E8A93E] leading-none">
            {daysUntilNextEvent}
          </div>
          <p className="text-white/50 text-xs font-medium tracking-[0.15em] uppercase mt-3">
            days until the reunion
          </p>
        </div>
      )}

      {/* Intro */}
      <div className="mb-8">
        <p className="text-sm text-[#64748B] leading-relaxed max-w-2xl mb-5">
          ReunionConnect is your class's little corner of the internet. Browse the directory to
          see who's around, catch up on old friends' profiles, leave a comment to say hi, and
          keep an eye out for upcoming reunion events.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { to: '/directory', label: 'Directory', blurb: 'See your classmates' },
            { to: '/profile', label: 'Your Profile', blurb: 'Update photos & bio' },
            { to: '/comments', label: 'Comments', blurb: 'Say hi to someone' },
            { to: '/events', label: 'Events', blurb: "What's coming up" },
          ].map(({ to, label, blurb }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="bg-white rounded-lg border border-[#E2E8F0] px-4 py-4 text-left hover:border-[#E8A93E] hover:shadow-sm transition-all duration-200 cursor-pointer"
            >
              <div className="text-sm font-semibold text-[#0E2240]">{label}</div>
              <div className="text-xs text-[#94A3B8] mt-1">{blurb}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Recently Joined */}
      {recentlyJoined.length > 0 && (
        <div>
          <h2 className="font-display text-xl font-bold text-[#0E2240] uppercase tracking-[0.12em] mb-4">
            Recently Joined
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {recentlyJoined.map((user) => (
              <button
                key={user.id}
                onClick={() => navigate(`/user/${user.id}`)}
                className="bg-white rounded-lg border border-[#E2E8F0] p-4 text-center hover:border-[#E8A93E] hover:shadow-sm transition-all duration-200 cursor-pointer"
              >
                <div className="flex justify-center mb-3">
                  <Avatar initials={getInitials(user.first_name, user.last_name)} size={48} />
                </div>
                <div className="text-sm font-semibold text-[#0E2240] leading-tight">
                  {user.first_name} {user.last_name}
                </div>
                <div className="text-xs text-[#94A3B8] mt-1 truncate">{user.email}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WelcomePage;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import api from '../api';
import { CurrentUser } from '../types';

interface ClassInfo {
  id: number;
  year: number;
  school_id?: number;
  school_name?: string;
}

const WelcomePage: React.FC<{ currentUser: CurrentUser }> = ({ currentUser }) => {
  const navigate = useNavigate();
  const isSuperAdmin = currentUser?.is_admin || false;
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { to: '/directory', label: 'Directory', blurb: 'See your classmates' },
            { to: '/profile', label: 'Your Profile', blurb: 'Update photos & bio' },
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
    </div>
  );
};

export default WelcomePage;

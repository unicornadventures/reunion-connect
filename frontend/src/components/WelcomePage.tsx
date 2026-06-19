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
  nickname_school: string | null;
  now_photo_url: string | null;
}

interface ClassInfo {
  id: number;
  year: number;
  school_id: number;
  school_name: string;
}

interface Event {
  id: number;
  event_name: string;
  event_date: string;
  event_time: string;
  location: string;
  description?: string;
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

const Avatar: React.FC<{ initials: string; size?: number }> = ({ initials, size = 48 }) => {
  return (
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
};

const WelcomePage: React.FC<{ currentUser: CurrentUser }> = ({ currentUser }) => {
  const navigate = useNavigate();
  const { logout } = useAppContext();
  const isSuperAdmin = currentUser?.is_admin || false;
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [alumniCount, setAlumniCount] = useState(0);
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

      const usersResponse = await api.get(`/classes/${userClass.id}/directory`, {
        params: { userId: currentUser.user_id }
      });
      setUsers(usersResponse.data.users || []);

      const eventsResponse = await api.get(`/events/class/${userClass.id}/events`);
      setEvents(eventsResponse.data.events || []);

      const countResponse = await api.get(`/classes/${userClass.id}/alumni-count`);
      setAlumniCount(countResponse.data.count || 0);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (isSuperAdmin) {
    return (
      <div className="min-h-screen bg-[#F5F5F5]">
        <header className="sticky top-0 z-[100] bg-white border-b-2 border-[#4CAF50] shadow-[0_2px_4px_rgba(0,0,0,0.1)] px-5 py-5">
          <div className="max-w-[1200px] mx-auto flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-[#4CAF50] m-0">🎓 Class Reunion Admin Panel</h1>
              <p className="text-sm text-[#666666] m-0 mt-1">Manage schools and classes</p>
            </div>
            <button onClick={logout} className="px-5 py-2 bg-[#f44336] text-white rounded font-bold text-sm hover:opacity-90 transition-opacity">
              Logout ({currentUser.first_name})
            </button>
          </div>
        </header>
        <div className="max-w-[1200px] mx-auto px-5 py-8">
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-[#333333] mb-2">Welcome back, {currentUser.first_name}! 👋</h2>
            <p className="text-sm text-[#666666] leading-relaxed">
              You are logged in as a super administrator. Use the navigation menu to manage schools and classes.
            </p>
          </section>
        </div>
      </div>
    );
  }

  // Regular user dashboard
  const recent = users.slice(0, 6);

  return (
    <div className="max-w-[1200px] mx-auto px-5 py-8">
      {/* Welcome banner */}
      <div className="bg-white rounded-lg border border-[#E0E0E0] shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-8 mb-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-[32px] font-bold text-[#333333] leading-tight mb-2">
              Welcome to the 20-Year Reunion! 🎉
            </h1>
            <p className="text-[#555555] text-base leading-relaxed max-w-2xl">
              Can you believe it has been two decades? Reconnect with your classmates, share memories,
              and get ready for the big event — <strong>August 15–17, 2024</strong> at Westbrook High School.
            </p>
          </div>
          <div className="bg-[#E8F5E9] border border-[#4CAF50] rounded-lg px-5 py-4 text-center flex-shrink-0">
            <div className="text-2xl font-bold text-[#4CAF50]">57</div>
            <div className="text-xs text-[#2E7D32] font-semibold mt-0.5">Days Until Reunion</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
        <div className="bg-white rounded-lg border border-[#E0E0E0] shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-5 text-center hover:shadow-[0_2px_4px_rgba(0,0,0,0.1)] transition-shadow duration-200">
          <div className="text-3xl mb-2">👤</div>
          <div className="text-2xl font-bold text-[#4CAF50]">{alumniCount}</div>
          <div className="text-xs font-semibold text-[#333333] mt-1">Alumni Registered</div>
          <div className="text-xs text-[#999999] mt-0.5">This week</div>
        </div>

        <div className="bg-white rounded-lg border border-[#E0E0E0] shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-5 text-center hover:shadow-[0_2px_4px_rgba(0,0,0,0.1)] transition-shadow duration-200">
          <div className="text-3xl mb-2">🎓</div>
          <div className="text-2xl font-bold text-[#4CAF50]">{classInfo?.year ? new Date().getFullYear() - classInfo.year : 0}</div>
          <div className="text-xs font-semibold text-[#333333] mt-1">Years Since Graduation</div>
          <div className="text-xs text-[#999999] mt-0.5">Class of {classInfo?.year || '2004'}</div>
        </div>

        <div className="bg-white rounded-lg border border-[#E0E0E0] shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-5 text-center hover:shadow-[0_2px_4px_rgba(0,0,0,0.1)] transition-shadow duration-200">
          <div className="text-3xl mb-2">💬</div>
          <div className="text-2xl font-bold text-[#4CAF50]">248</div>
          <div className="text-xs font-semibold text-[#333333] mt-1">Messages Posted</div>
          <div className="text-xs text-[#999999] mt-0.5">Keep it going!</div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {/* Recently joined */}
        <div className="md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-[#333333]">Recently Joined</h2>
            <button
              onClick={() => navigate('/directory')}
              className="text-[#2196F3] text-xs font-bold hover:opacity-80 transition-opacity"
            >
              View all →
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {recent.map((user) => (
              <button
                key={user.id}
                onClick={() => navigate(`/user/${user.id}`)}
                className="bg-white rounded-lg border border-[#E0E0E0] shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-4 text-center hover:shadow-[0_2px_4px_rgba(0,0,0,0.1)] hover:scale-[1.02] transition-all duration-200 cursor-pointer"
              >
                <div className="flex justify-center mb-3">
                  <Avatar
                    initials={getInitials(user.first_name, user.last_name)}
                    size={48}
                  />
                </div>
                <div className="text-sm font-semibold text-[#333333] leading-tight">
                  {user.first_name} {user.last_name}
                </div>
                <div className="text-xs text-[#999999] mt-1">{user.email}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Event Details */}
          <div>
            <h2 className="text-2xl font-bold text-[#333333] mb-4">Upcoming Events</h2>
            <div className="bg-white rounded-lg border border-[#E0E0E0] shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-5 space-y-3">
              {events.length > 0 ? (
                events.map((event, index) => {
                  const eventDate = new Date(event.event_date);
                  const dateStr = eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  const timeStr = event.event_time.slice(0, 5); // Get HH:MM from HH:MM:SS

                  return (
                    <div key={event.id} className={`pb-3 ${index !== events.length - 1 ? 'border-b border-[#EEEEEE]' : ''}`}>
                      <div className="flex items-start gap-3">
                        <span className="text-base">📅</span>
                        <div className="flex-1">
                          <div className="font-semibold text-[#333333] text-sm">{event.event_name}</div>
                          <div className="text-xs text-[#999999] mt-0.5">{dateStr} at {timeStr}</div>
                          <div className="text-xs text-[#666666] mt-1">📍 {event.location}</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-[#999999]">No events scheduled</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default WelcomePage;

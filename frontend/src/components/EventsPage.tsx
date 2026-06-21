import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import api from '../api';

interface Event {
  id: number;
  event_name: string;
  event_date: string;
  event_time: string;
  location: string;
  description?: string;
}

interface ClassInfo {
  id: number;
  year: number;
  school_id?: number;
  school_name?: string;
}

const EventsPage: React.FC = () => {
  const { currentUser } = useAppContext();
  const [events, setEvents] = useState<Event[]>([]);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser?.user_id) fetchEvents();
  }, [currentUser?.user_id]);

  const fetchEvents = async () => {
    if (!currentUser?.user_id) return;
    setLoading(true);
    try {
      const classResponse = await api.get(`/users/${currentUser.user_id}/class`);
      const userClass = classResponse.data.class;
      setClassInfo(userClass);
      const eventsResponse = await api.get(`/events/class/${userClass.id}/events`);
      setEvents(eventsResponse.data.events || []);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load events.');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto px-5 py-8">
        <div className="text-center text-[#94A3B8] text-sm">Loading events...</div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-5 py-8">
      <div className="mb-8">
        {classInfo && (
          <p className="text-[10px] font-semibold text-[#94A3B8] tracking-[0.15em] uppercase mb-1">
            {classInfo.school_name} · Class of {classInfo.year}
          </p>
        )}
        <h1 className="font-display text-4xl font-bold text-[#0E2240] uppercase tracking-tight">
          Upcoming Events
        </h1>
        <p className="text-sm text-[#64748B] mt-1">
          {events.length} event{events.length !== 1 ? 's' : ''} scheduled
        </p>
      </div>

      {error && (
        <div className="bg-[#FFEBEE] text-[#C62828] border border-[#EF5350] rounded px-4 py-3 text-sm mb-5">
          {error}
        </div>
      )}

      {events.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#E2E8F0] p-10 text-center text-[#94A3B8] text-sm">
          No upcoming events scheduled.
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => {
            const eventDate = new Date(event.event_date);
            const month = eventDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
            const day = eventDate.getDate();
            const timeStr = event.event_time.slice(0, 5);

            return (
              <div
                key={event.id}
                className="bg-white rounded-lg border border-[#E2E8F0] p-6 hover:border-[#E8A93E] hover:shadow-sm transition-all duration-200"
              >
                <div className="flex gap-5">
                  {/* Date badge */}
                  <div className="flex-shrink-0 bg-[#0E2240] rounded px-4 py-4 text-center min-w-[72px]">
                    <div className="font-display text-3xl font-bold text-[#E8A93E] leading-none">{day}</div>
                    <div className="text-[10px] text-white/60 font-semibold tracking-[0.15em] uppercase mt-1">{month}</div>
                  </div>

                  {/* Event details */}
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-[#0E2240] mb-3">{event.event_name}</h3>
                    <div className="space-y-1.5">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[9px] font-bold text-[#94A3B8] tracking-[0.15em] uppercase w-12">Time</span>
                        <span className="text-sm text-[#64748B]">{timeStr}</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-[9px] font-bold text-[#94A3B8] tracking-[0.15em] uppercase w-12">Where</span>
                        <span className="text-sm text-[#64748B]">{event.location}</span>
                      </div>
                    </div>
                    {event.description && (
                      <p className="text-sm text-[#64748B] mt-3 leading-relaxed">{event.description}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EventsPage;

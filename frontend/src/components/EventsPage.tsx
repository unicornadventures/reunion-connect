import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  school_id: number;
  school_name: string;
}

const EventsPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAppContext();
  const [events, setEvents] = useState<Event[]>([]);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser?.user_id) {
      fetchEvents();
    }
  }, [currentUser?.user_id]);

  const fetchEvents = async () => {
    if (!currentUser?.user_id) return;

    setLoading(true);
    try {
      const classResponse = await api.get(`/users/${currentUser.user_id}/class`);
      const userClass = classResponse.data.class;
      setClassInfo(userClass);

      const eventsResponse = await api.get(`/events/class/${userClass.id}/events`);
      const allEvents = eventsResponse.data.events || [];

      // Filter for upcoming events only and sort by date/time
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const upcomingEvents = allEvents
        .filter((event: Event) => {
          const eventDate = new Date(event.event_date);
          return eventDate >= today;
        })
        .sort((a: Event, b: Event) => {
          const dateA = new Date(a.event_date);
          const dateB = new Date(b.event_date);
          if (dateA.getTime() !== dateB.getTime()) {
            return dateA.getTime() - dateB.getTime();
          }
          return a.event_time.localeCompare(b.event_time);
        });

      setEvents(upcomingEvents);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching events:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Failed to load events.';
      setError(errorMsg);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto px-5 py-8">
        <div className="text-center text-[#999999] text-base">Loading events...</div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-5 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[32px] font-bold text-[#333333]">📅 Upcoming Events</h1>
        <p className="text-[#555555] text-sm mt-1">
          {classInfo ? `Class of ${classInfo.year}` : 'Events'} - {events.length} event{events.length !== 1 ? 's' : ''}
        </p>
      </div>

      {error && (
        <div className="bg-[#FFEBEE] text-[#C62828] border border-[#EF5350] rounded px-4 py-3 text-sm mb-5">
          {error}
        </div>
      )}

      {events.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#E0E0E0] p-10 text-center text-[#999999] text-sm">
          No upcoming events scheduled.
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => {
            const eventDate = new Date(event.event_date);
            const dateStr = eventDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
            const timeStr = event.event_time.slice(0, 5); // Get HH:MM from HH:MM:SS

            return (
              <div
                key={event.id}
                className="bg-white rounded-lg border border-[#E0E0E0] shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-6 hover:shadow-[0_2px_4px_rgba(0,0,0,0.1)] transition-shadow duration-200"
              >
                <div className="flex gap-4">
                  {/* Date Badge */}
                  <div className="flex-shrink-0 bg-[#E8F5E9] border border-[#4CAF50] rounded-lg p-4 text-center min-w-[100px]">
                    <div className="text-2xl font-bold text-[#4CAF50]">
                      {eventDate.getDate()}
                    </div>
                    <div className="text-xs text-[#2E7D32] font-semibold mt-0.5">
                      {eventDate.toLocaleDateString('en-US', { month: 'short' })}
                    </div>
                  </div>

                  {/* Event Details */}
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-[#333333] mb-1">{event.event_name}</h3>
                    <div className="text-sm text-[#666666] mt-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <span>🕐</span>
                        <span>{timeStr}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>📍</span>
                        <span>{event.location}</span>
                      </div>
                    </div>
                    {event.description && (
                      <p className="text-sm text-[#555555] mt-3 leading-relaxed">
                        {event.description}
                      </p>
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

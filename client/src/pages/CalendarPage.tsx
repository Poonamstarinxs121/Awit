import { useState, useMemo } from 'react';
import {
  startOfWeek, addDays, format, isSameDay, addWeeks, subWeeks,
  startOfMonth, endOfMonth, addMonths, subMonths, eachDayOfInterval,
  isToday, parseISO, startOfDay,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, X, Calendar } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../api/client';

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  event_type: 'meeting' | 'followup' | 'reminder' | 'task' | 'event';
  start_at: string;
  end_at?: string;
  all_day: boolean;
  color?: string;
}

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  is_active: boolean;
  next_run?: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  due_date?: string;
}

type View = 'list' | 'weekly' | 'monthly';

const EVENT_COLORS: Record<string, string> = {
  meeting:  '#FFD60A',
  followup: '#32D74B',
  reminder: '#BF5AF2',
  task:     '#0A84FF',
  cron:     '#FF9F0A',
  event:    '#64D2FF',
};

const EVENT_TYPES = ['meeting', 'followup', 'reminder', 'task', 'event'];

interface EventPill {
  id: string;
  title: string;
  type: string;
  color: string;
  time?: string;
  start_at?: string;
  all_day?: boolean;
}

function pillColor(type: string, custom?: string): string {
  return custom || EVENT_COLORS[type] || '#64D2FF';
}

function EventModal({ onClose, onSave }: { onClose: () => void; onSave: (data: Record<string, unknown>) => void }) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('meeting');
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [endDate, setEndDate] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    await onSave({
      title: title.trim(),
      event_type: type,
      start_at: allDay ? startDate.split('T')[0] + 'T00:00:00.000Z' : new Date(startDate).toISOString(),
      end_at: endDate ? (allDay ? endDate.split('T')[0] + 'T23:59:59.000Z' : new Date(endDate).toISOString()) : undefined,
      all_day: allDay,
      description,
    });
    setSaving(false);
    onClose();
  };

  const color = EVENT_COLORS[type] || '#64D2FF';

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', width: '100%', maxWidth: '440px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>New Event</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Event title"
              required
              style={{ width: '100%', padding: '9px 12px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Type</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {EVENT_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  style={{
                    padding: '5px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                    backgroundColor: type === t ? (EVENT_COLORS[t] + '22') : 'var(--surface-elevated)',
                    border: `1px solid ${type === t ? EVENT_COLORS[t] : 'var(--border)'}`,
                    color: type === t ? EVENT_COLORS[t] : 'var(--text-secondary)',
                    textTransform: 'capitalize',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontSize: '13px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} style={{ accentColor: color }} />
              All Day
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Start *</label>
              <input
                type={allDay ? 'date' : 'datetime-local'}
                value={allDay ? startDate.split('T')[0] : startDate}
                onChange={e => setStartDate(allDay ? e.target.value + 'T00:00' : e.target.value)}
                required
                style={{ width: '100%', padding: '9px 10px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>End</label>
              <input
                type={allDay ? 'date' : 'datetime-local'}
                value={allDay ? (endDate ? endDate.split('T')[0] : '') : endDate}
                onChange={e => setEndDate(allDay ? e.target.value + 'T23:59' : e.target.value)}
                style={{ width: '100%', padding: '9px 10px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional description"
              style={{ width: '100%', padding: '9px 12px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '9px 18px', borderRadius: '8px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              style={{ padding: '9px 18px', borderRadius: '8px', backgroundColor: color, border: 'none', color: '#000', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600, opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Saving…' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EventDetailModal({ event, onClose }: { event: EventPill; onClose: () => void }) {
  const color = pillColor(event.type, event.color);
  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '14px', width: '100%', maxWidth: '380px', overflow: 'hidden' }}>
        <div style={{ height: '4px', backgroundColor: color }} />
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color, padding: '2px 6px', backgroundColor: color + '22', borderRadius: '4px' }}>
                {event.type}
              </span>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px' }}>
                {event.title}
              </h3>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={18} />
            </button>
          </div>
          {event.time && (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{event.time}</p>
          )}
          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: '8px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CalendarPage() {
  const [view, setView] = useState<View>('weekly');
  const [offset, setOffset] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventPill | null>(null);
  const queryClient = useQueryClient();

  const today = new Date();

  const currentWeekStart = addWeeks(startOfWeek(today, { weekStartsOn: 1 }), offset);
  const currentMonthDate = addMonths(today, offset);

  const { data: eventsData } = useQuery({
    queryKey: ['calendar-events', offset],
    queryFn: () => {
      const start = format(addMonths(startOfMonth(today), offset - 1), "yyyy-MM-dd");
      const end = format(addMonths(endOfMonth(today), offset + 1), "yyyy-MM-dd");
      return apiGet<{ events: CalendarEvent[] }>(`/v1/calendar-events?start=${start}&end=${end}`);
    },
    retry: false,
  });

  const { data: cronData } = useQuery({
    queryKey: ['cron-jobs-calendar'],
    queryFn: () => apiGet<{ jobs: CronJob[] }>('/v1/cron-jobs'),
    retry: false,
  });

  const { data: tasksData } = useQuery({
    queryKey: ['tasks-calendar'],
    queryFn: () => apiGet<{ tasks: Task[] }>('/v1/tasks?limit=200'),
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiPost('/v1/calendar-events', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-events'] }),
  });

  const allEvents = useMemo<EventPill[]>(() => {
    const pills: EventPill[] = [];
    const ce = eventsData?.events || [];
    for (const e of ce) {
      pills.push({
        id: e.id,
        title: e.title,
        type: e.event_type,
        color: pillColor(e.event_type, e.color),
        time: e.all_day ? 'All Day' : format(parseISO(e.start_at), 'h:mm a'),
        start_at: e.start_at,
        all_day: e.all_day,
      });
    }
    const tasks = tasksData?.tasks || [];
    for (const t of tasks) {
      if (t.due_date && !['done', 'archived'].includes(t.status)) {
        pills.push({
          id: 'task-' + t.id,
          title: t.title,
          type: 'task',
          color: EVENT_COLORS.task,
          time: format(parseISO(t.due_date), 'h:mm a'),
          start_at: t.due_date,
          all_day: false,
        });
      }
    }
    const crons = cronData?.jobs || [];
    for (const c of crons) {
      if (c.next_run && c.is_active) {
        pills.push({
          id: 'cron-' + c.id,
          title: c.name,
          type: 'cron',
          color: EVENT_COLORS.cron,
          time: format(parseISO(c.next_run), 'h:mm a'),
          start_at: c.next_run,
          all_day: false,
        });
      }
    }
    return pills.sort((a, b) => (a.start_at || '').localeCompare(b.start_at || ''));
  }, [eventsData, tasksData, cronData]);

  const eventsForDay = (day: Date) =>
    allEvents.filter(e => e.start_at && isSameDay(parseISO(e.start_at), day));

  const dateLabel = useMemo(() => {
    if (view === 'weekly') {
      const days = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
      return `${format(currentWeekStart, 'MMM d')} – ${format(days[6], 'MMM d, yyyy')}`;
    }
    if (view === 'monthly') return format(currentMonthDate, 'MMMM yyyy');
    return 'Upcoming Events';
  }, [view, offset]);

  const prev = () => setOffset(o => o - 1);
  const next = () => setOffset(o => o + 1);
  const goToday = () => setOffset(0);

  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>
            Calendar
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Scheduled tasks, events, meetings and cron jobs
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '9px 16px', borderRadius: '9px',
            backgroundColor: 'var(--accent)', border: 'none',
            color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={15} />
          New Event
        </button>
      </div>

      <div style={{
        backgroundColor: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: '12px', overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: '1px solid var(--border)',
          flexWrap: 'wrap', gap: '8px',
        }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            {(['list', 'weekly', 'monthly'] as View[]).map(v => (
              <button
                key={v}
                onClick={() => { setView(v); setOffset(0); }}
                style={{
                  padding: '6px 14px', borderRadius: '7px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                  backgroundColor: view === v ? 'var(--accent)' : 'transparent',
                  border: view === v ? 'none' : '1px solid var(--border)',
                  color: view === v ? '#fff' : 'var(--text-secondary)',
                  textTransform: 'capitalize',
                }}
              >
                {v === 'list' ? 'List' : v === 'weekly' ? 'Weekly' : 'Monthly'}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', minWidth: '200px', textAlign: 'center' }}>
              {dateLabel}
            </span>
            {view !== 'list' && (
              <>
                <button onClick={prev} style={{ padding: '6px', borderRadius: '7px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <ChevronLeft size={15} />
                </button>
                <button onClick={goToday} style={{ padding: '5px 12px', borderRadius: '7px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px' }}>
                  Today
                </button>
                <button onClick={next} style={{ padding: '6px', borderRadius: '7px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <ChevronRight size={15} />
                </button>
              </>
            )}
          </div>
        </div>

        {view === 'list' && <ListView events={allEvents} onEventClick={setSelectedEvent} />}
        {view === 'weekly' && <WeeklyView weekStart={currentWeekStart} eventsForDay={eventsForDay} onEventClick={setSelectedEvent} />}
        {view === 'monthly' && <MonthlyView monthDate={currentMonthDate} eventsForDay={eventsForDay} onEventClick={setSelectedEvent} />}
      </div>

      <div style={{ marginTop: '14px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        {Object.entries(EVENT_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: color }} />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{type}</span>
          </div>
        ))}
      </div>

      {showCreate && (
        <EventModal
          onClose={() => setShowCreate(false)}
          onSave={data => createMutation.mutateAsync(data)}
        />
      )}

      {selectedEvent && (
        <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </div>
  );
}

function ListView({ events, onEventClick }: { events: EventPill[]; onEventClick: (e: EventPill) => void }) {
  const grouped = useMemo(() => {
    const map = new Map<string, EventPill[]>();
    const now = startOfDay(new Date());
    const upcoming = events.filter(e => e.start_at && parseISO(e.start_at) >= now);
    for (const e of upcoming) {
      if (!e.start_at) continue;
      const key = format(parseISO(e.start_at), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  if (grouped.length === 0) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center' }}>
        <Calendar size={32} color="var(--text-muted)" style={{ margin: '0 auto 12px', display: 'block' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No upcoming events</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>Click "New Event" to add one</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 0' }}>
      {grouped.map(([dateKey, dayEvents]) => (
        <div key={dateKey}>
          <div style={{
            padding: '8px 20px', fontSize: '12px', fontWeight: 700,
            color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em',
            backgroundColor: 'var(--surface-elevated)',
            borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
          }}>
            {format(parseISO(dateKey), 'EEEE, MMMM d yyyy')}
          </div>
          {dayEvents.map(ev => {
            const color = ev.color || EVENT_COLORS[ev.type] || '#64D2FF';
            return (
              <div
                key={ev.id}
                onClick={() => onEventClick(ev)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '12px 20px', cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--surface-elevated)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
              >
                <div style={{ width: '3px', height: '36px', backgroundColor: color, borderRadius: '2px', flexShrink: 0 }} />
                <div style={{ width: '52px', fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                  {ev.all_day ? 'All Day' : ev.time}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ev.title}
                  </div>
                </div>
                <span style={{
                  fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                  padding: '2px 7px', borderRadius: '4px',
                  backgroundColor: color + '22', color,
                  flexShrink: 0,
                }}>
                  {ev.type}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function WeeklyView({ weekStart, eventsForDay, onEventClick }: {
  weekStart: Date;
  eventsForDay: (day: Date) => EventPill[];
  onEventClick: (e: EventPill) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
        {days.map((day, i) => (
          <div
            key={i}
            style={{
              padding: '8px 10px', textAlign: 'center',
              borderRight: i < 6 ? '1px solid var(--border)' : 'none',
              backgroundColor: isToday(day) ? 'var(--accent-soft)' : 'transparent',
            }}
          >
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>
              {format(day, 'EEE')}
            </div>
            <div style={{
              fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-heading)',
              color: isToday(day) ? 'var(--accent)' : 'var(--text-primary)',
              width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '2px auto 0',
              borderRadius: '50%',
              backgroundColor: isToday(day) ? 'var(--accent-soft)' : 'transparent',
            }}>
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {days.map((day, i) => {
          const dayEvents = eventsForDay(day);
          const MAX_SHOWN = 5;
          const shown = dayEvents.slice(0, MAX_SHOWN);
          const overflow = dayEvents.length - MAX_SHOWN;

          return (
            <div
              key={i}
              style={{
                borderRight: i < 6 ? '1px solid var(--border)' : 'none',
                minHeight: '140px', padding: '8px 6px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {shown.map(ev => {
                  const color = ev.color || EVENT_COLORS[ev.type] || '#64D2FF';
                  return (
                    <div
                      key={ev.id}
                      onClick={() => onEventClick(ev)}
                      title={ev.title}
                      style={{
                        padding: '3px 6px', borderRadius: '5px', fontSize: '10px', fontWeight: 500,
                        backgroundColor: color + '22', color, cursor: 'pointer',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        border: `1px solid ${color}44`,
                      }}
                    >
                      {ev.time && <span style={{ opacity: 0.75, marginRight: '4px' }}>{ev.time}</span>}
                      {ev.title}
                    </div>
                  );
                })}
                {overflow > 0 && (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', paddingLeft: '4px' }}>
                    +{overflow} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthlyView({ monthDate, eventsForDay, onEventClick }: {
  monthDate: Date;
  eventsForDay: (day: Date) => EventPill[];
  onEventClick: (e: EventPill) => void;
}) {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = addDays(startOfWeek(addDays(monthEnd, 6), { weekStartsOn: 1 }), 6);
  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border)' }}>
        {DAY_LABELS.map(d => (
          <div key={d} style={{ padding: '8px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {allDays.map((day, i) => {
          const isCurrentMonth = day.getMonth() === monthDate.getMonth();
          const dayEvents = eventsForDay(day);
          const MAX_SHOWN = 3;
          const shown = dayEvents.slice(0, MAX_SHOWN);
          const overflow = dayEvents.length - MAX_SHOWN;
          const todayDay = isToday(day);

          return (
            <div
              key={i}
              style={{
                borderRight: i % 7 < 6 ? '1px solid var(--border)' : 'none',
                borderBottom: i < allDays.length - 7 ? '1px solid var(--border)' : 'none',
                minHeight: '100px', padding: '6px',
                backgroundColor: todayDay ? 'var(--accent-soft)' : 'transparent',
              }}
            >
              <div style={{
                fontSize: '12px', fontWeight: todayDay ? 700 : 500,
                color: todayDay ? 'var(--accent)' : isCurrentMonth ? 'var(--text-primary)' : 'var(--text-muted)',
                marginBottom: '4px',
                width: '22px', height: '22px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%',
                border: todayDay ? '2px solid var(--accent)' : 'none',
              }}>
                {format(day, 'd')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {shown.map(ev => {
                  const color = ev.color || EVENT_COLORS[ev.type] || '#64D2FF';
                  return (
                    <div
                      key={ev.id}
                      onClick={() => onEventClick(ev)}
                      title={ev.title}
                      style={{
                        padding: '2px 5px', borderRadius: '4px', fontSize: '10px', fontWeight: 500,
                        backgroundColor: color + '22', color, cursor: 'pointer',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >
                      {ev.title}
                    </div>
                  );
                })}
                {overflow > 0 && (
                  <div style={{ fontSize: '9px', color: 'var(--text-muted)', paddingLeft: '2px' }}>
                    +{overflow} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

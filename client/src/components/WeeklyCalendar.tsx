import { useState } from 'react';
import { startOfWeek, addDays, format, isSameDay, addWeeks, subWeeks } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../api/client';

interface CronJob {
  id: string;
  name: string;
  cron_expression: string;
  enabled: boolean;
  last_run?: string;
  next_run?: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  due_date?: string;
}

export function WeeklyCalendar() {
  const [weekOffset, setWeekOffset] = useState(0);
  const baseDate = new Date();
  const currentWeekStart = addWeeks(startOfWeek(baseDate, { weekStartsOn: 1 }), weekOffset);
  const days = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  const { data: cronData } = useQuery({
    queryKey: ['cron-jobs-calendar'],
    queryFn: () => apiGet<{ jobs: CronJob[] }>('/v1/cron-jobs'),
    retry: false,
  });

  const { data: tasksData } = useQuery({
    queryKey: ['tasks-calendar'],
    queryFn: () => apiGet<{ tasks: Task[] }>('/v1/tasks?limit=100'),
    retry: false,
  });

  const getTasksForDay = (day: Date) => {
    const tasks = tasksData?.tasks || [];
    return tasks.filter(t => t.due_date && isSameDay(new Date(t.due_date), day));
  };

  const getCronsForDay = (day: Date) => {
    const jobs = cronData?.jobs || [];
    return jobs.filter(j => j.next_run && isSameDay(new Date(j.next_run), day) && j.enabled);
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}
    >
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <div style={{ width: '3px', height: '16px', backgroundColor: 'var(--accent)', borderRadius: '2px' }} />
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Weekly View
          </h2>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {format(currentWeekStart, 'MMM d')} – {format(days[6], 'MMM d, yyyy')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset(w => w - 1)}
            style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px' }}
          >
            Today
          </button>
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'var(--surface-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {days.map((day, i) => {
          const isToday = isSameDay(day, baseDate);
          const tasks = getTasksForDay(day);
          const crons = getCronsForDay(day);
          const total = tasks.length + crons.length;

          return (
            <div
              key={i}
              style={{
                borderRight: i < 6 ? '1px solid var(--border)' : 'none',
                minHeight: '140px',
                padding: '10px',
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>
                  {format(day, 'EEE')}
                </div>
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-heading)',
                    color: isToday ? 'var(--accent)' : 'var(--text-primary)',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: isToday ? 'var(--accent-soft)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto',
                  }}
                >
                  {format(day, 'd')}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {tasks.slice(0, 2).map(t => (
                  <div
                    key={t.id}
                    className="line-clamp-1"
                    style={{
                      fontSize: '11px',
                      padding: '3px 6px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--info-soft)',
                      color: 'var(--info)',
                      fontWeight: 500,
                    }}
                  >
                    {t.title}
                  </div>
                ))}
                {crons.slice(0, 2).map(c => (
                  <div
                    key={c.id}
                    className="line-clamp-1"
                    style={{
                      fontSize: '11px',
                      padding: '3px 6px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--type-cron-bg)',
                      color: 'var(--type-cron)',
                      fontWeight: 500,
                    }}
                  >
                    ⏰ {c.name}
                  </div>
                ))}
                {total > 4 && (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', paddingLeft: '6px' }}>
                    +{total - 4} more
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

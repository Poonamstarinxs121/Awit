import { Calendar } from 'lucide-react';
import { WeeklyCalendar } from '../components/WeeklyCalendar';

export function CalendarPage() {
  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '4px' }}>
          Calendar
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Weekly view of scheduled tasks and cron jobs
        </p>
      </div>
      <WeeklyCalendar />
    </div>
  );
}

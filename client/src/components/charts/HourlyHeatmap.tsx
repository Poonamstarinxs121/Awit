interface Cell {
  hour: number;
  day: number;
  count: number;
}

interface Props {
  data: Cell[];
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function HourlyHeatmap({ data }: Props) {
  const maxCount = Math.max(...data.map(d => d.count), 1);

  const getCount = (hour: number, day: number) => {
    return data.find(d => d.hour === hour && d.day === day)?.count || 0;
  };

  const getColor = (count: number) => {
    if (count === 0) return 'var(--surface-elevated)';
    const intensity = count / maxCount;
    if (intensity < 0.25) return 'rgba(255, 59, 48, 0.2)';
    if (intensity < 0.5) return 'rgba(255, 59, 48, 0.4)';
    if (intensity < 0.75) return 'rgba(255, 59, 48, 0.65)';
    return 'rgba(255, 59, 48, 0.9)';
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '16px' }}>
          {DAYS.map(d => (
            <div key={d} style={{ height: '14px', width: '28px', fontSize: '9px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', fontFamily: 'var(--font-mono)' }}>
              {d}
            </div>
          ))}
        </div>
        <div>
          <div style={{ display: 'flex', gap: '2px', marginBottom: '2px' }}>
            {HOURS.map(h => (
              <div key={h} style={{ width: '14px', fontSize: '8px', color: 'var(--text-muted)', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                {h % 6 === 0 ? h : ''}
              </div>
            ))}
          </div>
          {DAYS.map((_, dayIdx) => (
            <div key={dayIdx} style={{ display: 'flex', gap: '2px', marginBottom: '2px' }}>
              {HOURS.map(hour => {
                const count = getCount(hour, dayIdx);
                return (
                  <div
                    key={hour}
                    title={`${DAYS[dayIdx]} ${hour}:00 — ${count} events`}
                    style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '2px',
                      backgroundColor: getColor(count),
                      border: '1px solid var(--border)',
                      cursor: count > 0 ? 'pointer' : 'default',
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

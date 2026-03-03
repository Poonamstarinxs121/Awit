interface Props {
  value: number;
}

export function SuccessRateGauge({ value }: Props) {
  const clipped = Math.min(100, Math.max(0, value));
  const color = clipped >= 80 ? 'var(--positive)' : clipped >= 60 ? 'var(--warning)' : 'var(--negative)';
  const r = 50;
  const circumference = Math.PI * r;
  const offset = circumference * (1 - clipped / 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <svg width="130" height="75" viewBox="0 0 130 75">
        <path
          d={`M 15 65 A ${r} ${r} 0 0 1 115 65`}
          fill="none"
          stroke="var(--border)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d={`M 15 65 A ${r} ${r} 0 0 1 115 65`}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
        <text
          x="65"
          y="58"
          textAnchor="middle"
          style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '20px', fill: 'var(--text-primary)' }}
        >
          {clipped}%
        </text>
      </svg>
      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Success Rate</span>
    </div>
  );
}

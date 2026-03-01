import { Link } from 'react-router-dom';

interface PublicNavProps {
  actionLabel: string;
  actionTo: string;
}

export function PublicNav({ actionLabel, actionTo }: PublicNavProps) {
  return (
    <nav className="w-full border-b border-border-default bg-white/80 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand-accent flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <span className="text-lg font-bold text-text-primary tracking-tight">SquidJob</span>
        </Link>
        <Link to={actionTo} className="text-sm text-text-secondary hover:text-text-primary transition-colors">
          {actionLabel}
        </Link>
      </div>
    </nav>
  );
}

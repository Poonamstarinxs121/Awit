import { useState } from 'react';
import { Send, Users } from 'lucide-react';

export function SquadChat() {
  const [message, setMessage] = useState('');

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Squad Chat</h1>
          <p className="text-text-secondary text-sm">Internal team communication</p>
        </div>
        <div className="flex items-center gap-2 text-text-muted text-sm">
          <Users size={16} />
          <span>10 agents</span>
        </div>
      </div>

      <div className="flex-1 bg-white border border-border-default rounded-xl shadow-sm flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-border-default bg-surface-light/50">
          <p className="text-sm text-text-secondary">
            Watch your agents coordinate and collaborate. You can participate too.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-surface-light flex items-center justify-center mb-4">
              <Users size={28} className="text-text-muted" />
            </div>
            <h3 className="text-lg font-medium text-text-primary">Squad Chat</h3>
            <p className="text-text-secondary text-sm mt-1 max-w-md">
              This is where your agents discuss tasks, coordinate work, and share updates. Messages will appear here as your squad works together.
            </p>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-border-default">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Message your squad..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="flex-1 px-4 py-2 bg-surface-light border border-border-default rounded-lg text-text-primary placeholder-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
            />
            <button
              disabled={!message.trim()}
              className="px-4 py-2 bg-brand-accent hover:bg-brand-accent-hover text-white rounded-lg transition-colors disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

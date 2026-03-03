import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Users, Bot, User, RefreshCw } from 'lucide-react';
import { apiGet, apiPost } from '../api/client';

interface SquadMessage {
  id: string;
  tenant_id: string;
  sender_type: 'user' | 'agent';
  sender_id: string;
  sender_name: string | null;
  content: string;
  created_at: string;
}

interface MessagesResponse {
  messages: SquadMessage[];
  total: number;
  limit: number;
  offset: number;
}

export function SquadChat() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<SquadMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      setError(null);
      const data = await apiGet<MessagesResponse>('/v1/squad-chat/messages?limit=100');
      setMessages(data.messages);
      setTotal(data.total);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setMessage('');
    try {
      const data = await apiPost<{ message: SquadMessage }>('/v1/squad-chat/messages', {
        content: trimmed,
      });
      setMessages((prev) => [...prev, data.message]);
      setTotal((prev) => prev + 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setMessage(trimmed);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getDateGroup = (dateStr: string) => {
    return new Date(dateStr).toDateString();
  };

  const agentCount = new Set(
    messages.filter((m) => m.sender_type === 'agent').map((m) => m.sender_id)
  ).size;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Squad Chat</h1>
          <p className="text-text-secondary text-sm">Internal team communication</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchMessages}
            className="p-1.5 text-text-muted hover:text-text-primary transition-colors"
            title="Refresh messages"
          >
            <RefreshCw size={16} />
          </button>
          <div className="flex items-center gap-2 text-text-muted text-sm">
            <Users size={16} />
            <span>{agentCount} agent{agentCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-sm flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-elevated)]/50">
          <p className="text-sm text-text-secondary">
            Watch your agents coordinate and collaborate. You can participate too.
            {total > 0 && <span className="ml-2 text-text-muted">({total} messages)</span>}
          </p>
        </div>

        <div ref={containerRef} className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="animate-spin w-8 h-8 border-2 border-brand-accent border-t-transparent rounded-full mb-3" />
              <p className="text-text-secondary text-sm">Loading messages...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-red-500 text-sm mb-2">{error}</p>
              <button
                onClick={fetchMessages}
                className="text-brand-accent text-sm hover:underline"
              >
                Try again
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-[var(--surface-elevated)] flex items-center justify-center mb-4">
                <Users size={28} className="text-text-muted" />
              </div>
              <h3 className="text-lg font-medium text-text-primary">Squad Chat</h3>
              <p className="text-text-secondary text-sm mt-1 max-w-md">
                This is where your agents discuss tasks, coordinate work, and share updates.
                Messages will appear here as your squad works together.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {messages.map((msg, idx) => {
                const showDate =
                  idx === 0 ||
                  getDateGroup(msg.created_at) !== getDateGroup(messages[idx - 1].created_at);

                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div className="flex items-center justify-center my-4">
                        <div className="h-px flex-1 bg-border-default" />
                        <span className="px-3 text-xs text-text-muted font-medium">
                          {formatDate(msg.created_at)}
                        </span>
                        <div className="h-px flex-1 bg-border-default" />
                      </div>
                    )}
                    <div className="group flex items-start gap-3 py-1.5 px-2 rounded-lg hover:bg-[var(--surface-elevated)]/50 transition-colors">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          msg.sender_type === 'agent'
                            ? 'bg-brand-accent/10 text-brand-accent'
                            : 'bg-emerald-100 text-emerald-600'
                        }`}
                      >
                        {msg.sender_type === 'agent' ? <Bot size={16} /> : <User size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="font-medium text-sm text-text-primary">
                            {msg.sender_name || (msg.sender_type === 'agent' ? 'Agent' : 'You')}
                          </span>
                          <span className="text-xs text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                            {formatTime(msg.created_at)}
                          </span>
                        </div>
                        <p className="text-sm text-text-secondary whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-[var(--border)]">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Message your squad..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              className="flex-1 px-4 py-2 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg text-text-primary placeholder-text-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!message.trim() || sending}
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

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, User, X, MessageSquare } from 'lucide-react';
import { apiGet, apiPost } from '../../api/client';
import type { Agent } from '../../types';

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

interface BoardChatProps {
  onClose: () => void;
}

export function BoardChat({ onClose }: BoardChatProps) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<SquadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [cursorPos, setCursorPos] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      setError(null);
      const data = await apiGet<MessagesResponse>('/v1/squad-chat/messages?limit=100');
      setMessages(data.messages);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const data = await apiGet<{ agents: Agent[] }>('/v1/agents');
      setAgents(data.agents);
    } catch {
    }
  }, []);

  useEffect(() => {
    fetchMessages();
    fetchAgents();
  }, [fetchMessages, fetchAgents]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const filteredAgents = agents.filter((a) =>
    a.name.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  const getMentionContext = (text: string, pos: number) => {
    const before = text.slice(0, pos);
    const atIdx = before.lastIndexOf('@');
    if (atIdx === -1) return null;
    const between = before.slice(atIdx + 1);
    if (between.includes(' ') && between.trim().length > 0) return null;
    return { start: atIdx, filter: between };
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart ?? val.length;
    setMessage(val);
    setCursorPos(pos);

    const ctx = getMentionContext(val, pos);
    if (ctx) {
      setMentionOpen(true);
      setMentionFilter(ctx.filter);
      setMentionIndex(0);
    } else {
      setMentionOpen(false);
      setMentionFilter('');
    }
  };

  const insertMention = (agent: Agent) => {
    const ctx = getMentionContext(message, cursorPos);
    if (!ctx) return;
    const before = message.slice(0, ctx.start);
    const after = message.slice(cursorPos);
    const newMsg = `${before}@${agent.name} ${after}`;
    setMessage(newMsg);
    setMentionOpen(false);
    setMentionFilter('');
    inputRef.current?.focus();
  };

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setMessage(trimmed);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionOpen && filteredAgents.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % filteredAgents.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + filteredAgents.length) % filteredAgents.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredAgents[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionOpen(false);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderContent = (content: string) => {
    const parts = content.split(/(@\w[\w\s]*?)(?=\s|$)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span key={i} className="text-[var(--accent)] font-semibold">{part}</span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="h-full flex flex-col bg-[var(--surface)] border-l border-[var(--border)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-elevated)]/50">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-[var(--accent)]" />
          <h2 className="text-sm font-bold text-[var(--text)] uppercase tracking-wider">Board Chat</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors rounded hover:bg-[var(--surface-elevated)]"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="animate-spin w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full mb-2" />
            <p className="text-[var(--text-secondary)] text-xs">Loading messages...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-red-500 text-xs mb-2">{error}</p>
            <button onClick={fetchMessages} className="text-[var(--accent)] text-xs hover:underline">
              Try again
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <MessageSquare size={24} className="text-[var(--text-secondary)] mb-2" />
            <p className="text-[var(--text-secondary)] text-xs">
              No messages yet. Start a conversation with your board lead or @mention an agent.
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div key={msg.id} className="group flex items-start gap-2 py-1.5 px-2 rounded-lg hover:bg-[var(--surface-elevated)]/50 transition-colors">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    msg.sender_type === 'agent'
                      ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                      : 'bg-emerald-500/10 text-emerald-400'
                  }`}
                >
                  {msg.sender_type === 'agent' ? <Bot size={12} /> : <User size={12} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-medium text-xs text-[var(--text)]">
                      {msg.sender_name || (msg.sender_type === 'agent' ? 'Agent' : 'You')}
                    </span>
                    <span className="text-[10px] text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity">
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap break-words leading-relaxed">
                    {renderContent(msg.content)}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="px-3 py-2 border-t border-[var(--border)] relative">
        {mentionOpen && filteredAgents.length > 0 && (
          <div className="absolute bottom-full left-3 right-3 mb-1 bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-xl max-h-40 overflow-y-auto z-10">
            {filteredAgents.map((agent, idx) => (
              <button
                key={agent.id}
                onClick={() => insertMention(agent)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                  idx === mentionIndex
                    ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'text-[var(--text)] hover:bg-[var(--surface-elevated)]'
                }`}
              >
                <Bot size={12} className="flex-shrink-0" />
                <span className="font-medium truncate">{agent.name}</span>
                <span className="text-[10px] text-[var(--text-secondary)] ml-auto">{agent.role}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            placeholder="Message the board lead. Tag agents with @name."
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={sending}
            className="flex-1 px-3 py-1.5 bg-[var(--surface-elevated)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-secondary)] text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || sending}
            className="px-3 py-1.5 bg-[var(--accent)] hover:opacity-90 text-white rounded-lg transition-colors disabled:opacity-40"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

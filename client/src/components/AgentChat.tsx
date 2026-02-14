import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, Trash2, Loader2, Bot, User, AlertCircle } from 'lucide-react';
import { apiGet, apiDelete } from '../api/client';
import { Button } from './ui/Button';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AgentChatProps {
  agentId: string;
  agentName: string;
}

const BASE_URL = '/api';

function getToken(): string | null {
  return localStorage.getItem('squidjob_token');
}

export function AgentChat({ agentId, agentName }: AgentChatProps) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['agent-history', agentId],
    queryFn: () => apiGet<{ messages: ChatMessage[] }>(`/v1/agents/${agentId}/history?limit=50`),
  });

  useEffect(() => {
    if (historyData?.messages) {
      setLocalMessages(historyData.messages);
    }
  }, [historyData]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [localMessages, streamingContent, scrollToBottom]);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setInput('');
    setError(null);
    setIsStreaming(true);
    setStreamingContent('');

    setLocalMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      const token = getToken();
      const response = await fetch(`${BASE_URL}/v1/agents/${agentId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: userMessage, stream: true }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'chunk') {
                fullContent += data.content;
                setStreamingContent(fullContent);
              } else if (data.type === 'done') {
                setLocalMessages(prev => [...prev, { role: 'assistant', content: fullContent }]);
                setStreamingContent('');
              }
            } catch {
              // ignore parse errors for incomplete chunks
            }
          }
        }
      }

      if (fullContent && !streamingContent) {
        setLocalMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role !== 'assistant' || last?.content !== fullContent) {
            return [...prev, { role: 'assistant', content: fullContent }];
          }
          return prev;
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      setLocalMessages(prev => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
    }
  };

  const clearHistory = async () => {
    try {
      await apiDelete(`/v1/agents/${agentId}/history`);
      setLocalMessages([]);
      queryClient.invalidateQueries({ queryKey: ['agent-history', agentId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear history');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const displayMessages = localMessages.filter(m => m.role !== 'system');

  return (
    <div className="flex flex-col h-[600px] bg-surface rounded-xl border border-gray-800">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-teal-400" />
          <span className="text-sm font-medium text-white">Chat with {agentName}</span>
        </div>
        <button
          onClick={clearHistory}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition-colors"
          title="Clear conversation"
        >
          <Trash2 size={14} />
          Clear
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {historyLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-gray-500" />
          </div>
        ) : displayMessages.length === 0 && !isStreaming ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Bot size={40} className="mb-3 text-gray-600" />
            <p className="text-sm">Send a message to start chatting with {agentName}</p>
            <p className="text-xs text-gray-600 mt-1">The agent will respond based on their SOUL personality and current tasks</p>
          </div>
        ) : (
          <>
            {displayMessages.map((msg, i) => (
              <MessageBubble key={i} message={msg} agentName={agentName} />
            ))}
            {isStreaming && streamingContent && (
              <MessageBubble
                message={{ role: 'assistant', content: streamingContent }}
                agentName={agentName}
                isStreaming
              />
            )}
            {isStreaming && !streamingContent && (
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Loader2 size={14} className="animate-spin" />
                <span>{agentName} is thinking...</span>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="mx-4 mb-2 flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      <div className="p-4 border-t border-gray-800">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agentName}...`}
            rows={1}
            className="flex-1 px-4 py-2.5 bg-surface-light border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-transparent resize-none"
            disabled={isStreaming}
          />
          <Button onClick={sendMessage} disabled={!input.trim() || isStreaming} size="md">
            {isStreaming ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  agentName,
  isStreaming = false,
}: {
  message: ChatMessage;
  agentName: string;
  isStreaming?: boolean;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-blue-500/20 text-blue-400' : 'bg-teal-500/20 text-teal-400'
      }`}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>
      <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
        isUser
          ? 'bg-blue-500/20 border border-blue-500/30 text-white'
          : 'bg-surface-light border border-gray-700 text-gray-200'
      }`}>
        <p className="text-xs text-gray-500 mb-1">
          {isUser ? 'You' : agentName}
        </p>
        <div className="whitespace-pre-wrap break-words">
          {message.content}
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 ml-0.5 bg-teal-400 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}

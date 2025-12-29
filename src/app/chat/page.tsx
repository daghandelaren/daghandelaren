'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import MegaMenu from '@/components/layout/MegaMenu';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

function renderMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, boldMatch.index)}</span>);
      }
      parts.push(<strong key={key++} className="font-semibold">{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
    } else {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }
  }

  return parts;
}

export default function ChatPage() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [aiConfigured, setAiConfigured] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await fetch('/api/fundamental/chat/history');
        const data = await res.json();
        if (data.history) {
          setMessages(data.history.map((m: Message) => ({
            ...m,
            createdAt: new Date(m.createdAt),
          })));
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
      } finally {
        setHistoryLoading(false);
      }
    };

    const checkAiConfig = async () => {
      try {
        const res = await fetch('/api/fundamental');
        const data = await res.json();
        setAiConfigured(data.aiConfigured || false);
      } catch (error) {
        console.error('Failed to check AI config:', error);
      }
    };

    loadHistory();
    checkAiConfig();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
      createdAt: new Date(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await fetch('/api/fundamental/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      });

      const data = await res.json();

      if (data.success && data.response) {
        const assistantMsg: Message = {
          id: `temp-${Date.now()}-assistant`,
          role: 'assistant',
          content: data.response,
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        const errorMsg: Message = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${data.error || 'Failed to get response'}`,
          createdAt: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Error: Failed to send message. Please try again.',
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    if (!confirm('Clear all chat history?')) return;

    try {
      await fetch('/api/fundamental/chat', { method: 'DELETE' });
      setMessages([]);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  const isAdmin = session?.user?.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-background-primary flex flex-col">
      <MegaMenu
        userEmail={session?.user?.email || ''}
        isAdmin={isAdmin}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Macro Chat</h1>
            <p className="text-text-secondary text-sm mt-1">
              Ask questions about macroeconomics and FX markets
            </p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearHistory}
              className="text-sm text-text-muted hover:text-text-primary transition-colors px-3 py-1.5 rounded-lg hover:bg-surface-hover"
            >
              Clear history
            </button>
          )}
        </div>

        {!aiConfigured ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-text-muted">
              <p className="mb-2 text-lg">AI not configured</p>
              <p className="text-sm">Add ANTHROPIC_API_KEY to enable chat</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 bg-surface-primary border border-border-primary rounded-xl overflow-hidden flex flex-col min-h-[500px]">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {historyLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-blue" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-text-muted">
                    <div className="text-center">
                      <svg className="w-16 h-16 mx-auto mb-4 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                      </svg>
                      <p className="text-lg mb-2">Start a conversation</p>
                      <p className="text-sm">Ask about macro trends, currency outlooks, or market analysis</p>
                      <div className="mt-6 flex flex-wrap gap-2 justify-center">
                        {[
                          "What's the outlook for EUR/USD?",
                          "How does inflation affect JPY?",
                          "Explain risk-on vs risk-off",
                        ].map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => setInput(suggestion)}
                            className="px-3 py-2 text-sm bg-surface-secondary hover:bg-surface-hover rounded-lg transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          msg.role === 'user'
                            ? 'bg-accent-blue text-white'
                            : 'bg-surface-secondary text-text-primary'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">
                          {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                        </p>
                        <p className={`text-xs mt-2 ${msg.role === 'user' ? 'text-white/60' : 'text-text-muted'}`}>
                          {msg.createdAt.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-surface-secondary rounded-2xl px-4 py-3">
                      <div className="flex gap-1.5">
                        <span className="w-2.5 h-2.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2.5 h-2.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2.5 h-2.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 border-t border-border-primary bg-surface-primary">
                <form onSubmit={sendMessage} className="flex gap-3">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about macro or FX markets..."
                    disabled={loading}
                    className="flex-1 bg-surface-secondary border border-border-primary rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent disabled:opacity-50 transition-all"
                    maxLength={2000}
                  />
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    className="px-6 py-3 bg-accent-blue text-white rounded-xl font-medium hover:bg-accent-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

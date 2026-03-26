'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ChatMessage, type ChatMessageData } from './chat-message';
import { MentionAutocomplete, type MentionResult } from './mention-autocomplete';
import type { ChatMention } from '@/lib/db/schema/chat-messages';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 10_000;
const MAX_CHARS = 200;
const COOLDOWN_MS = 5_000;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ChatPanelProps {
  onClose: () => void;
}

export function ChatPanel({ onClose }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [error, setError] = useState('');

  // Mention autocomplete state
  const [mentionActive, setMentionActive] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionTrigger, setMentionTrigger] = useState<'@' | '#'>('@');
  const [mentionStartPos, setMentionStartPos] = useState(0);
  const [pendingMentions, setPendingMentions] = useState<ChatMention[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastTimestampRef = useRef<string | null>(null);
  const initialLoadRef = useRef(true);

  // -----------------------------------------------------------------------
  // Fetch messages
  // -----------------------------------------------------------------------

  const fetchMessages = useCallback(async (after?: string) => {
    try {
      const url = after
        ? `/api/chat?after=${encodeURIComponent(after)}`
        : '/api/chat?limit=50';
      const res = await fetch(url);
      if (!res.ok) return;
      const json = await res.json();
      const newMessages: ChatMessageData[] = json.data?.messages ?? [];

      if (newMessages.length > 0) {
        setMessages((prev) => {
          if (!after) return newMessages;
          // Deduplicate by id
          const existingIds = new Set(prev.map((m) => m.id));
          const unique = newMessages.filter((m) => !existingIds.has(m.id));
          return [...prev, ...unique];
        });
        lastTimestampRef.current =
          newMessages[newMessages.length - 1].createdAt;
      }
    } catch {
      // silently ignore
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchMessages();
    // Mark as read on open
    fetch('/api/chat/mark-read', { method: 'POST' }).catch(() => {});
  }, [fetchMessages]);

  // Polling
  useEffect(() => {
    const interval = setInterval(() => {
      if (lastTimestampRef.current) {
        fetchMessages(lastTimestampRef.current);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (initialLoadRef.current && messages.length > 0) {
      initialLoadRef.current = false;
      // Scroll to bottom after initial render
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      }, 50);
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // -----------------------------------------------------------------------
  // Input handling with mention detection
  // -----------------------------------------------------------------------

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    if (value.length > MAX_CHARS) return;
    setInput(value);
    setError('');

    // Detect @ or # trigger
    const cursorPos = e.target.selectionStart ?? value.length;
    const textBeforeCursor = value.slice(0, cursorPos);

    // Find the last @ or # that starts a mention
    const lastAt = textBeforeCursor.lastIndexOf('@');
    const lastHash = textBeforeCursor.lastIndexOf('#');
    const lastTriggerPos = Math.max(lastAt, lastHash);

    if (lastTriggerPos >= 0) {
      const trigger = textBeforeCursor[lastTriggerPos] as '@' | '#';
      const query = textBeforeCursor.slice(lastTriggerPos + 1);
      // Only activate if the query doesn't contain spaces (single word search)
      if (query.length > 0 && !query.includes(' ')) {
        setMentionActive(true);
        setMentionQuery(query);
        setMentionTrigger(trigger);
        setMentionStartPos(lastTriggerPos);
        return;
      }
    }

    setMentionActive(false);
  }

  function handleMentionSelect(result: MentionResult) {
    const prefix = result.type === 'player' ? '@' : '#';
    const mentionText = `${prefix}${result.name}`;
    const before = input.slice(0, mentionStartPos);
    const after = input.slice(
      mentionStartPos + 1 + mentionQuery.length,
    );
    const newInput = `${before}${mentionText} ${after}`;

    // Track mention positions
    const mention: ChatMention = {
      type: result.type,
      id: result.id,
      name: result.name,
      startIndex: mentionStartPos,
      endIndex: mentionStartPos + mentionText.length,
    };

    setInput(newInput);
    setPendingMentions((prev) => [...prev, mention]);
    setMentionActive(false);
    inputRef.current?.focus();
  }

  // -----------------------------------------------------------------------
  // Send message
  // -----------------------------------------------------------------------

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || sending || cooldown) return;

    setSending(true);
    setError('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: trimmed,
          mentions: pendingMentions,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error?.message ?? 'Errore nell\'invio');
        setSending(false);
        return;
      }

      setInput('');
      setPendingMentions([]);

      // Start cooldown
      setCooldown(true);
      setTimeout(() => setCooldown(false), COOLDOWN_MS);

      // Immediately fetch new messages
      if (lastTimestampRef.current) {
        fetchMessages(lastTimestampRef.current);
      }
    } catch {
      setError('Errore di connessione');
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !mentionActive) {
      e.preventDefault();
      handleSend();
    }
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="flex flex-col overflow-hidden rounded-t-2xl border border-border/50 bg-surface/95 shadow-2xl shadow-black/40 backdrop-blur-xl md:rounded-2xl w-full h-[60vh] md:w-[380px] md:h-[500px]">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/30 bg-surface-2/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4 text-primary">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.16 48.16 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
          </svg>
          <h2 className="text-sm font-bold text-foreground">Chat del Laboratorio</h2>
        </div>
        <button
          onClick={onClose}
          className="focus-ring flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface-3 hover:text-foreground transition-colors"
          aria-label="Chiudi chat"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto bg-background/50 py-1">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="text-xs text-muted/60">Nessun messaggio ancora</p>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="relative shrink-0 border-t border-border/30 bg-surface-2/60 px-3 py-2.5">
        {/* Mention autocomplete */}
        {mentionActive && (
          <MentionAutocomplete
            query={mentionQuery}
            triggerType={mentionTrigger}
            onSelect={handleMentionSelect}
            onDismiss={() => setMentionActive(false)}
          />
        )}

        {/* Error message */}
        {error && (
          <p className="mb-1.5 text-[10px] text-danger">{error}</p>
        )}

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Scrivi un messaggio..."
              maxLength={MAX_CHARS}
              disabled={sending}
              className="w-full rounded-lg border border-border/40 bg-surface/80 px-3 py-2 text-xs text-foreground placeholder:text-muted/50 focus:border-primary/50 focus:outline-none disabled:opacity-50 transition-colors"
              autoComplete="off"
            />
            {/* Character counter */}
            {input.length > 0 && (
              <span
                className={`absolute right-2 top-1/2 -translate-y-1/2 text-[9px] ${
                  input.length > MAX_CHARS - 20 ? 'text-danger' : 'text-muted/40'
                }`}
              >
                {input.length}/{MAX_CHARS}
              </span>
            )}
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending || cooldown}
            className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary-light disabled:opacity-40 disabled:shadow-none"
            aria-label="Invia"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </button>
        </div>

        {/* Cooldown indicator */}
        {cooldown && (
          <p className="mt-1 text-[9px] text-muted/50">Attendi qualche secondo...</p>
        )}
      </div>
    </div>
  );
}

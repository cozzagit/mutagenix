'use client';

import type { ChatMention } from '@/lib/db/schema/chat-messages';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessageData {
  id: string;
  userId: string;
  content: string;
  mentions: ChatMention[];
  isSystem: boolean;
  createdAt: string;
  displayName: string;
  isBot: boolean;
}

// ---------------------------------------------------------------------------
// Relative timestamp
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'ora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m fa`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h fa`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ieri';
  if (days < 7) return `${days}gg fa`;
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
}

// ---------------------------------------------------------------------------
// Render content with mention highlights
// ---------------------------------------------------------------------------

function renderContent(content: string, mentions: ChatMention[]) {
  // If we have structured mentions, use them (startIndex/endIndex-based)
  if (mentions && mentions.length > 0) {
    const sorted = [...mentions].sort((a, b) => a.startIndex - b.startIndex);
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    for (let i = 0; i < sorted.length; i++) {
      const m = sorted[i];
      if (m.startIndex > lastIndex) {
        parts.push(<span key={`t-${i}`}>{content.slice(lastIndex, m.startIndex)}</span>);
      }
      const mentionClass =
        m.type === 'player'
          ? 'text-primary font-semibold'
          : 'text-bio-purple font-semibold';
      const prefix = m.type === 'player' ? '@' : '#';
      parts.push(
        <span key={`m-${i}`} className={mentionClass}>
          {prefix}{m.name}
        </span>,
      );
      lastIndex = m.endIndex;
    }

    if (lastIndex < content.length) {
      parts.push(<span key="tail">{content.slice(lastIndex)}</span>);
    }

    return <>{parts}</>;
  }

  // Fallback: detect @Player and #Creature inline (for bot messages without structured mentions)
  const tagRegex = /([@#][A-Za-zÀ-ÿ0-9_.]+(?:\s[A-ZÀ-Ÿ][a-zà-ÿ0-9.]*)?)(?=[,.:;!?\s]|$)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`t-${lastIndex}`}>{content.slice(lastIndex, match.index)}</span>);
    }
    const tag = match[1];
    const isPlayer = tag.startsWith('@');
    const cls = isPlayer ? 'text-primary font-semibold' : 'text-bio-purple font-semibold';
    parts.push(<span key={`m-${match.index}`} className={cls}>{tag}</span>);
    lastIndex = match.index + tag.length;
  }

  if (parts.length === 0) {
    return <span>{content}</span>;
  }

  if (lastIndex < content.length) {
    parts.push(<span key="tail">{content.slice(lastIndex)}</span>);
  }

  return <>{parts}</>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatMessage({ message }: { message: ChatMessageData }) {
  if (message.isSystem) {
    return (
      <div className="px-3 py-1.5">
        <p className="text-[11px] italic text-bio-cyan/80">{message.content}</p>
      </div>
    );
  }

  const nameClass = message.isBot ? 'text-muted' : 'text-primary';

  return (
    <div className="group px-3 py-1.5 hover:bg-surface-2/30 transition-colors">
      {/* Name + Badge + Time */}
      <div className="flex items-center gap-1.5">
        <span className={`text-[11px] font-bold ${nameClass} truncate max-w-[140px]`}>
          {message.displayName}
        </span>
        {message.isBot && (
          <span className="shrink-0 rounded bg-surface-3 px-1 py-px text-[8px] font-bold uppercase text-muted leading-none">
            BOT
          </span>
        )}
        <span className="ml-auto shrink-0 text-[9px] text-muted/60">
          {relativeTime(message.createdAt)}
        </span>
      </div>
      {/* Content */}
      <p className="mt-0.5 text-xs text-foreground/90 leading-relaxed break-words">
        {renderContent(message.content, message.mentions)}
      </p>
    </div>
  );
}

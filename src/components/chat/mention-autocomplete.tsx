'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MentionResult {
  type: 'player' | 'creature';
  id: string;
  name: string;
  ownerName?: string; // only for creatures
}

interface MentionAutocompleteProps {
  query: string;
  triggerType: '@' | '#';
  onSelect: (result: MentionResult) => void;
  onDismiss: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MentionAutocomplete({
  query,
  triggerType,
  onSelect,
  onDismiss,
}: MentionAutocompleteProps) {
  const [results, setResults] = useState<MentionResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  const search = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (q.length < 1) {
        setResults([]);
        return;
      }
      setLoading(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const typeParam = triggerType === '@' ? 'player' : 'creature';
          const res = await fetch(
            `/api/chat/mentions?q=${encodeURIComponent(q)}&type=${typeParam}`,
          );
          if (!res.ok) return;
          const json = await res.json();

          const items: MentionResult[] = [];
          if (triggerType === '@' && json.data?.players) {
            for (const p of json.data.players) {
              items.push({ type: 'player', id: p.id, name: p.displayName });
            }
          }
          if (triggerType === '#' && json.data?.creatures) {
            for (const c of json.data.creatures) {
              items.push({
                type: 'creature',
                id: c.id,
                name: c.name,
                ownerName: c.ownerName,
              });
            }
          }
          setResults(items);
          setActiveIndex(0);
        } catch {
          // silently ignore
        } finally {
          setLoading(false);
        }
      }, 300);
    },
    [triggerType],
  );

  useEffect(() => {
    search(query);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault();
        onSelect(results[activeIndex]);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [results, activeIndex, onSelect, onDismiss]);

  if (results.length === 0 && !loading) return null;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 right-0 mb-1 max-h-48 overflow-y-auto rounded-xl border border-border/50 bg-surface/95 shadow-xl shadow-black/30 backdrop-blur-xl"
    >
      {loading && results.length === 0 && (
        <div className="px-3 py-2 text-[11px] text-muted">Ricerca...</div>
      )}
      {results.map((item, i) => (
        <button
          key={`${item.type}-${item.id}`}
          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
            i === activeIndex
              ? 'bg-primary/15 text-foreground'
              : 'text-muted hover:bg-surface-2 hover:text-foreground'
          }`}
          onMouseEnter={() => setActiveIndex(i)}
          onClick={() => onSelect(item)}
        >
          {/* Icon */}
          <span className="shrink-0 text-[10px]">
            {item.type === 'player' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5 text-primary">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5 text-bio-purple">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714a2.25 2.25 0 0 0 .659 1.591L19 14.5" />
              </svg>
            )}
          </span>
          {/* Name */}
          <span className="truncate font-medium">{item.name}</span>
          {/* Owner (creatures only) */}
          {item.ownerName && (
            <span className="ml-auto shrink-0 text-[10px] text-muted/60">
              di {item.ownerName}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

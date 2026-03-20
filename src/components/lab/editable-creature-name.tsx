'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface EditableCreatureNameProps {
  creatureId: string;
  name: string;
  onNameChange: (name: string) => void;
  className?: string;
}

export function EditableCreatureName({
  creatureId,
  name,
  onNameChange,
  className = '',
}: EditableCreatureNameProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEditing = useCallback(() => {
    setDraft(name);
    setEditing(true);
  }, [name]);

  const cancel = useCallback(() => {
    setDraft(name);
    setEditing(false);
  }, [name]);

  const save = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed.length > 24) {
      cancel();
      return;
    }
    if (trimmed === name) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/creature', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        onNameChange(trimmed);
        setEditing(false);
      } else {
        cancel();
      }
    } catch {
      cancel();
    } finally {
      setSaving(false);
    }
  }, [draft, name, onNameChange, cancel]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        save();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    },
    [save, cancel],
  );

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        maxLength={24}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={save}
        className={`glow-cyan bg-transparent text-center font-black tracking-tight text-bio-cyan outline-none ring-1 ring-bio-cyan/40 rounded px-1 ${className}`}
        style={{ minWidth: '6ch', maxWidth: '24ch' }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      className={`glow-cyan group inline-flex items-center gap-1 font-black tracking-tight text-bio-cyan hover:text-bio-cyan/80 transition-colors cursor-pointer ${className}`}
      title="Clicca per rinominare"
    >
      <span>{name}</span>
      <svg
        viewBox="0 0 16 16"
        fill="currentColor"
        className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60"
      >
        <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L3.22 10.303a.75.75 0 0 0-.188.336l-.775 3.1a.75.75 0 0 0 .91.91l3.1-.775a.75.75 0 0 0 .336-.188l7.79-7.793a1.75 1.75 0 0 0 0-2.475l-.905-.905ZM11.72 3.22a.25.25 0 0 1 .354 0l.905.905a.25.25 0 0 1 0 .354L12 5.457 10.543 4l.978-.78h.001ZM9.836 4.707l1.457 1.457-6.25 6.25-1.927.482.482-1.928 6.238-6.261Z" />
      </svg>
    </button>
  );
}

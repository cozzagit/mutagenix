'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { ChatPanel } from './chat-panel';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 30_000;
const NOTIFICATION_TAG = 'mutagenix-chat';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ChatBubble() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastNotifiedRef = useRef(0);

  // -----------------------------------------------------------------------
  // Poll for unread mentions
  // -----------------------------------------------------------------------

  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/unread');
      if (!res.ok) return;
      const json = await res.json();
      const count: number = json.data?.unreadMentions ?? 0;
      setUnreadCount(count);

      // Browser notification when panel is closed and new mentions arrive
      if (!open && count > lastNotifiedRef.current && count > 0) {
        if (
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          new Notification('Mutagenix', {
            body:
              count === 1
                ? 'Qualcuno ti ha menzionato in chat!'
                : `${count} nuove menzioni in chat!`,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: NOTIFICATION_TAG,
            renotify: true,
          } as NotificationOptions & { renotify: boolean });
        }
        lastNotifiedRef.current = count;
      }
    } catch {
      // silently ignore
    }
  }, [open]);

  useEffect(() => {
    if (open) return; // don't poll when panel is open
    fetchUnread();
    const interval = setInterval(fetchUnread, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [open, fetchUnread]);

  // -----------------------------------------------------------------------
  // Open / Close
  // -----------------------------------------------------------------------

  function handleOpen() {
    setOpen(true);
    setUnreadCount(0);
    lastNotifiedRef.current = 0;
  }

  function handleClose() {
    setOpen(false);
    // Re-fetch unread after closing
    setTimeout(fetchUnread, 500);
  }

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-[calc(52px+env(safe-area-inset-bottom,0px))] right-0 z-[60] md:bottom-4 md:right-4 transition-transform duration-300 animate-in slide-in-from-bottom-4">
          <ChatPanel onClose={handleClose} />
        </div>
      )}

      {/* Floating button */}
      {!open && (
        <button
          onClick={handleOpen}
          className="focus-ring fixed z-[60] flex h-11 w-11 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/30 transition-all hover:bg-primary-light hover:shadow-primary/40 active:scale-95 bottom-[calc(60px+env(safe-area-inset-bottom,0px))] right-3 md:bottom-4 md:right-4"
          aria-label="Apri chat"
          style={{ minHeight: 44, minWidth: 44 }}
        >
          {/* Chat icon */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5 text-white">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.16 48.16 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
          </svg>

          {/* Unread badge */}
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white shadow-sm animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      )}
    </>
  );
}

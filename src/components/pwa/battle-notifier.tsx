'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';

const POLL_INTERVAL_MS = 60_000;
const NOTIFICATION_TAG = 'mutagenix-battle';
const DEFAULT_TITLE = 'Mutagenix';

export function BattleNotifier() {
  const pathname = usePathname();
  const lastCountRef = useRef(0);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const hasRequestedRef = useRef(false);

  // Request notification permission — called after a successful poll
  // that returns data, meaning the user has arena access
  const requestPermission = useCallback(async () => {
    if (hasRequestedRef.current) return;
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      setPermissionGranted(true);
      return;
    }

    if (Notification.permission === 'denied') return;

    hasRequestedRef.current = true;

    // Defer the permission request to the next user interaction
    // (browsers block programmatic requests without a user gesture)
    const handler = async () => {
      try {
        const result = await Notification.requestPermission();
        if (result === 'granted') setPermissionGranted(true);
      } catch {
        // Permission request failed — non-blocking
      }
      document.removeEventListener('click', handler);
      document.removeEventListener('touchend', handler);
    };

    document.addEventListener('click', handler, { once: false });
    document.addEventListener('touchend', handler, { once: false });

    // Cleanup after 5 minutes — don't listen forever
    setTimeout(() => {
      document.removeEventListener('click', handler);
      document.removeEventListener('touchend', handler);
    }, 300_000);
  }, []);

  // Check permission state on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      setPermissionGranted(true);
    }
  }, []);

  // Poll for unread battles
  useEffect(() => {
    // Don't poll if we're already on the arena page — user can see battles directly
    if (pathname?.startsWith('/arena')) return;

    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch('/api/arena/unread');
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const count: number = json.data?.unseenBattles ?? 0;

        // If we got a valid response, the user has arena access — try to
        // get notification permission on their next interaction
        if (!permissionGranted) {
          requestPermission();
        }

        if (count > 0 && count > lastCountRef.current) {
          // New battle(s) since last check — notify the user

          // Update page title with badge
          document.title = `(${count}) ${DEFAULT_TITLE}`;

          // Show native notification (works in PWA standalone + background tabs)
          if (permissionGranted && 'Notification' in window) {
            new Notification(DEFAULT_TITLE, {
              body:
                count === 1
                  ? 'Il tuo guerriero è stato sfidato!'
                  : `Il tuo guerriero ha subito ${count} sfide!`,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              tag: NOTIFICATION_TAG, // replaces previous notification
              renotify: true,
            } as NotificationOptions & { renotify: boolean });
          }
        }

        if (count === 0 && lastCountRef.current > 0) {
          // Battles were seen — restore default title
          document.title = DEFAULT_TITLE;
        }

        lastCountRef.current = count;
      } catch {
        // Network error — silently ignore, will retry on next interval
      }
    };

    // Check immediately on mount
    check();

    // Then poll at regular interval
    const interval = setInterval(check, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pathname, permissionGranted, requestPermission]);

  // Reset title and counter when navigating to arena
  useEffect(() => {
    if (pathname?.startsWith('/arena')) {
      document.title = DEFAULT_TITLE;
      lastCountRef.current = 0;
    }
  }, [pathname]);

  // This component renders nothing — it only runs side effects
  return null;
}

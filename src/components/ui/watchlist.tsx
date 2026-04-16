'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 6.a — Watchlist.
 *
 * Lets the user star a curator to add it to their personal watchlist, then
 * optionally filter the dashboard to "watchlist only" via the `?watched=1`
 * URL param. Watchlist is keyed by curator slug and persisted to localStorage
 * (no auth, no server-side state).
 *
 * The hook uses useSyncExternalStore so multiple StarButton instances on the
 * page stay in sync without prop drilling — clicking the star on one row
 * updates every other star showing the same slug.
 *
 * **Why localStorage, not URL:** the watchlist may grow to dozens of slugs;
 * baking that into URL params would make share-links ugly. The `?watched=1`
 * param is a cleaner share signal ("show me only what I'm watching") that
 * still respects local state.
 */

const STORAGE_KEY = 'defi-vault-dashboard:watchlist:v1';

// In-memory mirror of the localStorage set, kept in sync via the storage event.
// Initialized lazily to avoid SSR window access.
let memoryStore: Set<string> | null = null;
const subscribers = new Set<() => void>();

function readFromStorage(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

function writeToStorage(set: Set<string>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // Quota exceeded or storage disabled — silently drop. The in-memory state
    // still works for this session.
  }
}

function getSnapshot(): Set<string> {
  if (memoryStore === null) memoryStore = readFromStorage();
  return memoryStore;
}

// Server-side snapshot must return a STABLE reference to satisfy
// useSyncExternalStore. Returning new Set() on each call would cause infinite
// re-render loops during hydration.
const EMPTY_SET: Set<string> = new Set();
function getServerSnapshot(): Set<string> {
  return EMPTY_SET;
}

function subscribe(callback: () => void): () => void {
  subscribers.add(callback);
  // Listen for cross-tab changes via the storage event.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    memoryStore = readFromStorage();
    for (const cb of subscribers) cb();
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    subscribers.delete(callback);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

function notifyAll(): void {
  for (const cb of subscribers) cb();
}

/**
 * Returns the set of watched curator slugs and a toggler. Stable across
 * renders thanks to useSyncExternalStore.
 */
export function useWatchlist(): {
  watched: Set<string>;
  isWatched: (slug: string) => boolean;
  toggle: (slug: string) => void;
  clear: () => void;
} {
  const watched = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback((slug: string) => {
    const next = new Set(getSnapshot());
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    memoryStore = next;
    writeToStorage(next);
    notifyAll();
  }, []);

  const clear = useCallback(() => {
    memoryStore = new Set();
    writeToStorage(memoryStore);
    notifyAll();
  }, []);

  const isWatched = useCallback((slug: string) => watched.has(slug), [watched]);
  return { watched, isWatched, toggle, clear };
}

/**
 * Reads `?watched=1` from URL — used by the global filter to opt into
 * "show only watchlist" mode.
 */
export function useWatchedOnlyMode(): boolean {
  const params = useSearchParams();
  return params.get('watched') === '1';
}

/**
 * Star button that toggles a slug in the watchlist. Filled when active.
 * Stops click propagation so it can be safely placed inside a Link or row.
 */
export function StarButton({ slug, size = 14, className }: { slug: string; size?: number; className?: string }) {
  const { isWatched, toggle } = useWatchlist();
  // Avoid hydration mismatch: server snapshot is always empty, so the first
  // client paint must match. We only render the active state after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const active = mounted && isWatched(slug);

  return (
    <button
      onClick={e => {
        e.preventDefault();
        e.stopPropagation();
        toggle(slug);
      }}
      title={active ? 'Remove from watchlist' : 'Add to watchlist'}
      aria-label={active ? `Unstar ${slug}` : `Star ${slug}`}
      aria-pressed={active}
      className={cn(
        'p-1 rounded transition-colors hover:bg-amber-50 group',
        className,
      )}
    >
      <Star
        className={cn(
          'transition-colors',
          active
            ? 'fill-amber-400 text-amber-400'
            : 'text-gray-300 group-hover:text-amber-400',
        )}
        style={{ width: size, height: size }}
      />
    </button>
  );
}

/**
 * Filter-bar toggle button: enable/disable "watchlist only" mode. Updates
 * the `?watched=1` URL param via router.replace so the state is shareable.
 * Disabled when the watchlist is empty (would always return 0 results).
 */
export function WatchlistFilterToggle() {
  const router = useRouter();
  const params = useSearchParams();
  const { watched } = useWatchlist();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isOn = mounted && params.get('watched') === '1';
  const empty = mounted && watched.size === 0;

  const onClick = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    if (isOn) next.delete('watched');
    else next.set('watched', '1');
    const qs = next.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  }, [isOn, params, router]);

  return (
    <button
      onClick={onClick}
      disabled={empty}
      title={
        empty
          ? 'Star at least one curator to enable this filter'
          : isOn
            ? 'Showing only watched curators — click to clear'
            : `Filter to ${watched.size} watched curator${watched.size === 1 ? '' : 's'}`
      }
      aria-pressed={isOn}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium border transition-colors text-[12px]',
        isOn
          ? 'bg-amber-50 text-amber-700 border-amber-200'
          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
        empty && 'opacity-50 cursor-not-allowed hover:border-gray-200',
      )}
    >
      <Star
        className="h-3.5 w-3.5"
        style={{
          fill: isOn ? 'currentColor' : 'none',
        }}
      />
      Watchlist
      {mounted && watched.size > 0 && (
        <span
          className={cn(
            'text-[10px] rounded-full px-1.5 py-0.5',
            isOn ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600',
          )}
        >
          {watched.size}
        </span>
      )}
    </button>
  );
}

/**
 * Pure helper: filter a curator list down to watched slugs. Pass-through if
 * `watchedOnly` is false. Used by page.tsx — kept as a separate function so
 * it's easy to unit-test without React.
 */
export function applyWatchlistFilter<T extends { slug: string }>(
  items: T[],
  watched: Set<string>,
  watchedOnly: boolean,
): T[] {
  if (!watchedOnly) return items;
  return items.filter(item => watched.has(item.slug));
}

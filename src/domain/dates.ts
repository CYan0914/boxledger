import type { Item } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysSince(iso: string, now: Date = new Date()): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((now.getTime() - then) / DAY_MS));
}

/**
 * An item is stale when it is still unsold and has sat for longer than the
 * threshold. The clock starts at intake, unless it was listed later, in which
 * case the listing date is the fairer start — an item sitting in a bin before
 * listing has not failed to sell yet.
 */
export function isStale(item: Item, staleDays: number, now: Date = new Date()): boolean {
  if (item.status === 'sold') return false;
  const since = item.listedAt ?? item.createdAt;
  return daysSince(since, now) > staleDays;
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function startOfMonth(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

// Gentle check-ins (Bible › Refine, Release, Let go): a promise that hasn't moved for about 3 days gets one soft question.
// Never "overdue", never a count of days. Set aside = quiet for about a week. Off in Settings = never.
import { db, getSettings } from '../db/db';
import type { DMPromise } from '../db/types';
import { nowISO } from '../lib/util';
import { activePromises } from './promises';

const DAY = 864e5;
const lastMove = (p: DMPromise) => p.story.filter((s) => s.kind !== 'kept' && s.kind !== 'released').map((s) => s.at).sort().pop() ?? p.createdAt;

export async function promiseNeedingCheckin(force = false): Promise<DMPromise | null> {
  const s = await getSettings();
  if (!s.checkins && !force) return null;
  const now = Date.now();
  for (const p of await activePromises()) {
    if (force) return p;
    const still = now - new Date(lastMove(p)).getTime() > 3 * DAY;
    const quiet = p.checkinAt && now - new Date(p.checkinAt).getTime() < 7 * DAY;
    if (still && !quiet) return p;
  }
  return null;
}

export async function setAside(id: string): Promise<void> {
  const p = await db.promises.get(id);
  if (p) await db.promises.put({ ...p, checkinAt: nowISO() });
}

/** What helps, by what's in the way. Possibilities, never diagnoses. */
export const BLOCK_HELP: Record<string, { say: string; act: 'refine' | 'edit' | 'release' }> = {
  'No time': { say: 'Maybe a 5-minute version fits your days right now.', act: 'refine' },
  'No energy': { say: 'Make it smaller, so it fits the energy you have, not the energy you wish you had.', act: 'refine' },
  'It’s unclear': { say: 'Name the very first step, so your hands know what to do.', act: 'refine' },
  'I forgot': { say: 'Tie it to something you already do, like right after brushing your teeth.', act: 'edit' },
  'It feels scary': { say: 'Make the promise the action, not the outcome. Drafting counts, even without sending.', act: 'refine' },
  'It changed': { say: 'Priorities change. Releasing it is allowed, and it’s never counted against you.', act: 'release' },
};

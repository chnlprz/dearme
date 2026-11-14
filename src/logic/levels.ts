// Levels (Bible › Promises, slots and levels). Set by total promises kept; only go up; released never counts against you.
import { db, getSettings } from '../db/db';

export const LEVEL_AT = [0, 3, 8, 15, 24, 36]; // kept promises needed for Level 1..6

export function levelFor(kept: number): number {
  let lv = 1;
  LEVEL_AT.forEach((need, i) => { if (kept >= need) lv = i + 1; });
  return lv;
}
export const slotsFor = (level: number) => (level >= 4 ? 3 : level >= 2 ? 2 : 1);

export async function keptTotal(sandbox: boolean): Promise<number> {
  return db.promises.filter((p) => p.status === 'kept' && !!p.sandbox === sandbox).count();
}

/** How many promises can be active right now. */
export async function slotCount(): Promise<number> {
  const s = await getSettings();
  if (s.unlockAll) return 3;
  return slotsFor(levelFor(await keptTotal(s.sandbox)));
}

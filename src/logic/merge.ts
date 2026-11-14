// Merging (Bible › Tech: "First sign-in merges, never replaces"). Losing a jar of kept promises is the worst bug,
// so nothing here deletes an orb or a promise: orbs only move between unsealed jars, and only empty jars go.
import { db } from '../db/db';
import type { Jar, Orb, Settings } from '../db/types';
import { JAR_SIZE } from './jar';

/**
 * Pure: two devices can each have an unsealed jar. Pool their orbs in the order they were kept and refill the
 * unsealed jars from the oldest: 12, then the next 12… Sealed jars are never touched.
 * Returns where each orb should be and which unsealed jars end up empty.
 */
export function poolJars(open: Jar[], orbs: Orb[]): { moves: Map<string, string>; empty: string[] } {
  const has = new Set(orbs.map((o) => o.jarId));
  // jars that hold orbs first (oldest first), so an empty new "chapter 1" never takes over a jar in progress
  const jars = [...open].sort((a, b) => Number(has.has(b.id)) - Number(has.has(a.id)) || a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id));
  const ids = new Set(jars.map((j) => j.id));
  const pool = orbs.filter((o) => ids.has(o.jarId)).sort((a, b) => a.keptAt.localeCompare(b.keptAt) || a.id.localeCompare(b.id));
  const moves = new Map<string, string>(), used = new Set<string>();
  pool.forEach((o, i) => {
    const j = jars[Math.min(Math.floor(i / JAR_SIZE), jars.length - 1)];
    used.add(j.id);
    if (o.jarId !== j.id) moves.set(o.id, j.id);
  });
  // keep the oldest jar even when everything is empty, so there is always a jar to fill
  const empty = jars.filter((j, i) => !used.has(j.id) && (i > 0 || used.size > 0)).map((j) => j.id);
  return { moves, empty };
}

/** After a sync brought rows in: at most one jar is being filled (per real/sandbox), the rest are full or gone. */
export async function normalizeJars(): Promise<boolean> {
  let changed = false;
  for (const sandbox of [false, true]) {
    const open = await db.jars.filter((j) => !j.sealedAt && !!j.sandbox === sandbox).toArray();
    if (open.length < 2) continue;
    const orbs = await db.orbs.where('jarId').anyOf(open.map((j) => j.id)).toArray();
    const { moves, empty } = poolJars(open, orbs);
    if (!moves.size && !empty.length) continue;
    await db.transaction('rw', db.jars, db.orbs, db.promises, async () => {
      for (const [orbId, jarId] of moves) {
        const o = await db.orbs.get(orbId); if (!o) continue;
        await db.orbs.update(orbId, { jarId });
        await db.promises.update(o.promiseId, { jarId });
      }
      // an "empty" jar can still hold promises' jarId only if they were moved above, so nothing points to it now
      await db.jars.bulkDelete(empty);
    });
    changed = true;
  }
  return changed;
}

/** First sign-in on a device: the account's settings come in, but nothing this device had is lost. */
export function mergeSettings(local: Settings, remote: Settings): Settings {
  const uniq = (a: string[] = [], b: string[] = []) => [...new Set([...a, ...b])];
  return {
    ...remote,
    name: remote.name || local.name,
    useName: remote.name ? remote.useName : local.useName,
    onboarded: remote.onboarded || local.onboarded,
    lastLevel: Math.max(remote.lastLevel ?? 1, local.lastLevel ?? 1),
    seenUnlocks: uniq(remote.seenUnlocks, local.seenUnlocks),
    hard: uniq(remote.hard, local.hard), blocks: uniq(remote.blocks, local.blocks),
    ...DEVICE_ONLY(local),
  };
}

/** Settings that belong to this phone only (Beta, sandbox, motion, sound, reminder delivery, toasts). */
export const DEVICE_ONLY = (s: Settings) => ({
  beta: s.beta, sandbox: s.sandbox, unlockAll: s.unlockAll, homeToast: s.homeToast,
  sound: s.sound, motion: s.motion, reminder: s.reminder, country: s.country,
});

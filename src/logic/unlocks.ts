// What each level opens (Bible › Promises, slots and levels): slots at Level 2 and 4, one jar and one inside per level.
import { getSettings, updateSettings } from '../db/db';
import type { InsideId, JarStyleId } from '../db/types';
import { INSIDES, JAR_STYLES } from '../jar/engine';
import { keptTotal, LEVEL_AT, levelFor } from './levels';

export interface LevelInfo { level: number; kept: number; next: number | null; toNext: number }

export async function levelInfo(): Promise<LevelInfo> {
  const s = await getSettings();
  const kept = await keptTotal(s.sandbox);
  const level = levelFor(kept);
  const next = level < LEVEL_AT.length ? LEVEL_AT[level] : null;
  return { level, kept, next, toNext: next == null ? 0 : next - kept };
}

export async function isOpen(_kind: 'jar' | 'in', lv: number): Promise<boolean> {
  const s = await getSettings();
  return s.unlockAll || (await levelInfo()).level >= lv;
}

export function unlocksAt(level: number): { slots?: number; jar?: { id: JarStyleId; name: string }; inside?: { id: InsideId; name: string } } {
  const jar = JAR_STYLES.find((j) => j.level === level), inside = INSIDES.find((i) => i.level === level);
  return { ...(level === 2 ? { slots: 2 } : level === 4 ? { slots: 3 } : {}), ...(jar && level > 1 ? { jar } : {}), ...(inside && level > 1 ? { inside } : {}) };
}

/** Unlocked items not yet seen in Jar and what's inside (the NEW badges). */
export async function newUnlocks(): Promise<string[]> {
  const s = await getSettings();
  const lv = s.unlockAll ? 99 : (await levelInfo()).level;
  const open = [...JAR_STYLES.filter((j) => j.level <= lv).map((j) => `jar:${j.id}`), ...INSIDES.filter((i) => i.level <= lv).map((i) => `in:${i.id}`)];
  return open.filter((k) => !s.seenUnlocks.includes(k));
}

export async function markSeen(keys: string[]): Promise<void> {
  const s = await getSettings();
  await updateSettings({ seenUnlocks: [...new Set([...s.seenUnlocks, ...keys])] });
}

/** The level just reached and not yet celebrated, if any (never during sandbox). */
export async function pendingLevelUp(): Promise<number | null> {
  const s = await getSettings();
  if (s.sandbox) return null;
  const { level } = await levelInfo();
  if (level > s.lastLevel) { await updateSettings({ lastLevel: level }); return level; }
  return null;
}

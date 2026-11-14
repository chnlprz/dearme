// Sealing a full jar: positions are frozen, the jar gets its name, and a fresh jar begins (Bible › Jar, orbs and the shelf).
import { db, getSettings } from '../db/db';
import type { DMPromise, Jar, Orb } from '../db/types';
import { nowISO } from '../lib/util';
import { snapshot } from '../jar/engine';
import { activeJar, orbsIn } from './jar';

export const LABEL_MAX = 24;

/** Freeze where every orb rests (from the live jar on screen) and seal. Returns the next, empty jar. */
export async function sealJar(label: string): Promise<Jar> {
  const jar = await activeJar();
  const pos = new Map(snapshot().map((p) => [p.id, p]));
  const orbs = await orbsIn(jar.id);
  await db.transaction('rw', db.orbs, db.jars, async () => {
    for (const o of orbs) { const p = pos.get(o.id); if (p) await db.orbs.put({ ...o, x: p.x, y: p.y, a: p.a }); }
    await db.jars.put({ ...jar, label: cleanLabel(label) || jar.label, sealedAt: nowISO(), updatedAt: nowISO() });
  });
  return activeJar(); // makes "chapter n+1"
}

export const cleanLabel = (s: string) => s.trim().replace(/\s+/g, ' ').slice(0, LABEL_MAX);

export async function renameJar(id: string, label: string): Promise<void> {
  const j = await db.jars.get(id);
  const l = cleanLabel(label);
  if (j && l) await db.jars.put({ ...j, label: l, updatedAt: nowISO() });
}

export async function sealedJars(): Promise<Jar[]> {
  const s = await getSettings();
  return (await db.jars.filter((j) => !!j.sealedAt && !!j.sandbox === s.sandbox).toArray()).sort((a, b) => b.sealedAt!.localeCompare(a.sealedAt!));
}

/** "Sep 2 – Oct 18, 2026" from the first and last kept orb. */
export function dateRange(orbs: Orb[], jar: Jar): string {
  const ds = orbs.map((o) => o.keptAt).sort();
  const a = new Date(ds[0] ?? jar.startedAt), b = new Date(ds[ds.length - 1] ?? jar.sealedAt ?? jar.startedAt);
  const md = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (a.toDateString() === b.toDateString()) return `${md(a)}, ${a.getFullYear()}`;
  return a.getFullYear() === b.getFullYear() ? `${md(a)} – ${md(b)}, ${b.getFullYear()}` : `${md(a)}, ${a.getFullYear()} – ${md(b)}, ${b.getFullYear()}`;
}

export const keptDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

/** Promises behind a jar's orbs, in the order they were kept (test orbs from Beta have none). */
export async function promisesOf(orbs: Orb[]): Promise<(DMPromise | undefined)[]> {
  return Promise.all(orbs.map((o) => (o.promiseId === 'test' ? undefined : db.promises.get(o.promiseId))));
}

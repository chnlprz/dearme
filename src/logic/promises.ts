// Promises: make, edit, refine (make smaller), release, keep. Never "delete"; releasing is never a failure.
import { db, getSettings } from '../db/db';
import type { DMPromise, Orb, StoryStep } from '../db/types';
import { nowISO, uid } from '../lib/util';
import { activeJar, JAR_SIZE, makeOrb, orbsIn } from './jar';

export const MAX_LEN = 120;

export async function activePromises(): Promise<DMPromise[]> {
  const s = await getSettings();
  return (await db.promises.where('status').equals('active').toArray())
    .filter((p) => !!p.sandbox === s.sandbox)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

const step = (kind: StoryStep['kind'], extra: Partial<StoryStep> = {}): StoryStep => ({ at: nowISO(), kind, ...extra });

export async function makePromise(text: string): Promise<DMPromise> {
  const s = await getSettings();
  const p: DMPromise = {
    id: uid(), text: text.trim().slice(0, MAX_LEN), status: 'active', createdAt: nowISO(), updatedAt: nowISO(),
    story: [step('made', { text: text.trim() })], ...(s.sandbox ? { sandbox: true } : {}),
  };
  await db.promises.put(p);
  return p;
}

async function change(id: string, fn: (p: DMPromise) => void): Promise<DMPromise | undefined> {
  const p = await db.promises.get(id);
  if (!p) return undefined;
  fn(p); p.updatedAt = nowISO();
  await db.promises.put(p);
  return p;
}

export const editPromise = (id: string, text: string) =>
  change(id, (p) => { p.text = text.trim().slice(0, MAX_LEN); p.story.push(step('edited', { text: p.text })); });

/** Make it smaller: keeps the original wording, so the story shows the turn that helped. */
export const refinePromise = (id: string, text: string) =>
  change(id, (p) => { if (!p.refinedFrom) p.refinedFrom = p.text; p.text = text.trim().slice(0, MAX_LEN); p.story.push(step('refined', { text: p.text })); });

export const releasePromise = (id: string, note?: string) =>
  change(id, (p) => { p.status = 'released'; p.releasedAt = nowISO(); p.story.push(step('released', note ? { note } : {})); });

export async function jarIsFull(): Promise<boolean> {
  return (await orbsIn((await activeJar()).id)).length >= JAR_SIZE;
}

/** Kept: the promise gets its orb (with today's inside and colour, kept forever). */
export async function keepPromise(id: string): Promise<Orb | null> {
  if (await jarIsFull()) return null;
  const jar = await activeJar();
  const orb = await makeOrb(id);
  await change(id, (p) => { p.status = 'kept'; p.keptAt = orb.keptAt; p.jarId = jar.id; p.story.push(step('kept')); });
  return orb;
}

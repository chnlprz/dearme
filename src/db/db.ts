import Dexie, { type Table } from 'dexie';
import type { DMPromise, Jar, Meta, Orb, Settings } from './types';
import { defaultSettings, newJar, newMeta } from './defaults';
import { nowISO } from '../lib/util';

export const SCHEMA_VERSION = 1;

export class DearMeDB extends Dexie {
  promises!: Table<DMPromise, string>;
  orbs!: Table<Orb, string>;
  jars!: Table<Jar, string>;
  settings!: Table<Settings, string>;
  meta!: Table<Meta, string>;

  constructor() {
    super('dearme');
    this.version(SCHEMA_VERSION).stores({
      promises: 'id, status, jarId, createdAt, updatedAt, keptAt',
      orbs: 'id, jarId, promiseId, keptAt',
      jars: 'id, sealedAt, startedAt, updatedAt',
      settings: 'id',
      meta: 'id',
    });
  }
}

export const db = new DearMeDB();

/** First open: settings, device meta and the first jar ("chapter 1"). Safe to call every launch. */
export async function ensureSeeded(): Promise<void> {
  await db.transaction('rw', db.settings, db.meta, db.jars, async () => {
    if (!(await db.settings.get('settings'))) await db.settings.put(defaultSettings());
    if (!(await db.meta.get('meta'))) await db.meta.put(newMeta(SCHEMA_VERSION));
    const open = await db.jars.filter((j) => !j.sealedAt && !j.sandbox).count();
    if (!open) await db.jars.put(newJar((await db.jars.filter((j) => !j.sandbox).count()) + 1, 'classic'));
  });
}

export async function getSettings(): Promise<Settings> {
  // Older settings rows get any new fields from the defaults.
  return { ...defaultSettings(), ...((await db.settings.get('settings')) ?? {}) };
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch, updatedAt: nowISO() };
  await db.settings.put(next);
  return next;
}

/** The jar being filled (real or sandbox). */
export async function currentJar(sandbox = false): Promise<Jar | undefined> {
  // the oldest unsealed one: after a merge, a full jar waits to be sealed before the next is filled
  return (await db.jars.filter((j) => !j.sealedAt && !!j.sandbox === sandbox).toArray()).sort((a, b) => a.startedAt.localeCompare(b.startedAt))[0];
}

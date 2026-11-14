// Insights (Settings › Insights): what was kept, made smaller, released, and a summary per sealed jar.
// Released promises are choices, never failures. No weekly charts, no speed.
import { db, getSettings } from '../db/db';
import type { DMPromise, Jar } from '../db/types';
import { orbsIn } from './jar';
import { dateRange, promisesOf } from './seal';

export async function allPromises(): Promise<DMPromise[]> {
  const s = await getSettings();
  return (await db.promises.toArray()).filter((p) => !!p.sandbox === s.sandbox);
}

export async function insightTotals() {
  const ps = await allPromises();
  return {
    kept: ps.filter((p) => p.status === 'kept'),
    smaller: ps.filter((p) => p.refinedFrom),
    released: ps.filter((p) => p.status === 'released'),
  };
}

export async function jarSummary(j: Jar): Promise<string> {
  const orbs = await orbsIn(j.id);
  const ps = (await promisesOf(orbs)).filter(Boolean) as DMPromise[];
  const smaller = ps.filter((p) => p.refinedFrom).length;
  const released = (await allPromises()).filter((p) => p.status === 'released' && p.releasedAt && p.releasedAt >= j.startedAt && (!j.sealedAt || p.releasedAt <= j.sealedAt)).length;
  return [`${orbs.length} kept`, smaller ? `${smaller} made smaller first` : '', released ? `${released} released` : ''].filter(Boolean).join(' · ') + ` · ${dateRange(orbs, j)}`;
}

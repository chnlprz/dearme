// The current jar and its orbs (real or Beta sandbox). Orbs keep their look forever; sealing comes in Phase 4.
import { currentJar, db, getSettings } from '../db/db';
import { newJar } from '../db/defaults';
import type { InsideId, Jar, Orb } from '../db/types';
import { nowISO, uid } from '../lib/util';
import { INSIDES, type OrbSpec } from '../jar/engine';

export const JAR_SIZE = 12;

/** The jar being filled right now; makes one if needed (sandbox jars stay separate). */
export async function activeJar(): Promise<Jar> {
  const s = await getSettings();
  let jar = await currentJar(s.sandbox);
  if (!jar) {
    const n = (await db.jars.filter((j) => !!j.sandbox === s.sandbox).count()) + 1;
    jar = newJar(n, s.style, s.sandbox);
    if (s.sandbox) jar.label = 'sandbox';
    await db.jars.put(jar);
  }
  return jar;
}

export async function orbsIn(jarId: string): Promise<Orb[]> {
  return (await db.orbs.where('jarId').equals(jarId).toArray()).sort((a, b) => a.keptAt.localeCompare(b.keptAt));
}

export const toSpec = (o: Orb): OrbSpec => ({ id: o.id, inside: o.inside, color: o.color, hue: o.hue, x: o.x, y: o.y, a: o.a });

/** Next colour for a new orb: walks the inside's palette so neighbours differ. */
async function nextColor(jarId: string, inside: InsideId): Promise<number> {
  const n = await db.orbs.where('jarId').equals(jarId).filter((o) => o.inside === inside).count();
  const size = INSIDES.find((i) => i.id === inside)?.colors ?? 6;
  return (n * 5 + 1) % size;
}

/** A new orb record in the current jar, using the inside picked right now (it keeps this look forever). */
export async function makeOrb(promiseId: string): Promise<Orb> {
  const s = await getSettings();
  const jar = await activeJar();
  const orb: Orb = {
    id: uid(), promiseId, jarId: jar.id, inside: s.inside, color: await nextColor(jar.id, s.inside),
    hue: +(Math.random() * 6).toFixed(2), keptAt: nowISO(), ...(s.sandbox ? { sandbox: true } : {}),
  };
  await db.orbs.put(orb);
  return orb;
}

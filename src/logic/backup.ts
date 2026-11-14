// Export: every promise, orb, jar and setting in one JSON file (your data, always yours).
import { db } from '../db/db';

export async function exportAll(): Promise<void> {
  const data = { app: 'dearme', version: 1, exportedAt: new Date().toISOString(),
    promises: await db.promises.toArray(), orbs: await db.orbs.toArray(), jars: await db.jars.toArray(), settings: await db.settings.toArray() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `dear-me-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

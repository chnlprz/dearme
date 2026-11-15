// Passkey sign-in and sync between your devices (Phase 9), same design as Nudge! and Noggin?. Offline first: the jar,
// promises, shelf and safety check never need it, and signing out keeps everything on this device. One Innova Space
// passkey signs you in; Dear Me's data is kept only in Dear Me's own tables.
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { db, getSettings } from '../db/db';
import type { Settings } from '../db/types';
import { DEVICE_ONLY, mergeSettings, normalizeJars } from '../logic/merge';

const KEY = 'dearme-cloud';
const SKIP = new Set(['meta']); // per-device bookkeeping stays on each device
interface State { signedIn: boolean; userId?: string; since: number; hashes?: Record<string, string>; lastSync?: string; error?: string }
type Row = { t: string; id: string; d: string | null; rev?: number };

export const cloud = {
  get(): State { try { return { since: 0, signedIn: false, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { since: 0, signedIn: false }; } },
  set(p: Partial<State>) { const s = { ...cloud.get(), ...p }; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage full: sync retries */ } return s; },
};

export async function call<T = any>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', headers: body === undefined ? {} : { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { cloud.set({ signedIn: false }); throw Object.assign(new Error('signed-out'), { code: 401 }); }
  if (!res.ok) throw Object.assign(new Error(data.error || 'server'), { code: res.status, detail: data.detail });
  return data as T;
}

/** A new Innova Space account, or (signed in) one more passkey on this device. */
export async function createPasskey(name: string): Promise<void> {
  const { cid, options } = await call('/auth/register/options', { name: name || 'Dear Me,' });
  const response = await startRegistration({ optionsJSON: options });
  const r = await call<{ userId: string }>('/auth/register/verify', { cid, response });
  if (!cloud.get().signedIn) cloud.set({ signedIn: true, userId: r.userId, since: 0, hashes: undefined, error: undefined });
}

/** Sign in with a passkey made in any Innova Space app. */
export async function signInWithPasskey(): Promise<void> {
  const { cid, options } = await call('/auth/login/options', {});
  const response = await startAuthentication({ optionsJSON: options });
  const r = await call<{ userId: string }>('/auth/login/verify', { cid, response });
  const before = cloud.get();
  cloud.set({ signedIn: true, userId: r.userId, ...(before.userId !== r.userId ? { since: 0, hashes: undefined } : {}), error: undefined });
}

export async function signOut(): Promise<void> {
  try { await call('/auth/logout', {}); } catch { /* offline: forget locally anyway */ }
  cloud.set({ signedIn: false });
}

/** Delete my account: removes the Innova Space account and everything synced, in every app. This device keeps its own copy. */
export async function deleteAccount(): Promise<void> {
  await call('/account/delete', { confirm: 'delete-my-account' });
  cloud.set({ signedIn: false });
}

export const passkeysWork = () => typeof window.PublicKeyCredential === 'function';
export const friendlyError = (e: unknown): string => {
  const n = (e as Error)?.name, m = (e as Error)?.message;
  if (n === 'NotAllowedError' || n === 'AbortError') return 'Cancelled. Nothing changed.';
  if (m === 'unknown-passkey') return 'That passkey isn’t linked to an Innova Space account yet. Create one instead. Nothing changed.';
  if (!navigator.onLine || m === 'Failed to fetch') return 'You’re offline. Your jar still works on this phone; try again when you’re back online.';
  return 'That didn’t work this time. Nothing on this phone changed. Try again in a moment.';
};

// ── Row sync: each row's fingerprint is remembered; only changed rows go up; last write wins per row ──
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + s.length.toString(36); };
const keyPath = (t: string) => db.table(t).schema.primKey.keyPath as string;
/** What goes up for a row: sandbox rows stay on this phone; settings go without this phone's own switches. */
function shareable(t: string, row: Record<string, unknown>): Record<string, unknown> | null {
  if (row.sandbox) return null;
  if (t === 'settings') { const s = { ...row }; for (const k of Object.keys(DEVICE_ONLY(row as unknown as Settings))) delete s[k]; return s; }
  return row;
}

async function localRows(): Promise<Map<string, { t: string; id: string; d: string }>> {
  const out = new Map<string, { t: string; id: string; d: string }>();
  for (const t of db.tables.map((x) => x.name)) {
    if (SKIP.has(t)) continue;
    const kp = keyPath(t);
    for (const row of await db.table(t).toArray()) {
      const r = shareable(t, row as Record<string, unknown>); if (!r) continue;
      const id = String(r[kp]); out.set(`${t}\u0001${id}`, { t, id, d: JSON.stringify(r) });
    }
  }
  return out;
}

let applying = false; // rows arriving from another device don't count as local changes
async function apply(rows: Row[], hashes: Record<string, string>, first: boolean): Promise<number> {
  let n = 0;
  applying = true;
  try {
    const known = new Set(db.tables.map((x) => x.name));
    const localSettings = await getSettings();
    await db.transaction('rw', db.tables.filter((x) => !SKIP.has(x.name)), async () => {
      for (const r of rows) {
        if (!known.has(r.t) || SKIP.has(r.t)) continue;
        const k = `${r.t}\u0001${r.id}`;
        if (r.d === null) { if (hashes[k] !== undefined) { await db.table(r.t).delete(r.id); delete hashes[k]; n++; } continue; }
        const h = hash(r.d); if (hashes[k] === h) continue;
        let row = JSON.parse(r.d);
        // settings: this phone keeps its own switches; on the first sign-in nothing this phone had is lost
        if (r.t === 'settings') row = first ? mergeSettings(localSettings, { ...localSettings, ...row }) : { ...localSettings, ...row, ...DEVICE_ONLY(localSettings) };
        await db.table(r.t).put(row); hashes[k] = h; n++;
      }
    });
  } finally { applying = false; }
  if (n && await normalizeJars()) n++;
  return n;
}

let running: Promise<number> | null = null;
/** Push what changed here, pull what changed elsewhere. Errors never block the app. */
export function syncNow(): Promise<number> {
  if (!cloud.get().signedIn || !navigator.onLine) return Promise.resolve(0);
  running ??= (async () => {
    try {
      const st = cloud.get();
      let hashes = st.hashes, since = st.since, changed = 0;
      if (!hashes) {
        // First sync on this phone: merge. The account's rows come in (same ids = the account's copy), then every
        // promise, orb and jar that only this phone had goes up. Two jars being filled are pooled, never dropped.
        hashes = {};
        const first = await call<{ rev: number; rows: Row[] }>('/sync', { since: 0, rows: [] });
        changed += await apply(first.rows, hashes, true);
        since = first.rev;
      }
      const local = await localRows();
      const up: Row[] = [];
      for (const [k, r] of local) { const h = hash(r.d); if (hashes[k] !== h) { up.push(r); hashes[k] = h; } }
      for (const k of Object.keys(hashes)) if (!local.has(k)) { const [t, id] = k.split('\u0001'); up.push({ t, id, d: null }); delete hashes[k]; }
      const res = await call<{ rev: number; rows: Row[] }>('/sync', { since, rows: up });
      changed += await apply(res.rows, hashes, false);
      cloud.set({ hashes, since: Math.max(res.rev, ...res.rows.map((r) => r.rev ?? 0)), lastSync: new Date().toISOString(), error: undefined });
      if (changed) window.dispatchEvent(new CustomEvent('dearme:synced', { detail: changed }));
      return changed;
    } catch (e) {
      if ((e as { code?: number }).code !== 401) cloud.set({ error: friendlyError(e) });
      return 0;
    } finally { running = null; }
  })();
  return running;
}

/** A change here goes up about 2 seconds later; while open it checks every 20 s, and on return and when back online. */
export function startAutoSync(onChanged: () => void): void {
  window.addEventListener('dearme:synced', onChanged);
  const go = () => void syncNow();
  let soon = 0;
  const later = () => { if (applying || !cloud.get().signedIn) return; clearTimeout(soon); soon = window.setTimeout(go, 1500); };
  for (const t of db.tables) {
    if (SKIP.has(t.name)) continue;
    t.hook('creating', later); t.hook('updating', later); t.hook('deleting', later);
  }
  go();
  setInterval(() => { if (document.visibilityState === 'visible') go(); }, 20e3);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') go(); });
  window.addEventListener('online', go);
}

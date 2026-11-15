// Dear Me, server (Phase 9): passkey sign-in on the shared Innova Space accounts, sync of Dear Me's own rows,
// and evening reminders by Web Push. Phase 10 adds Gentle Help through the Claude API (secret ANTHROPIC_API_KEY).
// Accounts (users, credentials, sessions, challenges) are the same tables Nudge! and Noggin? use in D1 `nudge`, so one
// passkey (RP ID innovaspace.app) works in every app. Dear Me's data lives only in its own dm_* tables: nothing is
// read from or shared with the other apps.
import {
  generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse,
} from '@simplewebauthn/server';

interface Env {
  ASSETS: Fetcher;
  DB: D1Database; // the shared `nudge` database
  RP_ID: string;
  ANTHROPIC_API_KEY?: string; // secret: Gentle Help (Phase 10)
}

const COOKIE = 'dearme_s';
const YEAR = 365 * 864e5;
const b64u = {
  enc: (b: Uint8Array) => { let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec: (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0)),
};
const rid = () => b64u.enc(crypto.getRandomValues(new Uint8Array(18)));
const json = (data: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(data), { ...init, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...(init.headers ?? {}) } });
const oops = (status: number, error: string) => json({ error }, { status });

let ready: Promise<unknown> | null = null;
function schema(db: D1Database) {
  ready ??= db.batch([
    // Shared account tables: same definitions as Nudge! (IF NOT EXISTS, so nothing changes when they're there).
    db.prepare('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, created_at INTEGER, rev INTEGER DEFAULT 0)'),
    db.prepare('CREATE TABLE IF NOT EXISTS credentials (id TEXT PRIMARY KEY, user_id TEXT, public_key TEXT, counter INTEGER, transports TEXT, created_at INTEGER)'),
    db.prepare('CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT, expires_at INTEGER)'),
    db.prepare('CREATE TABLE IF NOT EXISTS challenges (id TEXT PRIMARY KEY, challenge TEXT, user_id TEXT, expires_at INTEGER)'),
    // Dear Me's own tables
    db.prepare('CREATE TABLE IF NOT EXISTS dm_rev (user_id TEXT PRIMARY KEY, rev INTEGER DEFAULT 0)'),
    db.prepare('CREATE TABLE IF NOT EXISTS dm_rows (user_id TEXT, tbl TEXT, id TEXT, data TEXT, rev INTEGER, PRIMARY KEY (user_id, tbl, id))'),
    db.prepare('CREATE INDEX IF NOT EXISTS dm_rows_rev ON dm_rows (user_id, rev)'),
    db.prepare('CREATE TABLE IF NOT EXISTS dm_push (endpoint TEXT PRIMARY KEY, p256dh TEXT, auth TEXT, tz TEXT, time TEXT, last_day TEXT, created_at INTEGER)'),
    db.prepare('CREATE TABLE IF NOT EXISTS dm_meta (k TEXT PRIMARY KEY, v TEXT)'),
    // Gentle Help use per person per UTC day (a count only: what you write is never stored)
    db.prepare('CREATE TABLE IF NOT EXISTS dm_ai_use (user_id TEXT NOT NULL, day TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, day))'),
  ]).catch((e) => { ready = null; throw e; });
  return ready;
}

async function userOf(req: Request, env: Env): Promise<string | null> {
  const m = (req.headers.get('cookie') ?? '').match(new RegExp(`${COOKIE}=([^;]+)`));
  if (!m) return null;
  const row = await env.DB.prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?').bind(m[1]).first<{ user_id: string; expires_at: number }>();
  return row && row.expires_at > Date.now() ? row.user_id : null;
}
async function startSession(env: Env, userId: string) {
  const token = rid() + rid();
  await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').bind(token, userId, Date.now() + YEAR).run();
  return `${COOKIE}=${token}; Path=/; Max-Age=${YEAR / 1000}; HttpOnly; Secure; SameSite=Lax`;
}
async function takeChallenge(env: Env, id: string) {
  const c = await env.DB.prepare('SELECT challenge, user_id, expires_at FROM challenges WHERE id = ?').bind(id).first<{ challenge: string; user_id: string | null; expires_at: number }>();
  await env.DB.prepare('DELETE FROM challenges WHERE id = ? OR expires_at < ?').bind(id, Date.now()).run();
  return c && c.expires_at > Date.now() ? c : null;
}

/* ───────────── Web Push (VAPID + aes128gcm, RFC 8291/8292), keys made once and kept in dm_meta ───────────── */
interface Vapid { pub: string; jwk: JsonWebKey }
let vapid: Promise<Vapid> | null = null;
function vapidKeys(env: Env): Promise<Vapid> {
  vapid ??= (async () => {
    const row = await env.DB.prepare("SELECT v FROM dm_meta WHERE k = 'vapid'").first<{ v: string }>();
    if (row) return JSON.parse(row.v) as Vapid;
    const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
    const v: Vapid = { pub: b64u.enc(new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey) as ArrayBuffer)), jwk: await crypto.subtle.exportKey('jwk', kp.privateKey) as JsonWebKey };
    await env.DB.prepare("INSERT OR IGNORE INTO dm_meta (k, v) VALUES ('vapid', ?)").bind(JSON.stringify(v)).run();
    const again = await env.DB.prepare("SELECT v FROM dm_meta WHERE k = 'vapid'").first<{ v: string }>(); // another request may have won
    return again ? JSON.parse(again.v) as Vapid : v;
  })().catch((e) => { vapid = null; throw e; });
  return vapid;
}
const enc = new TextEncoder();
const cat = (...a: Uint8Array[]) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, bytes * 8));
}
async function vapidHeader(env: Env, endpoint: string) {
  const v = await vapidKeys(env);
  const key = await crypto.subtle.importKey('jwk', v.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = b64u.enc(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u.enc(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'mailto:hello.innovaspace@gmail.com' })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${body}`)));
  return `vapid t=${head}.${body}.${b64u.enc(sig)}, k=${v.pub}`;
}
async function encrypt(payload: string, p256dh: string, auth: string): Promise<Uint8Array> {
  const ua = b64u.dec(p256dh), secret = b64u.dec(auth);
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey) as ArrayBuffer);
  const uaKey = await crypto.subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey } as SubtleCryptoDeriveKeyAlgorithm, as.privateKey, 256));
  const ikm = await hkdf(secret, shared, cat(enc.encode('WebPush: info\0'), ua, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, k, cat(enc.encode(payload), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // record size 4096
  return cat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}
/** Sends one notification. Returns the push service status (404/410 = subscription gone). */
async function push(env: Env, sub: { endpoint: string; p256dh: string; auth: string }, msg: { title: string; body: string }): Promise<number> {
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: { Authorization: await vapidHeader(env, sub.endpoint), TTL: '3600', Urgency: 'normal', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream' },
    body: await encrypt(JSON.stringify(msg), sub.p256dh, sub.auth),
  });
  if (res.status === 404 || res.status === 410) await env.DB.prepare('DELETE FROM dm_push WHERE endpoint = ?').bind(sub.endpoint).run();
  return res.status;
}
const EVENING = { title: 'Dear Me,', body: 'Your promises are here.' };

/** Every 5 minutes: whoever's evening time just arrived (in their own time zone) gets one gentle line, once a day. */
async function reminders(env: Env): Promise<void> {
  await schema(env.DB);
  const subs = (await env.DB.prepare('SELECT endpoint, p256dh, auth, tz, time, last_day FROM dm_push').all<{ endpoint: string; p256dh: string; auth: string; tz: string; time: string; last_day: string | null }>()).results;
  const now = new Date();
  for (const s of subs) {
    let day = '', mins = 0;
    try {
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: s.tz || 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map((p) => [p.type, p.value]));
      day = `${parts.year}-${parts.month}-${parts.day}`; mins = Number(parts.hour) * 60 + Number(parts.minute);
    } catch { continue; }
    const [h, m] = (s.time || '21:00').split(':').map(Number), target = h * 60 + m;
    if (s.last_day === day || mins < target || mins - target >= 20) continue;
    await env.DB.prepare('UPDATE dm_push SET last_day = ? WHERE endpoint = ?').bind(day, s.endpoint).run();
    await push(env, s, EVENING).catch(() => 0);
  }
}

/* ───────────── Gentle Help (Bible › AI: the friction detective) ───────────── */
const HELP_MODEL = 'claude-haiku-5-5';
const HELP_DAILY = 40;
const HELP_SYSTEM = `You are Gentle Help inside "Dear Me,", a self-trust app. People make small promises to themselves; every promise they keep becomes a glowing orb in a jar. You are a friction detective: you help the person understand what makes a promise hard, then offer smaller versions they could keep today. Suggestions are only options; the person stays in charge and the win is theirs.

How you talk:
- Warm, plain and short. Mirror the person's language: English, Tagalog or Taglish.
- Never guilt, pressure or urgency. Never use: overdue, late, streak, should, must, fail, lazy, discipline.
- Never diagnose. Barriers are possibilities only: friction, motivation, ability, prompt (forgetting), fear.
- No medical, diet, weight or exercise numbers. No emojis.

What you suggest:
- 2 or 3 smaller versions of the promise, each doable today in about 10 minutes or less, first person, starting with a verb, at most 9 words, specific, gentle. Keep the person's own topic and words where you can.
- "I won't ..." promises: turn them into an action or a time box (for example "I won't message them this weekend").
- Abstract promises like "Do not give up": ask one gentle question first in "ask", and still offer concrete first steps.
- If fear may be the block, you may ask: "Kung sigurado kang hindi ka papalpak, gagawin mo ba 'to ngayon?" Fear gets less exposure (draft without sending, tell one safe person); practical friction gets less effort (attach it to a routine, a 5-minute timer, set things out the night before).
- Respond to what is in the way when it is given.

Safety comes first: if anything suggests self-harm, suicide or not wanting to live, set "safety" to "crisis"; if someone is hurting them, set "abuse". In both cases "say" is one caring line, "ask" is empty and "options" is empty.

Reply with JSON only, no other text:
{"say": "one short warm line, max 18 words", "ask": "one gentle question, or empty", "options": ["...", "..."], "safety": "none" | "crisis" | "abuse"}`;

async function gentleHelp(env: Env, uid: string, body: any): Promise<Response> {
  if (!env.ANTHROPIC_API_KEY) return oops(503, 'help-off');
  const day = new Date().toISOString().slice(0, 10);
  const used = (await env.DB.prepare('SELECT n FROM dm_ai_use WHERE user_id = ? AND day = ?').bind(uid, day).first<{ n: number }>())?.n ?? 0;
  if (used >= HELP_DAILY) return oops(429, 'rest');
  const clip = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  const text = clip(body.text, 200);
  if (!text) return oops(400, 'empty');
  const lines = [`Promise: "${text}"`];
  if (body.block) lines.push(`What's in the way: ${clip(body.block, 60)}`);
  if (Array.isArray(body.hard) && body.hard.length) lines.push(`What they said feels hard lately: ${body.hard.slice(0, 6).map((x: unknown) => clip(x, 40)).join(', ')}`);
  if (body.ask && body.answer) lines.push(`You asked: "${clip(body.ask, 200)}"`, `They answered: "${clip(body.answer, 300)}"`);
  lines.push(body.mode === 'first' ? 'This is their very first promise in the app.' : body.mode === 'stuck' ? 'This promise has felt heavy lately.' : 'They asked for help making it smaller.');
  await env.DB.prepare('INSERT INTO dm_ai_use (user_id, day, n) VALUES (?, ?, 1) ON CONFLICT (user_id, day) DO UPDATE SET n = n + 1').bind(uid, day).run();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: HELP_MODEL, max_tokens: 400, system: HELP_SYSTEM, messages: [{ role: 'user', content: lines.join('\n') }] }),
  });
  if (!res.ok) return oops(502, 'help-failed');
  const data = await res.json<{ content?: { type: string; text?: string }[] }>();
  const raw = (data.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  let out: { say?: unknown; ask?: unknown; options?: unknown; safety?: unknown } = {};
  try { out = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)); } catch { return oops(502, 'help-failed'); }
  const safety = out.safety === 'crisis' || out.safety === 'abuse' ? out.safety : 'none';
  const options = safety !== 'none' || !Array.isArray(out.options) ? [] : out.options.map((o) => clip(o, 120)).filter(Boolean).slice(0, 3);
  return json({ say: clip(out.say, 200), ask: safety === 'none' ? clip(out.ask, 200) : '', options, safety });
}

async function api(req: Request, env: Env, url: URL): Promise<Response> {
  await schema(env.DB);
  const path = url.pathname.slice(4);
  const h = url.hostname, onHome = h === env.RP_ID || h.endsWith(`.${env.RP_ID}`);
  const rpID = onHome ? env.RP_ID : h, origin = url.origin;
  const body = req.method === 'POST' ? await req.json<any>().catch(() => ({})) : {};
  const uid = await userOf(req, env);

  if (path === '/health') return json({ ok: true, app: 'dearme', phase: 9 });

  // ── Passkeys (one account across Innova Space; Dear Me's data stays its own) ──
  if (path === '/auth/register/options') {
    const userId = uid ?? rid();
    const existing = uid ? (await env.DB.prepare('SELECT id, transports FROM credentials WHERE user_id = ?').bind(uid).all<{ id: string; transports: string }>()).results : [];
    const nm = String(body.name || 'Innova Space').slice(0, 60);
    const options = await generateRegistrationOptions({
      rpName: 'Innova Space', rpID, userName: nm, userDisplayName: nm,
      userID: new TextEncoder().encode(userId) as Uint8Array<ArrayBuffer>, attestationType: 'none',
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
      excludeCredentials: existing.map((c) => ({ id: c.id, transports: JSON.parse(c.transports || '[]') })),
    });
    const cid = rid();
    await env.DB.prepare('INSERT INTO challenges (id, challenge, user_id, expires_at) VALUES (?, ?, ?, ?)').bind(cid, options.challenge, userId, Date.now() + 5 * 60e3).run();
    return json({ cid, options });
  }
  if (path === '/auth/register/verify') {
    const c = await takeChallenge(env, body.cid);
    if (!c?.user_id) return oops(400, 'expired');
    const v = await verifyRegistrationResponse({ response: body.response, expectedChallenge: c.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: false }).catch(() => null);
    if (!v?.verified || !v.registrationInfo) return oops(400, 'not-verified');
    const cr = v.registrationInfo.credential;
    await env.DB.batch([
      env.DB.prepare('INSERT OR IGNORE INTO users (id, created_at, rev) VALUES (?, ?, 0)').bind(c.user_id, Date.now()),
      env.DB.prepare('INSERT INTO credentials (id, user_id, public_key, counter, transports, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(cr.id, c.user_id, b64u.enc(cr.publicKey), cr.counter, JSON.stringify(cr.transports ?? []), Date.now()),
    ]);
    return json({ ok: true, userId: c.user_id }, { headers: { 'set-cookie': await startSession(env, c.user_id) } });
  }
  if (path === '/auth/login/options') {
    const options = await generateAuthenticationOptions({ rpID, userVerification: 'preferred' });
    const cid = rid();
    await env.DB.prepare('INSERT INTO challenges (id, challenge, user_id, expires_at) VALUES (?, ?, NULL, ?)').bind(cid, options.challenge, Date.now() + 5 * 60e3).run();
    return json({ cid, options });
  }
  if (path === '/auth/login/verify') {
    const c = await takeChallenge(env, body.cid);
    if (!c) return oops(400, 'expired');
    const cred = await env.DB.prepare('SELECT * FROM credentials WHERE id = ?').bind(body.response?.id ?? '').first<{ id: string; user_id: string; public_key: string; counter: number; transports: string }>();
    if (!cred) return oops(404, 'unknown-passkey');
    const v = await verifyAuthenticationResponse({
      response: body.response, expectedChallenge: c.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: false,
      credential: { id: cred.id, publicKey: b64u.dec(cred.public_key) as Uint8Array<ArrayBuffer>, counter: cred.counter, transports: JSON.parse(cred.transports || '[]') },
    }).catch(() => null);
    if (!v?.verified) return oops(400, 'not-verified');
    await env.DB.prepare('UPDATE credentials SET counter = ? WHERE id = ?').bind(v.authenticationInfo.newCounter, cred.id).run();
    return json({ ok: true, userId: cred.user_id }, { headers: { 'set-cookie': await startSession(env, cred.user_id) } });
  }
  if (path === '/auth/logout') {
    const m = (req.headers.get('cookie') ?? '').match(new RegExp(`${COOKIE}=([^;]+)`));
    if (m) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(m[1]).run();
    return json({ ok: true }, { headers: { 'set-cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` } });
  }
  if (path === '/me') return json({ signedIn: !!uid, userId: uid });

  // ── Evening reminders (no account needed: a subscription is just this phone and a time) ──
  if (path === '/push/key') return json({ key: (await vapidKeys(env)).pub });
  if (path === '/push/set') {
    const sub = body.sub ?? {}, endpoint = String(sub.endpoint ?? ''), p256dh = String(sub.keys?.p256dh ?? ''), auth = String(sub.keys?.auth ?? '');
    if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) return oops(400, 'bad-subscription');
    const time = /^\d{2}:\d{2}$/.test(String(body.time)) ? String(body.time) : '21:00', tz = String(body.tz || 'Asia/Manila').slice(0, 60);
    await env.DB.prepare('INSERT INTO dm_push (endpoint, p256dh, auth, tz, time, last_day, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?) ON CONFLICT (endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, tz = excluded.tz, time = excluded.time')
      .bind(endpoint.slice(0, 1000), p256dh, auth, tz, time, Date.now()).run();
    return json({ ok: true });
  }
  if (path === '/push/off') {
    await env.DB.prepare('DELETE FROM dm_push WHERE endpoint = ?').bind(String(body.endpoint ?? '')).run();
    return json({ ok: true });
  }
  if (path === '/push/test') { // Beta: send the evening line now to this phone
    const s = await env.DB.prepare('SELECT endpoint, p256dh, auth FROM dm_push WHERE endpoint = ?').bind(String(body.endpoint ?? '')).first<{ endpoint: string; p256dh: string; auth: string }>();
    if (!s) return oops(404, 'no-subscription');
    return json({ status: await push(env, s, EVENING) });
  }

  if (!uid) return oops(401, 'signed-out');

  // ── Gentle Help: needs sign-in and internet; called only when the person asks ──
  if (path === '/help') return gentleHelp(env, uid, body);

  // ── Sync: push changed rows, then pull everything newer than `since` (same protocol as Nudge! and Noggin?) ──
  if (path === '/sync') {
    const rows: { t: string; id: string; d: string | null }[] = Array.isArray(body.rows) ? body.rows.slice(0, 5000) : [];
    await env.DB.prepare('INSERT OR IGNORE INTO dm_rev (user_id, rev) VALUES (?, 0)').bind(uid).run();
    let rev = (await env.DB.prepare('SELECT rev FROM dm_rev WHERE user_id = ?').bind(uid).first<{ rev: number }>())?.rev ?? 0;
    if (rows.length) {
      rev = (await env.DB.prepare('UPDATE dm_rev SET rev = rev + 1 WHERE user_id = ? RETURNING rev').bind(uid).first<{ rev: number }>())!.rev;
      const stmt = env.DB.prepare('INSERT INTO dm_rows (user_id, tbl, id, data, rev) VALUES (?, ?, ?, ?, ?) ON CONFLICT (user_id, tbl, id) DO UPDATE SET data = excluded.data, rev = excluded.rev');
      for (let i = 0; i < rows.length; i += 50) await env.DB.batch(rows.slice(i, i + 50).map((r) => stmt.bind(uid, String(r.t).slice(0, 40), String(r.id).slice(0, 80), r.d, rev)));
    }
    const since = Number(body.since) || 0;
    const out = (await env.DB.prepare('SELECT tbl AS t, id, data AS d, rev FROM dm_rows WHERE user_id = ? AND rev > ? ORDER BY rev LIMIT 20000').bind(uid, since).all()).results;
    return json({ rev, rows: out });
  }
  return oops(404, 'not_found');
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      try { return await api(req, env, url); } catch (e) { return oops(500, (e as Error).message || 'server'); }
    }
    return env.ASSETS.fetch(req);
  },
  async scheduled(_c: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(reminders(env));
  },
} satisfies ExportedHandler<Env>;

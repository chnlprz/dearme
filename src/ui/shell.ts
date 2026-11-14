// Dear Me, shell (Phase 1): Jar · Shelf · Settings in the bottom bar. Header = date, then "Dear Me," (or "Dear <name>,").
import { db, getSettings, updateSettings } from '../db/db';
import { esc } from '../lib/util';
import { activeJar, JAR_SIZE, makeOrb, orbsIn } from '../logic/jar';
import { INSIDES, JAR_STYLES, unmountJar } from '../jar/engine';
import { safetySheet } from './safety';
import { cloud, createPasskey, friendlyError, passkeysWork, signInWithPasskey, signOut, syncNow } from '../lib/cloud';
import { clearReminder, needsInstall, setReminder, testReminder } from '../lib/push';
import { openSheet } from './sheet';
import { dropTestOrb, homeView, startHome } from './home';
import { jarDetailView, shelfView, startJarDetail, startShelf } from './shelf';
import { customizeView, startCustomize } from './customize';
import { insightsView, startInsights } from './insights';
import { exportAll } from '../logic/backup';
import { showLevelUp } from './levelup';
import { startOnboarding } from './onboarding';
import { levelInfo, newUnlocks, unlocksAt } from '../logic/unlocks';
import { LEVEL_AT } from '../logic/levels';
import type { InsideId, JarStyleId } from '../db/types';
import { icon, svg, toast } from './kit';
import { showParticles } from './particles';

export const VERSION = '0.9.0';
type Tab = 'jar' | 'shelf' | 'settings';
let root: HTMLElement;
let tab: Tab = 'jar';
let openJar: string | null = null;
let sub: 'customize' | 'insights' | null = null;

export function startShell(el: HTMLElement): void {
  (window as { __dmShell?: boolean }).__dmShell = true;
  root = el;
  root.addEventListener('dearme:rerender', () => void render());
  root.addEventListener('dearme:customize', () => { tab = 'settings'; sub = 'customize'; void render(); window.scrollTo(0, 0); });
  try { const t = localStorage.getItem('dearme-tab'); if (t === 'jar' || t === 'shelf' || t === 'settings') tab = t; } catch { /* default */ }
  void render();
}

export async function render(): Promise<void> {
  const view = tab === 'jar' ? await homeView()
    : tab === 'shelf' ? (openJar ? await jarDetailView(openJar) : await shelfView()) : sub === 'customize' ? await customizeView() : sub === 'insights' ? await insightsView() : await settingsView();
  unmountJar();
  root.innerHTML = `<div class="shell"><main class="view" id="main">${view}</main>${tabbar()}</div>`;
  showParticles(tab !== 'settings');
  wire();
  if (tab === 'jar') await startHome(root);
  if (tab === 'shelf' && !openJar) await startShelf(root, (id) => { openJar = id; void render(); window.scrollTo(0, 0); });
  if (tab === 'shelf' && openJar) await startJarDetail(root, openJar, () => { openJar = null; void render(); }, () => void render());
  if (tab === 'settings' && sub === 'customize') await startCustomize(root, () => { sub = null; void render(); }, () => void render());
  if (tab === 'settings' && sub === 'insights') await startInsights(root, () => { sub = null; void render(); }, () => void render());
}

function tabbar(): string {
  const b = (id: Tab, label: string, ic: string) =>
    `<button data-tab="${id}" ${tab === id ? 'aria-current="page"' : ''}>${svg(ic)}<span>${label}</span></button>`;
  return `<nav class="tabbar" aria-label="Main"><div class="in">${b('jar', 'Jar', icon.jar)}${b('shelf', 'Shelf', icon.shelf)}${b('settings', 'Settings', icon.menu)}</div></nav>`;
}

async function settingsView(): Promise<string> {
  const s = await getSettings();
  const sw = (key: string, on: boolean, label: string) => `<button class="switch" role="switch" aria-checked="${on}" aria-label="${label}" data-switch="${key}"></button>`;
  const row = (t: string, d: string, right: string) => `<div class="row"><span><span class="t">${t}</span><span class="d">${d}</span></span>${right}</div>`;
  const li = await levelInfo();
  const fresh = (await newUnlocks()).length;
  const nextU = li.next == null ? null : unlocksAt(li.level + 1);
  const nextTxt = nextU ? [nextU.slots ? `${nextU.slots} slots` : '', nextU.jar ? `${nextU.jar.name} jar` : '', nextU.inside?.name ?? ''].filter(Boolean).join(', ') : '';
  const insideName = INSIDES.find((i) => i.id === s.inside)!.name, jarName = JAR_STYLES.find((j) => j.id === s.style)!.name;
  return `<h1 class="serif title">Settings</h1>
<div class="groups">
  <div class="profile card"><span class="avatar" aria-hidden="true">${esc((s.name || 'Me').slice(0, 1).toUpperCase())}</span>
    <span class="pinfo"><span class="pname">${esc(s.name || 'Dear Me,')}</span><span class="muted">Level ${li.level} · ${li.kept} ${li.kept === 1 ? 'promise' : 'promises'} kept${s.sandbox ? ' (sandbox)' : ''}</span>
    ${li.next != null ? `<span class="pbar" aria-hidden="true"><i style="width:${Math.round(((li.kept - LEVEL_AT[li.level - 1]) / (li.next - LEVEL_AT[li.level - 1])) * 100)}%"></i></span><span class="pnext">${li.toNext} more to Level ${li.level + 1} · ${esc(nextTxt)}</span>` : '<span class="pnext">Every look is open.</span>'}</span></div>
  <div class="group"><span class="label">Your jar</span><div class="rows">
    <button class="row" data-go="customize"><span><span class="t">Jar and what\u2019s inside</span><span class="d">${jarName} · ${insideName}</span></span>
      <span class="row-r">${fresh ? `<span class="badge-new">${fresh} NEW</span>` : ''}${svg(icon.chev, 18)}</span></button>
    <button class="row" data-go="insights"><span><span class="t">Insights</span><span class="d">Kept, made smaller and released · jar summaries</span></span>${svg(icon.chev, 18)}</button>
    ${row('Sounds', 'Soft glass clinks when orbs touch', sw('sound', s.sound, 'Sounds'))}
    ${row('Move with my phone', 'Tilt or shake your phone and the orbs roll', sw('motion', s.motion, 'Move with my phone'))}
  </div></div>
  <div class="group"><span class="label">Greeting</span><div class="rows">
    ${row('Use my name', s.name ? `Shows "Dear ${esc(s.name)}," instead of "Dear Me,"` : 'Add your name below first', sw('useName', s.useName, 'Use my name'))}
    <label class="row" for="nm"><span class="t">Name</span><input id="nm" value="${esc(s.name)}" maxlength="24" placeholder="Your name" autocomplete="given-name"
      style="background:none;border:0;text-align:right;color:var(--ink);font-size:15px;width:55%"></label>
  </div></div>
  <div class="group"><span class="label">Gentle Help</span><div class="rows">
    ${row('Suggest smaller steps', 'Only when you ask. Nothing is added unless you accept it. (Coming soon)', sw('gentleHelp', s.gentleHelp, 'Suggest smaller steps'))}
    ${row('Gentle check-ins', 'When a promise feels heavy, one soft question', sw('checkins', s.checkins, 'Gentle check-ins'))}
  </div></div>
  <div class="group"><span class="label">Reminders</span><div class="rows">
    ${row('Evening reminder', needsInstall() ? '\u201cYour promises are here.\u201d On iPhone, add Dear Me to your Home Screen first.' : '\u201cYour promises are here.\u201d One gentle line, once a day.', sw('reminderOn', !!s.reminder, 'Evening reminder'))}
    ${s.reminder ? `<label class="row" for="rt"><span class="t">Time</span><input id="rt" type="time" value="${s.reminder}" class="pick" style="color:var(--ink)"></label>
    ${!needsInstall() && 'Notification' in window && Notification.permission !== 'granted' ? '<button class="row" data-act="allow-push"><span><span class="t">Allow notifications</span><span class="d">So the evening line can reach you</span></span>' + svg(icon.chev, 18) + '</button>' : ''}` : ''}
  </div></div>
  <div class="group"><span class="label">Support</span><div class="rows">
    <button class="row" data-act="help"><span><span class="t">Need someone to talk to?</span><span class="d">Free, private help lines · works offline</span></span>${svg(icon.chev, 18)}</button>
  </div></div>
  <div class="group"><span class="label">Account</span><div class="rows">
    ${accountRows()}
    <button class="row" data-act="export"><span><span class="t">Export my jars</span><span class="d">A file with every promise, orb and jar</span></span>${svg(icon.chev, 18)}</button>
  </div></div>
  ${s.beta ? `<div class="group"><span class="label">Beta test mode</span><div class="rows">
    ${row('Sandbox jar', 'A separate test jar. Your real promises stay safe.', sw('sandbox', s.sandbox, 'Sandbox jar'))}
    ${row('Unlock everything', 'All jars and insides, any level', sw('unlockAll', s.unlockAll, 'Unlock everything'))}
    <label class="row" for="b-style"><span class="t">Jar</span><select id="b-style" class="pick">${JAR_STYLES.map((j) => `<option value="${j.id}" ${j.id === s.style ? 'selected' : ''}>${j.name} · Level ${j.level}</option>`).join('')}</select></label>
    <label class="row" for="b-inside"><span class="t">What's inside (next orbs)</span><select id="b-inside" class="pick">${INSIDES.map((i) => `<option value="${i.id}" ${i.id === s.inside ? 'selected' : ''}>${i.name} · Level ${i.level}</option>`).join('')}</select></label>
    <button class="row" data-beta="checkin"><span class="t">Show a gentle check-in now</span>${svg(icon.chev, 18)}</button>
    <button class="row" data-beta="push"><span class="t">Send the evening reminder now</span>${svg(icon.chev, 18)}</button>
    <button class="row" data-beta="safety"><span class="t">Show the safety sheet</span>${svg(icon.chev, 18)}</button>
    <button class="row" data-beta="clear"><span><span class="t">Clear the sandbox</span><span class="d">Removes every sandbox promise, orb and jar</span></span>${svg(icon.chev, 18)}</button>
    <button class="row" data-beta="onb"><span class="t">Replay onboarding</span>${svg(icon.chev, 18)}</button>
    <button class="row" data-beta="lvl"><span class="t">Show a level-up card (Level 4)</span>${svg(icon.chev, 18)}</button>
    <button class="row" data-beta="drop"><span class="t">Drop a test orb</span>${svg(icon.chev, 18)}</button>
    <button class="row" data-beta="fill"><span class="t">Fill to 11</span>${svg(icon.chev, 18)}</button>
    <button class="row" data-beta="empty"><span><span class="t">Empty the ${s.sandbox ? 'sandbox' : 'current'} jar</span><span class="d">${s.sandbox ? 'Only test orbs' : 'Removes only test orbs from your real jar'}</span></span>${svg(icon.chev, 18)}</button>
    ${row('Beta test mode', 'Turn off to hide this section', sw('beta', true, 'Beta test mode'))}
  </div></div>` : ''}
  <div class="group"><span class="label">About</span><div class="rows">
    <a class="row" href="mailto:feedback@innovaspace.app?subject=Dear%20Me%20feedback"><span><span class="t">Send feedback</span><span class="d">feedback@innovaspace.app</span></span>${svg(icon.chev, 18)}</a>
    <button class="row" data-act="version"><span><span class="t">Dear Me, by Innova Space</span><span class="d">Version ${VERSION}</span></span></button>
  </div></div>
  <p class="copyright">© 2026 Innova Space</p>
</div>`;
}

let taps = 0, tapTimer = 0;
function wire(): void {
  root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab as Tab; openJar = null; sub = null;
    try { localStorage.setItem('dearme-tab', tab); } catch { /* not remembered */ }
    void render(); window.scrollTo(0, 0);
  }));
  root.querySelectorAll<HTMLButtonElement>('[data-switch]').forEach((b) => b.addEventListener('click', async () => {
    const key = b.dataset.switch as 'useName' | 'beta' | 'sandbox' | 'unlockAll' | 'gentleHelp' | 'checkins' | 'reminderOn' | 'sound' | 'motion';
    const s = await getSettings();
    if (key === 'useName' && !s.name) { toast('Add your name first.'); return; }
    if (key === 'reminderOn') {
      if (s.reminder) { await updateSettings({ reminder: null }); void clearReminder(); void render(); return; }
      await updateSettings({ reminder: '21:00' }); void render();
      const why = await setReminder('21:00'); if (why) toast(why); else toast('Every evening at 9:00 PM.');
      return;
    }
    await updateSettings({ [key]: !s[key] } as never);
    void render();
  }));
  root.querySelector('[data-go="customize"]')?.addEventListener('click', () => { sub = 'customize'; void render(); window.scrollTo(0, 0); });
  root.querySelector('[data-go="insights"]')?.addEventListener('click', () => { sub = 'insights'; void render(); window.scrollTo(0, 0); });
  root.querySelector<HTMLInputElement>('#rt')?.addEventListener('change', async (e) => { const v = (e.target as HTMLInputElement).value; if (v) { await updateSettings({ reminder: v }); const why = await setReminder(v); if (why) toast(why); } });
  root.querySelector('[data-act="export"]')?.addEventListener('click', () => void exportAll());
  root.querySelector('[data-act="allow-push"]')?.addEventListener('click', async () => { const s = await getSettings(); const why = await setReminder(s.reminder || '21:00'); toast(why ?? 'Reminders are on.'); void render(); });
  root.querySelector('[data-act="help"]')?.addEventListener('click', () => void safetySheet('help'));
  root.querySelectorAll<HTMLButtonElement>('[data-acct]').forEach((b) => b.addEventListener('click', () => void account(b.dataset.acct!)));
  root.querySelector<HTMLInputElement>('#nm')?.addEventListener('change', async (e) => {
    const name = (e.target as HTMLInputElement).value.trim().slice(0, 24);
    await updateSettings({ name, ...(name ? {} : { useName: false }) });
    void render();
  });
  root.querySelector('[data-act="version"]')?.addEventListener('click', async () => {
    taps++; clearTimeout(tapTimer); tapTimer = window.setTimeout(() => (taps = 0), 1500);
    if (taps >= 7) {
      taps = 0;
      const s = await getSettings();
      if (!s.beta) { await updateSettings({ beta: true }); toast('Beta test mode is on.'); void render(); }
    }
  });
  root.querySelector<HTMLSelectElement>('#b-style')?.addEventListener('change', async (e) => {
    const style = (e.target as HTMLSelectElement).value as JarStyleId;
    await updateSettings({ style }); const jar = await activeJar(); await db.jars.put({ ...jar, style }); toast('The glass changes right away.');
  });
  root.querySelector<HTMLSelectElement>('#b-inside')?.addEventListener('change', async (e) => {
    await updateSettings({ inside: (e.target as HTMLSelectElement).value as InsideId }); toast('New orbs start with your next promise.');
  });
  root.querySelectorAll<HTMLButtonElement>('[data-beta]').forEach((b) => b.addEventListener('click', async () => {
    const act = b.dataset.beta, jar = await activeJar();
    if (act === 'checkin') { const s = await getSettings(); if (!(await db.promises.filter((p) => p.status === 'active' && !!p.sandbox === s.sandbox).count())) { toast('Make a promise first.'); return; } localStorage.setItem('dearme-force-checkin', '1'); tab = 'jar'; void render(); return; }
    if (act === 'safety') { void safetySheet('crisis'); return; }
    if (act === 'push') { toast(await testReminder()); return; }
    if (act === 'clear') {
      const sj = await db.jars.filter((j) => !!j.sandbox).primaryKeys();
      await db.transaction('rw', db.jars, db.orbs, db.promises, async () => {
        await db.orbs.filter((o) => !!o.sandbox || sj.includes(o.jarId)).delete(); await db.promises.filter((p) => !!p.sandbox).delete(); await db.jars.bulkDelete(sj);
      });
      toast('Sandbox cleared.'); void render(); return;
    }
    if (act === 'onb') { unmountJar(); void startOnboarding(root, () => { tab = 'jar'; void render(); }); return; }
    if (act === 'lvl') { showLevelUp(4, () => root.dispatchEvent(new CustomEvent('dearme:customize'))); return; }
    if (act === 'drop') { tab = 'jar'; await render(); setTimeout(() => void dropTestOrb(), 350); return; }
    if (act === 'fill') {
      const have = (await orbsIn(jar.id)).length;
      for (let i = have; i < JAR_SIZE - 1; i++) await makeOrb('test');
      tab = 'jar'; await render(); return;
    }
    if (act === 'empty') {
      const s = await getSettings();
      const ids = (await orbsIn(jar.id)).filter((o) => s.sandbox || o.promiseId === 'test').map((o) => o.id);
      await db.orbs.bulkDelete(ids);
      if (s.sandbox) await db.promises.filter((p) => !!p.sandbox).delete();
      toast(`${ids.length} test orbs taken out.`);
    }
  }));
}

/* ---------- Account: one Innova Space passkey; Dear Me's data stays Dear Me's ---------- */
function accountRows(): string {
  const c = cloud.get();
  if (!c.signedIn) return `<button class="row" data-acct="start"><span><span class="t">Sign in with passkey</span><span class="d">Optional. Keeps your jars safe and on all your devices.</span></span>${svg(icon.chev, 18)}</button>`;
  const last = c.lastSync ? new Date(c.lastSync).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'not yet';
  return `<button class="row" data-acct="sync"><span><span class="t">Signed in</span><span class="d">${c.error ? esc(c.error) : `Synced ${esc(last)} · tap to sync now`}</span></span>${svg(icon.chev, 18)}</button>
    <button class="row" data-acct="add"><span><span class="t">Add a passkey on this device</span><span class="d">For a phone or laptop outside your iCloud Keychain</span></span>${svg(icon.chev, 18)}</button>
    <button class="row" data-acct="out"><span><span class="t">Sign out</span><span class="d">Your jars stay on this phone</span></span>${svg(icon.chev, 18)}</button>`;
}

export function signInSheet(after?: () => void): void {
  openSheet(`<p class="serif sheet-title">Keep your jars safe</p>
<p class="sheet-copy">Sign in with a passkey: Face ID, Touch ID or your phone\u2019s lock. No password, no email. One passkey works in every Innova Space app, but your jars, promises and words stay only in Dear Me.</p>
<p class="sheet-copy">Everything on this phone is kept and joined with your account. Nothing is replaced.</p>
${passkeysWork() ? `<button class="btn" id="pk-new">Create a passkey</button><button class="btn-secondary" id="pk-in">I already have one · Sign in</button>` : '<p class="sheet-copy">This browser can\u2019t use passkeys. Try Safari or Chrome.</p>'}
<button class="btn-text" id="pk-later" style="align-self:center">Not now</button>`, (el, close) => {
    el.querySelector('#pk-later')!.addEventListener('click', close);
    const go = (fn: () => Promise<void>, msg: string) => async () => {
      try { await fn(); close(); toast(msg); await syncNow(); after?.(); void render(); }
      catch (e) { toast(friendlyError(e)); }
    };
    el.querySelector('#pk-new')?.addEventListener('click', go(async () => createPasskey((await getSettings()).name), 'Signed in. Your jars are safe.'));
    el.querySelector('#pk-in')?.addEventListener('click', go(signInWithPasskey, 'Signed in. Your jars are joined.'));
  }, 'Sign in');
}

async function account(act: string): Promise<void> {
  if (act === 'start') return signInSheet();
  try {
    if (act === 'sync') { await syncNow(); toast(cloud.get().error ?? 'Synced'); }
    if (act === 'add') { await createPasskey((await getSettings()).name); toast('Passkey added on this device.'); }
    if (act === 'out') { await signOut(); toast('Signed out. Your jars stay on this phone.'); }
  } catch (e) { toast(friendlyError(e)); }
  void render();
}

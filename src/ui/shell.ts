// Dear Me, shell (Phase 1): Jar · Shelf · Settings in the bottom bar. Header = date, then "Dear Me," (or "Dear <name>,").
import { db, getSettings, updateSettings } from '../db/db';
import { esc } from '../lib/util';
import { activeJar, JAR_SIZE, makeOrb, orbsIn } from '../logic/jar';
import { INSIDES, JAR_STYLES, unmountJar } from '../jar/engine';
import { safetySheet } from './safety';
import { cloud, createPasskey, friendlyError, passkeysWork, signInWithPasskey, signOut, syncNow, deleteAccount } from '../lib/cloud';
import { clearReminder, needsInstall, setReminder, testReminder } from '../lib/push';
import { openSheet } from './sheet';
import { feedbackSheet } from './feedback';
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

export const VERSION = '0.10.5';
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

type Page = 'root' | 'you' | 'help' | 'feel' | 'remind' | 'account' | 'about' | 'beta';
let page: Page = 'root';
const PAGES: Record<Page, string> = { root: 'Settings', you: 'You', help: 'Gentle Help', feel: 'Sound and motion', remind: 'Reminders', account: 'Sync and sign-in', about: 'About Dear Me', beta: 'Beta test mode' };
const TAGLINE = 'A jar of kept promises to yourself.';

async function settingsView(): Promise<string> {
  const s = await getSettings();
  const sw = (key: string, on: boolean, label: string) => `<button class="switch" role="switch" aria-checked="${on}" aria-label="${label}" data-switch="${key}"></button>`;
  const row = (t: string, d: string, right: string) => `<div class="row"><span><span class="t">${t}</span>${d ? `<span class="d">${d}</span>` : ''}</span>${right}</div>`;
  const nav = (go: string, t: string, d = '', right = '') => `<button class="row" data-page="${go}"><span><span class="t">${t}</span>${d ? `<span class="d">${d}</span>` : ''}</span><span class="row-r">${right}${svg(icon.chev, 18)}</span></button>`;
  const grp = (label: string, rows: string) => `<div class="group">${label ? `<span class="label">${label}</span>` : ''}<div class="rows">${rows}</div></div>`;
  const head = (t: string) => `<div class="detail-head"><button class="icon-btn" data-page="root" aria-label="Back to Settings">${svg('<path d="M15 5l-7 7 7 7"/>', 22, 1.8)}</button><h1 class="serif">${t}</h1></div>`;
  const signed = cloud.get().signedIn;

  if (page === 'you') return `${head(PAGES.you)}<div class="groups">
  ${grp('Greeting', `<label class="row" for="nm"><span class="t">Name</span><input id="nm" value="${esc(s.name)}" maxlength="24" placeholder="Your name" autocomplete="given-name"
      style="background:none;border:0;text-align:right;color:var(--ink);font-size:15px;width:55%"></label>
    ${row('Use my name', s.name ? `Shows "Dear ${esc(s.name)}," instead of "Dear Me,"` : 'Add your name first', sw('useName', s.useName, 'Use my name'))}`)}</div>`;

  if (page === 'help') return `${head(PAGES.help)}<div class="groups">
  ${grp('', `${row('Suggest smaller steps', signed ? 'Only when you ask. Nothing is added unless you pick it.' : 'Needs sign-in and internet. Only when you ask.', sw('gentleHelp', s.gentleHelp, 'Suggest smaller steps'))}
    ${row('Gentle check-ins', 'When a promise feels heavy, one soft question', sw('checkins', s.checkins, 'Gentle check-ins'))}`)}
  <p class="hint">Gentle Help keeps nothing you write. It only answers when you tap.</p></div>`;

  if (page === 'feel') return `${head(PAGES.feel)}<div class="groups">
  ${grp('', `${row('Sounds', 'Soft glass clinks when orbs touch', sw('sound', s.sound, 'Sounds'))}
    ${row('Move with my phone', 'Tilt or shake your phone and the orbs roll', sw('motion', s.motion, 'Move with my phone'))}`)}</div>`;

  if (page === 'remind') return `${head(PAGES.remind)}<div class="groups">
  ${grp('', `${row('Evening reminder', needsInstall() ? '\u201cYour promises are here.\u201d On iPhone, add Dear Me to your Home Screen first.' : '\u201cYour promises are here.\u201d One gentle line, once a day.', sw('reminderOn', !!s.reminder, 'Evening reminder'))}
    ${s.reminder ? `<label class="row" for="rt"><span class="t">Time</span><input id="rt" type="time" value="${s.reminder}" class="pick" style="color:var(--ink)"></label>
    ${!needsInstall() && 'Notification' in window && Notification.permission !== 'granted' ? `<button class="row" data-act="allow-push"><span><span class="t">Allow notifications</span><span class="d">So the evening line can reach you</span></span>${svg(icon.chev, 18)}</button>` : ''}` : ''}`)}</div>`;

  if (page === 'account') return `${head(PAGES.account)}<div class="groups">
  ${signed ? grp('This device', accountRows()) : `<section class="card signin-card"><p class="serif sheet-title">Your jars on every device</p>
    <p class="sheet-copy">Sign in with a passkey: Face ID, Touch ID or your phone\u2019s lock. No password, no email. One passkey works in every Innova Space app; your jars stay only in Dear Me.</p>
    ${passkeysWork() ? '<button class="btn" data-acct="new">Create a passkey</button><button class="btn-secondary" data-acct="in">I already have one · Sign in</button>' : '<p class="sheet-copy">This browser can\u2019t use passkeys. Try Safari or Chrome.</p>'}</section>
    <p class="hint">Optional. Dear Me works fully offline without it. Signed in, your jars are kept safe and Gentle Help can answer.</p>`}
  ${grp('Your data', `<button class="row" data-act="export"><span><span class="t">Export my jars</span><span class="d">A file with every promise, orb and jar</span></span>${svg(icon.chev, 18)}</button>`)}</div>`;

  if (page === 'about') return `${head(PAGES.about)}<div class="groups">
  ${grp('', `<button class="row" data-act="version"><span><span class="t">Version</span></span><span class="d">${VERSION}</span></button>
    ${row('Made by', '', '<span class="d">Innova Space</span>')}`)}
  <p class="hint">Dear Me is a jar of kept promises to yourself: small promises, kept gently, and proof that you can trust yourself. It works offline and keeps your words on your phone unless you sign in.</p></div>`;

  if (page === 'beta') return `${head(PAGES.beta)}<div class="groups">
  ${grp('', `${row('Sandbox jar', 'A separate test jar. Your real promises stay safe.', sw('sandbox', s.sandbox, 'Sandbox jar'))}
    ${row('Unlock everything', 'All jars and insides, any level', sw('unlockAll', s.unlockAll, 'Unlock everything'))}
    <label class="row" for="b-style"><span class="t">Jar</span><select id="b-style" class="pick">${JAR_STYLES.map((j) => `<option value="${j.id}" ${j.id === s.style ? 'selected' : ''}>${j.name} · Level ${j.level}</option>`).join('')}</select></label>
    <label class="row" for="b-inside"><span class="t">What's inside (next orbs)</span><select id="b-inside" class="pick">${INSIDES.map((i) => `<option value="${i.id}" ${i.id === s.inside ? 'selected' : ''}>${i.name} · Level ${i.level}</option>`).join('')}</select></label>`)}
  ${grp('Try things', `<button class="row" data-beta="checkin"><span class="t">Show a gentle check-in now</span>${svg(icon.chev, 18)}</button>
    <button class="row" data-beta="push"><span class="t">Send the evening reminder now</span>${svg(icon.chev, 18)}</button>
    <button class="row" data-beta="safety"><span class="t">Show the safety sheet</span>${svg(icon.chev, 18)}</button>
    <button class="row" data-beta="onb"><span class="t">Replay onboarding</span>${svg(icon.chev, 18)}</button>
    <button class="row" data-beta="lvl"><span class="t">Show a level-up card (Level 4)</span>${svg(icon.chev, 18)}</button>
    <button class="row" data-beta="drop"><span class="t">Drop a test orb</span>${svg(icon.chev, 18)}</button>
    <button class="row" data-beta="fill"><span class="t">Fill to 11</span>${svg(icon.chev, 18)}</button>
    <button class="row" data-beta="empty"><span><span class="t">Empty the ${s.sandbox ? 'sandbox' : 'current'} jar</span><span class="d">${s.sandbox ? 'Only test orbs' : 'Removes only test orbs from your real jar'}</span></span>${svg(icon.chev, 18)}</button>
    <button class="row" data-beta="clear"><span><span class="t">Clear the sandbox</span><span class="d">Removes every sandbox promise, orb and jar</span></span>${svg(icon.chev, 18)}</button>`)}
  ${grp('', row('Beta test mode', 'Turn off to hide it again', sw('beta', true, 'Beta test mode')))}</div>`;

  // ── root: the menu, like Nudge! ──
  const li = await levelInfo();
  const fresh = (await newUnlocks()).length;
  const nextU = li.next == null ? null : unlocksAt(li.level + 1);
  const nextTxt = nextU ? [nextU.slots ? `${nextU.slots} slots` : '', nextU.jar ? `${nextU.jar.name} jar` : '', nextU.inside?.name ?? ''].filter(Boolean).join(', ') : '';
  const insideName = INSIDES.find((i) => i.id === s.inside)!.name, jarName = JAR_STYLES.find((j) => j.id === s.style)!.name;
  const onOff = (v: boolean) => (v ? 'On' : 'Off');
  return `<h1 class="serif title">Settings</h1>
<div class="groups">
  <button class="profile card" data-page="you"><span class="avatar" aria-hidden="true">${esc((s.name || 'Me').slice(0, 1).toUpperCase())}</span>
    <span class="pinfo"><span class="pname">${esc(s.name || 'Dear Me,')}</span><span class="muted">Level ${li.level} · ${li.kept} ${li.kept === 1 ? 'promise' : 'promises'} kept${s.sandbox ? ' (sandbox)' : ''}</span>
    ${li.next != null ? `<span class="pbar" aria-hidden="true"><i style="width:${Math.round(((li.kept - LEVEL_AT[li.level - 1]) / (li.next - LEVEL_AT[li.level - 1])) * 100)}%"></i></span><span class="pnext">${li.toNext} more to Level ${li.level + 1} · ${esc(nextTxt)}</span>` : '<span class="pnext">Every look is open.</span>'}</span></button>
  ${grp('Your jar', `<button class="row" data-go="customize"><span><span class="t">Jar and what\u2019s inside</span><span class="d">${jarName} · ${insideName}</span></span>
      <span class="row-r">${fresh ? `<span class="badge-new">${fresh} NEW</span>` : ''}${svg(icon.chev, 18)}</span></button>
    ${nav('', 'Insights', 'Kept, made smaller and released').replace('data-page=""', 'data-go="insights"')}
    ${nav('feel', 'Sound and motion', '', `<span class="d">${s.sound || s.motion ? [s.sound ? 'Sounds' : '', s.motion ? 'Motion' : ''].filter(Boolean).join(' · ') : 'Off'}</span>`)}`)}
  ${grp('You', `${nav('you', 'Name and greeting', '', `<span class="d">${s.useName && s.name ? `Dear ${esc(s.name)},` : 'Dear Me,'}</span>`)}
    ${nav('help', 'Gentle Help', 'Smaller steps and soft check-ins', `<span class="d">${onOff(s.gentleHelp)}</span>`)}
    ${nav('remind', 'Reminders', '', `<span class="d">${s.reminder ? fmtTime(s.reminder) : 'Off'}</span>`)}`)}
  ${grp('Account', nav('account', 'Sync and sign-in', 'Your jars on all your devices', `<span class="d">${onOff(signed)}</span>`))}
  ${grp('Support', `<button class="row" data-act="help"><span><span class="t">Need someone to talk to?</span><span class="d">Free, private help lines · works offline</span></span>${svg(icon.chev, 18)}</button>`)}
  ${grp('About', `${nav('about', 'About Dear Me', '', `<span class="d">${VERSION}</span>`)}
    <button class="row" data-act="feedback"><span class="t">Send feedback</span>${svg(icon.chev, 18)}</button>
    ${s.beta ? nav('beta', 'Beta test mode') : ''}`)}
  <footer class="brand-foot">
    <div class="wordmark brand-mark">Dear Me<span class="c">,</span></div>
    <span class="hint">${TAGLINE}</span><span class="hint" data-act="version" role="button" tabindex="0">Version ${VERSION}</span><span class="hint">\u00a9 2026 Innova Space. All rights reserved.</span>
  </footer>
</div>`;
}
const fmtTime = (t: string) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };

let taps = 0, tapTimer = 0;
function wire(): void {
  root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab as Tab; openJar = null; sub = null; page = 'root';
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
    if (key === 'beta') page = 'root';
    void render();
  }));
  root.querySelectorAll<HTMLElement>('[data-page]').forEach((b) => b.addEventListener('click', () => { page = b.dataset.page as Page; void render(); window.scrollTo(0, 0); }));
  root.querySelector('[data-act="feedback"]')?.addEventListener('click', () => void feedbackSheet());
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
  root.querySelectorAll('[data-act="version"]').forEach((v) => v.addEventListener('click', async () => {
    taps++; clearTimeout(tapTimer); tapTimer = window.setTimeout(() => (taps = 0), 1500);
    if (taps >= 7) {
      taps = 0;
      const s = await getSettings();
      if (!s.beta) { await updateSettings({ beta: true }); toast('Beta test mode is on. Settings › About.'); void render(); }
    }
  }));
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
    if (act === 'onb') { unmountJar(); page = 'root'; void startOnboarding(root, () => { tab = 'jar'; void render(); }); return; }
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
    <button class="row" data-acct="out"><span><span class="t">Sign out</span><span class="d">Your jars stay on this phone</span></span>${svg(icon.chev, 18)}</button>
    <button class="row" data-acct="delete"><span><span class="t">Delete my account</span><span class="d">Your account and synced data, in every Innova Space app</span></span>${svg(icon.chev, 18)}</button>`;
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

function deleteAccountSheet(): void {
  openSheet(`<p class="serif sheet-title">Delete your account?</p>
<p class="sheet-copy">Removes your Innova Space account and everything synced in Nudge!, Noggin?, Drift. and Dear Me,. Your jars and promises on this phone stay. This can\u2019t be undone.</p>
<p class="sheet-copy">You can also remove the passkey from your phone or password manager.</p>
<button class="btn" id="del-yes">Delete my account</button>
<button class="btn-text" id="del-no" style="align-self:center">Keep my account</button>`, (el, close) => {
    el.querySelector('#del-no')!.addEventListener('click', close);
    const yes = el.querySelector<HTMLButtonElement>('#del-yes')!;
    yes.addEventListener('click', async () => {
      if (!yes.dataset.sure) {
        yes.dataset.sure = '1'; yes.textContent = 'Yes, delete it for good';
        el.querySelector('.sheet-title')!.textContent = 'Delete it for good?';
        return;
      }
      yes.disabled = true;
      try { await deleteAccount(); close(); toast('Your account is deleted. Your jars are still on this phone.'); void render(); }
      catch (e) { yes.disabled = false; toast(friendlyError(e)); }
    });
  }, 'Delete account');
}

async function account(act: string): Promise<void> {
  if (act === 'start') return signInSheet();
  if (act === 'delete') return deleteAccountSheet();
  if (act === 'new' || act === 'in') {
    try { if (act === 'new') await createPasskey((await getSettings()).name); else await signInWithPasskey(); toast(act === 'new' ? 'Signed in. Your jars are safe.' : 'Signed in. Your jars are joined.'); await syncNow(); }
    catch (e) { toast(friendlyError(e)); }
    void render(); return;
  }
  try {
    if (act === 'sync') { await syncNow(); toast(cloud.get().error ?? 'Synced'); }
    if (act === 'add') { await createPasskey((await getSettings()).name); toast('Passkey added on this device.'); }
    if (act === 'out') { await signOut(); toast('Signed out. Your jars stay on this phone.'); }
  } catch (e) { toast(friendlyError(e)); }
  void render();
}

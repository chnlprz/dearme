// Dear Me, shell (Phase 1): Jar · Shelf · Settings in the bottom bar. Header = date, then "Dear Me," (or "Dear <name>,").
import { db, getSettings, updateSettings } from '../db/db';
import { esc, headerDate } from '../lib/util';
import { activeJar, JAR_SIZE, makeOrb, orbsIn, toSpec } from '../logic/jar';
import { dropOrb, INSIDES, JAR_STYLES, mountJar, unmountJar } from '../jar/engine';
import type { InsideId, JarStyleId } from '../db/types';
import { icon, svg, toast } from './kit';
import { showParticles } from './particles';

export const VERSION = '0.2.0';
type Tab = 'jar' | 'shelf' | 'settings';
let root: HTMLElement;
let tab: Tab = 'jar';

export function startShell(el: HTMLElement): void {
  root = el;
  try { const t = localStorage.getItem('dearme-tab'); if (t === 'jar' || t === 'shelf' || t === 'settings') tab = t; } catch { /* default */ }
  void render();
}

export async function render(): Promise<void> {
  const s = await getSettings();
  const view = tab === 'jar' ? await jarView(s.useName && s.name ? s.name : 'Me', s.sandbox)
    : tab === 'shelf' ? await shelfView() : await settingsView();
  unmountJar();
  root.innerHTML = `<div class="shell"><main class="view" id="main">${view}</main>${tabbar()}</div>`;
  showParticles(tab !== 'settings');
  wire();
  if (tab === 'jar') await startJar();
}

function tabbar(): string {
  const b = (id: Tab, label: string, ic: string) =>
    `<button data-tab="${id}" ${tab === id ? 'aria-current="page"' : ''}>${svg(ic)}<span>${label}</span></button>`;
  return `<nav class="tabbar" aria-label="Main"><div class="in">${b('jar', 'Jar', icon.jar)}${b('shelf', 'Shelf', icon.shelf)}${b('settings', 'Settings', icon.menu)}</div></nav>`;
}

const header = (name: string, sandbox = false) =>
  `<header class="head"><span class="date">${headerDate()}${sandbox ? ' <span class="chip-beta">Sandbox</span>' : ''}</span><h1 class="wordmark">Dear ${esc(name)}<span class="c">,</span></h1></header>`;

async function jarView(name: string, sandbox: boolean): Promise<string> {
  const jar = await activeJar();
  const kept = (await orbsIn(jar.id)).length;
  return `${header(name, sandbox)}
<p class="mirror">You're still here, showing up for yourself.</p>
<section class="stage" aria-label="Your jar">
  <div class="jar-box"><canvas id="jar" role="img" aria-label="Your jar, ${esc(jar.label)}, with ${kept} kept promises"></canvas></div>
  <div class="progress"><span><b id="kept">${kept}</b> / ${JAR_SIZE} promises kept</span><div class="bar" aria-hidden="true"><i id="fill" style="width:${(kept / JAR_SIZE) * 100}%"></i></div></div>
</section>
<div class="slots">
  <button class="slot-empty" data-act="new"><span class="plus">${svg(icon.plus, 20, 2)}</span>
    <span><span class="serif t" style="display:block">I promise myself…</span><span class="s">Your slot is free. Make a promise.</span></span></button>
</div>`;
}

/** After the Jar view is on screen: start the live jar. */
async function startJar(): Promise<void> {
  const c = root.querySelector<HTMLCanvasElement>('#jar');
  if (!c) return;
  const s = await getSettings();
  const jar = await activeJar();
  if (jar.style !== s.style) { jar.style = s.style; await db.jars.put(jar); }
  mountJar(c, { style: jar.style, label: jar.label, orbs: (await orbsIn(jar.id)).map(toSpec) });
}

/** Beta: drop a test orb into the sandbox jar (or the real one when sandbox is off). */
export async function dropTestOrb(): Promise<void> {
  const jar = await activeJar();
  if ((await orbsIn(jar.id)).length >= JAR_SIZE) { toast('This jar is full. Empty it in Beta test mode.'); return; }
  const orb = await makeOrb('test');
  dropOrb(toSpec(orb), () => void updateCount());
}
async function updateCount(): Promise<void> {
  const jar = await activeJar(); const n = (await orbsIn(jar.id)).length;
  const k = root.querySelector('#kept'), f = root.querySelector<HTMLElement>('#fill');
  if (k) k.textContent = String(n); if (f) f.style.width = `${(n / JAR_SIZE) * 100}%`;
}

async function shelfView(): Promise<string> {
  const sealed = await db.jars.filter((j) => !!j.sealedAt && !j.sandbox).count();
  const kept = await db.promises.filter((p) => p.status === 'kept' && !p.sandbox).count();
  return `${header('Me')}
<div class="shelf-head"><span class="serif">Your shelf</span><span class="muted" style="font-size:13px">${sealed} jars · ${kept} kept</span></div>
${sealed ? '' : `<div class="empty"><div class="plank" style="width:220px"></div><p>No sealed jars yet.<br>Your first one will live here.</p></div>`}`;
}

async function settingsView(): Promise<string> {
  const s = await getSettings();
  const sw = (key: string, on: boolean, label: string) => `<button class="switch" role="switch" aria-checked="${on}" aria-label="${label}" data-switch="${key}"></button>`;
  const row = (t: string, d: string, right: string) => `<div class="row"><span><span class="t">${t}</span><span class="d">${d}</span></span>${right}</div>`;
  return `<h1 class="serif title">Settings</h1>
<div class="groups">
  <div class="group"><span class="label">Greeting</span><div class="rows">
    ${row('Use my name', s.name ? `Shows "Dear ${esc(s.name)}," instead of "Dear Me,"` : 'Add your name below first', sw('useName', s.useName, 'Use my name'))}
    <label class="row" for="nm"><span class="t">Name</span><input id="nm" value="${esc(s.name)}" maxlength="24" placeholder="Your name" autocomplete="given-name"
      style="background:none;border:0;text-align:right;color:var(--ink);font-size:15px;width:55%"></label>
  </div></div>
  <div class="group"><span class="label">Coming next</span><div class="rows">
    ${row('Jar and what’s inside', 'Phase 5', '')}${row('Insights', 'Phase 7', '')}${row('Gentle Help', 'Phase 10', '')}${row('Sign in with passkey', 'Phase 9', '')}
  </div></div>
  ${s.beta ? `<div class="group"><span class="label">Beta test mode</span><div class="rows">
    ${row('Sandbox jar', 'A separate test jar. Your real promises stay safe.', sw('sandbox', s.sandbox, 'Sandbox jar'))}
    ${row('Unlock everything', 'All jars and insides, any level', sw('unlockAll', s.unlockAll, 'Unlock everything'))}
    <label class="row" for="b-style"><span class="t">Jar</span><select id="b-style" class="pick">${JAR_STYLES.map((j) => `<option value="${j.id}" ${j.id === s.style ? 'selected' : ''}>${j.name} · Level ${j.level}</option>`).join('')}</select></label>
    <label class="row" for="b-inside"><span class="t">What's inside (next orbs)</span><select id="b-inside" class="pick">${INSIDES.map((i) => `<option value="${i.id}" ${i.id === s.inside ? 'selected' : ''}>${i.name} · Level ${i.level}</option>`).join('')}</select></label>
    <button class="row" data-beta="drop"><span class="t">Drop a test orb</span>${svg(icon.chev, 18)}</button>
    <button class="row" data-beta="fill"><span class="t">Fill to 11</span>${svg(icon.chev, 18)}</button>
    <button class="row" data-beta="empty"><span><span class="t">Empty the ${s.sandbox ? 'sandbox' : 'current'} jar</span><span class="d">${s.sandbox ? 'Only test orbs' : 'Removes only test orbs from your real jar'}</span></span>${svg(icon.chev, 18)}</button>
    ${row('Beta test mode', 'Turn off to hide this section', sw('beta', true, 'Beta test mode'))}
  </div></div>` : ''}
  <div class="group"><span class="label">About</span><div class="rows">
    <button class="row" data-act="version"><span><span class="t">Dear Me, by Innova Space</span><span class="d">Version ${VERSION}</span></span></button>
  </div></div>
  <p class="copyright">© 2026 Innova Space</p>
</div>`;
}

let taps = 0, tapTimer = 0;
function wire(): void {
  root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab as Tab;
    try { localStorage.setItem('dearme-tab', tab); } catch { /* not remembered */ }
    void render(); window.scrollTo(0, 0);
  }));
  root.querySelectorAll<HTMLButtonElement>('[data-switch]').forEach((b) => b.addEventListener('click', async () => {
    const key = b.dataset.switch as 'useName' | 'beta' | 'sandbox' | 'unlockAll';
    const s = await getSettings();
    if (key === 'useName' && !s.name) { toast('Add your name first.'); return; }
    await updateSettings({ [key]: !s[key] } as never);
    void render();
  }));
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
  root.querySelector('[data-act="new"]')?.addEventListener('click', () => toast('Making promises arrives in Phase 3.'));
  root.querySelector<HTMLSelectElement>('#b-style')?.addEventListener('change', async (e) => {
    const style = (e.target as HTMLSelectElement).value as JarStyleId;
    await updateSettings({ style }); const jar = await activeJar(); await db.jars.put({ ...jar, style }); toast('The glass changes right away.');
  });
  root.querySelector<HTMLSelectElement>('#b-inside')?.addEventListener('change', async (e) => {
    await updateSettings({ inside: (e.target as HTMLSelectElement).value as InsideId }); toast('New orbs start with your next promise.');
  });
  root.querySelectorAll<HTMLButtonElement>('[data-beta]').forEach((b) => b.addEventListener('click', async () => {
    const act = b.dataset.beta, jar = await activeJar();
    if (act === 'drop') { tab = 'jar'; await render(); setTimeout(() => void dropTestOrb(), 350); return; }
    if (act === 'fill') {
      const have = (await orbsIn(jar.id)).length;
      for (let i = have; i < JAR_SIZE - 1; i++) await makeOrb('test');
      tab = 'jar'; await render(); return;
    }
    if (act === 'empty') {
      const s = await getSettings();
      const ids = (await orbsIn(jar.id)).filter((o) => s.sandbox || o.promiseId === 'test').map((o) => o.id);
      await db.orbs.bulkDelete(ids); toast(`${ids.length} test orbs taken out.`);
    }
  }));
}

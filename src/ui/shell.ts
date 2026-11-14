// Dear Me, shell (Phase 1): Jar · Shelf · Settings in the bottom bar. Header = date, then "Dear Me," (or "Dear <name>,").
import { db, getSettings, updateSettings } from '../db/db';
import { esc } from '../lib/util';
import { activeJar, JAR_SIZE, makeOrb, orbsIn } from '../logic/jar';
import { INSIDES, JAR_STYLES, unmountJar } from '../jar/engine';
import { dropTestOrb, homeView, startHome } from './home';
import { jarDetailView, shelfView, startJarDetail, startShelf } from './shelf';
import { customizeView, startCustomize } from './customize';
import { showLevelUp } from './levelup';
import { startOnboarding } from './onboarding';
import { levelInfo, newUnlocks, unlocksAt } from '../logic/unlocks';
import { LEVEL_AT } from '../logic/levels';
import type { InsideId, JarStyleId } from '../db/types';
import { icon, svg, toast } from './kit';
import { showParticles } from './particles';

export const VERSION = '0.6.0';
type Tab = 'jar' | 'shelf' | 'settings';
let root: HTMLElement;
let tab: Tab = 'jar';
let openJar: string | null = null;
let sub: 'customize' | null = null;

export function startShell(el: HTMLElement): void {
  root = el;
  root.addEventListener('dearme:rerender', () => void render());
  root.addEventListener('dearme:customize', () => { tab = 'settings'; sub = 'customize'; void render(); window.scrollTo(0, 0); });
  try { const t = localStorage.getItem('dearme-tab'); if (t === 'jar' || t === 'shelf' || t === 'settings') tab = t; } catch { /* default */ }
  void render();
}

export async function render(): Promise<void> {
  const view = tab === 'jar' ? await homeView()
    : tab === 'shelf' ? (openJar ? await jarDetailView(openJar) : await shelfView()) : sub === 'customize' ? await customizeView() : await settingsView();
  unmountJar();
  root.innerHTML = `<div class="shell"><main class="view" id="main">${view}</main>${tabbar()}</div>`;
  showParticles(tab !== 'settings');
  wire();
  if (tab === 'jar') await startHome(root);
  if (tab === 'shelf' && !openJar) await startShelf(root, (id) => { openJar = id; void render(); window.scrollTo(0, 0); });
  if (tab === 'shelf' && openJar) await startJarDetail(root, openJar, () => { openJar = null; void render(); }, () => void render());
  if (tab === 'settings' && sub === 'customize') await startCustomize(root, () => { sub = null; void render(); }, () => void render());
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
    <span class="pinfo"><span class="pname">${esc(s.name || 'Dear Me,')}</span><span class="muted">Level ${li.level} · ${li.kept} promises kept${s.sandbox ? ' (sandbox)' : ''}</span>
    ${li.next != null ? `<span class="pbar" aria-hidden="true"><i style="width:${Math.round(((li.kept - LEVEL_AT[li.level - 1]) / (li.next - LEVEL_AT[li.level - 1])) * 100)}%"></i></span><span class="pnext">${li.toNext} more to Level ${li.level + 1} · ${esc(nextTxt)}</span>` : '<span class="pnext">Every look is open.</span>'}</span></div>
  <div class="group"><span class="label">Your jar</span><div class="rows">
    <button class="row" data-go="customize"><span><span class="t">Jar and what’s inside</span><span class="d">${jarName} · ${insideName}</span></span>
      <span class="row-r">${fresh ? `<span class="badge-new">${fresh} NEW</span>` : ''}${svg(icon.chev, 18)}</span></button>
  </div></div>
  <div class="group"><span class="label">Greeting</span><div class="rows">
    ${row('Use my name', s.name ? `Shows "Dear ${esc(s.name)}," instead of "Dear Me,"` : 'Add your name below first', sw('useName', s.useName, 'Use my name'))}
    <label class="row" for="nm"><span class="t">Name</span><input id="nm" value="${esc(s.name)}" maxlength="24" placeholder="Your name" autocomplete="given-name"
      style="background:none;border:0;text-align:right;color:var(--ink);font-size:15px;width:55%"></label>
  </div></div>
  <div class="group"><span class="label">Coming next</span><div class="rows">
    ${row('Insights', 'Phase 7', '')}${row('Gentle Help', 'Phase 10', '')}${row('Sign in with passkey', 'Phase 9', '')}
  </div></div>
  ${s.beta ? `<div class="group"><span class="label">Beta test mode</span><div class="rows">
    ${row('Sandbox jar', 'A separate test jar. Your real promises stay safe.', sw('sandbox', s.sandbox, 'Sandbox jar'))}
    ${row('Unlock everything', 'All jars and insides, any level', sw('unlockAll', s.unlockAll, 'Unlock everything'))}
    <label class="row" for="b-style"><span class="t">Jar</span><select id="b-style" class="pick">${JAR_STYLES.map((j) => `<option value="${j.id}" ${j.id === s.style ? 'selected' : ''}>${j.name} · Level ${j.level}</option>`).join('')}</select></label>
    <label class="row" for="b-inside"><span class="t">What's inside (next orbs)</span><select id="b-inside" class="pick">${INSIDES.map((i) => `<option value="${i.id}" ${i.id === s.inside ? 'selected' : ''}>${i.name} · Level ${i.level}</option>`).join('')}</select></label>
    <button class="row" data-beta="onb"><span class="t">Replay onboarding</span>${svg(icon.chev, 18)}</button>
    <button class="row" data-beta="lvl"><span class="t">Show a level-up card (Level 4)</span>${svg(icon.chev, 18)}</button>
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
    tab = b.dataset.tab as Tab; openJar = null; sub = null;
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
  root.querySelector('[data-go="customize"]')?.addEventListener('click', () => { sub = 'customize'; void render(); window.scrollTo(0, 0); });
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

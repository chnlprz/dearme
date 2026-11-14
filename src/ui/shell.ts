// Dear Me, shell (Phase 1): Jar · Shelf · Settings in the bottom bar. Header = date, then "Dear Me," (or "Dear <name>,").
import { currentJar, db, getSettings, updateSettings } from '../db/db';
import { esc, headerDate } from '../lib/util';
import { jarSVG } from './jarArt';
import { icon, svg, toast } from './kit';
import { showParticles } from './particles';

export const VERSION = '0.1.0';
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
  root.innerHTML = `<div class="shell"><main class="view" id="main">${view}</main>${tabbar()}</div>`;
  showParticles(tab !== 'settings');
  wire();
}

function tabbar(): string {
  const b = (id: Tab, label: string, ic: string) =>
    `<button data-tab="${id}" ${tab === id ? 'aria-current="page"' : ''}>${svg(ic)}<span>${label}</span></button>`;
  return `<nav class="tabbar" aria-label="Main"><div class="in">${b('jar', 'Jar', icon.jar)}${b('shelf', 'Shelf', icon.shelf)}${b('settings', 'Settings', icon.menu)}</div></nav>`;
}

const header = (name: string) =>
  `<header class="head"><span class="date">${headerDate()}</span><h1 class="wordmark">Dear ${esc(name)}<span class="c">,</span></h1></header>`;

async function jarView(name: string, sandbox: boolean): Promise<string> {
  const jar = await currentJar(sandbox);
  const kept = jar ? await db.orbs.where('jarId').equals(jar.id).count() : 0;
  return `${header(name)}
<p class="mirror">You're still here, showing up for yourself.</p>
<section class="stage" aria-label="Your jar">
  ${jarSVG(jar?.label ?? 'chapter 1')}
  <div class="progress"><span><b>${kept}</b> / 12 promises kept</span><div class="bar" aria-hidden="true"><i style="width:${(kept / 12) * 100}%"></i></div></div>
</section>
<div class="slots">
  <button class="slot-empty" data-act="new"><span class="plus">${svg(icon.plus, 20, 2)}</span>
    <span><span class="serif t" style="display:block">I promise myself…</span><span class="s">Your slot is free. Make a promise.</span></span></button>
</div>`;
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
    ${row('Beta tools', 'Sandbox, unlock all and animation replays arrive in Phase 2 and 7', '')}
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
    const key = b.dataset.switch as 'useName' | 'beta';
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
}

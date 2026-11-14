// The Shelf: sealed jars on wooden shelves, each exactly as it was sealed. Tap one for its 12 promises and dates.
import { db } from '../db/db';
import type { Jar } from '../db/types';
import { drawStillJar, orbColors } from '../jar/engine';
import { orbsIn, toSpec } from '../logic/jar';
import { dateRange, LABEL_MAX, promisesOf, renameJar, sealedJars } from '../logic/seal';
import { esc } from '../lib/util';
import { svg } from './kit';
import { openSheet } from './sheet';

export async function shelfView(): Promise<string> {
  const jars = await sealedJars();
  const kept = (await Promise.all(jars.map((j) => db.orbs.where('jarId').equals(j.id).count()))).reduce((a, b) => a + b, 0);
  const rows: Jar[][] = [];
  for (let i = 0; i < jars.length; i += 2) rows.push(jars.slice(i, i + 2));
  const ranges = new Map<string, string>();
  for (const j of jars) ranges.set(j.id, dateRange(await orbsIn(j.id), j));
  return `<h1 class="serif title">Your shelf</h1>
<p class="shelf-sub muted">${jars.length} ${jars.length === 1 ? 'jar' : 'jars'} · ${kept} promises kept</p>
${jars.length ? `<div class="shelves">${rows.map((r) => `<div class="shelf-row"><div class="shelf-jars">${r.map((j) =>
    `<button class="shelf-jar" data-jar="${j.id}" aria-label="${esc(j.label)}, ${ranges.get(j.id)}"><canvas data-still="${j.id}" aria-hidden="true"></canvas></button>`).join('')}</div>
  <div class="plank" aria-hidden="true"></div><div class="shelf-labels">${r.map((j) =>
    `<span><span class="serif l">${esc(j.label)}</span><span class="d">${ranges.get(j.id)}</span></span>`).join('')}</div></div>`).join('')}</div>`
  : `<div class="empty"><div class="plank" style="width:220px"></div><p>No sealed jars yet.<br>Your first one will live here.</p></div>`}`;
}

export async function startShelf(root: HTMLElement, open: (id: string) => void): Promise<void> {
  for (const c of root.querySelectorAll<HTMLCanvasElement>('[data-still]')) {
    const j = await db.jars.get(c.dataset.still!);
    if (j) drawStillJar(c, 140, j.style, (await orbsIn(j.id)).map(toSpec));
  }
  root.querySelectorAll<HTMLButtonElement>('[data-jar]').forEach((b) => b.addEventListener('click', () => open(b.dataset.jar!)));
}

export async function jarDetailView(id: string): Promise<string> {
  const j = await db.jars.get(id);
  if (!j) return '<p class="empty">This jar is not on this device.</p>';
  const orbs = await orbsIn(id);
  const ps = await promisesOf(orbs);
  const smaller = ps.filter((p) => p?.refinedFrom).length;
  return `<div class="detail-head"><button class="icon-btn" data-back aria-label="Back to your shelf">${svg('<path d="M15 5l-7 7 7 7"/>', 22, 1.8)}</button>
<h1 class="serif" id="jlabel">${esc(j.label)}</h1>
<button class="icon-btn gold" data-rename aria-label="Rename this jar">${svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>', 18, 1.8)}</button></div>
<div class="detail-top"><canvas data-big aria-hidden="true"></canvas>
<div class="detail-facts"><span class="muted">${dateRange(orbs, j)}</span><span><b>${orbs.length}</b> promises kept</span>${smaller ? `<span class="muted">${smaller} made smaller first</span>` : ''}</div></div>
<ol class="kept-list">${orbs.map((o, i) => {
    const p = ps[i];
    return `<li><span class="dot" data-dot="${i}" aria-hidden="true"></span><span class="what"><span>${p ? esc(p.text) : 'Test orb (Beta)'}</span>${p?.refinedFrom ? `<span class="from">Made smaller from: ${esc(p.refinedFrom)}</span>` : ''}</span>
<span class="when">${new Date(o.keptAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></li>`;
  }).join('')}</ol>`;
}

export async function startJarDetail(root: HTMLElement, id: string, back: () => void, redraw: () => void): Promise<void> {
  const j = await db.jars.get(id);
  if (!j) return;
  const orbs = await orbsIn(id);
  const big = root.querySelector<HTMLCanvasElement>('[data-big]');
  if (big) drawStillJar(big, 132, j.style, orbs.map(toSpec));
  // little orb dots in the list, in each orb's own colour
  root.querySelectorAll<HTMLElement>('[data-dot]').forEach((d) => {
    const c = orbColors(orbs[+d.dataset.dot!].inside, orbs[+d.dataset.dot!].color);
    d.style.background = `radial-gradient(circle at 35% 30%, #fff, ${c.base} 55%, ${c.deep})`; d.style.boxShadow = `0 0 10px rgba(${c.glow},.6)`;
  });
  root.querySelector('[data-back]')?.addEventListener('click', back);
  root.querySelector('[data-rename]')?.addEventListener('click', () => renameSheet(j.label, async (l) => { await renameJar(id, l); redraw(); }));
}

/** Name this jar (current or sealed). The dates and promises inside never change. */
export function renameSheet(current: string, save: (label: string) => void | Promise<void>, title = 'Name this jar'): void {
  const ideas = ['the gym era', 'learning to rest', 'saying yes to me', 'soft and steady'];
  openSheet(`<p class="serif sheet-title">${title}</p>
<p class="sheet-copy">Change it anytime. The dates and promises inside stay the same.</p>
<label class="field-label" for="jn">Jar label</label>
<input id="jn" class="field serif" maxlength="${LABEL_MAX}" value="${esc(current)}" autocomplete="off">
<span class="count muted" id="jc">${current.length} / ${LABEL_MAX}</span>
<div class="chips">${ideas.map((i) => `<button class="chip" data-n="${esc(i)}">${esc(i)}</button>`).join('')}</div>
<button class="btn" id="jsave">Save name</button>`, (el, close) => {
    const inp = el.querySelector<HTMLInputElement>('#jn')!, cnt = el.querySelector('#jc')!;
    const sync = () => { cnt.textContent = `${inp.value.length} / ${LABEL_MAX}`; };
    inp.addEventListener('input', sync);
    el.querySelectorAll<HTMLButtonElement>('[data-n]').forEach((c) => c.addEventListener('click', () => { inp.value = c.dataset.n!; sync(); inp.focus(); }));
    el.querySelector('#jsave')!.addEventListener('click', async () => { if (!inp.value.trim()) return; await save(inp.value); close(); });
  }, title);
}

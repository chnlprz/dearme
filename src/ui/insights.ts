// Settings › Insights (Mockups v1 › 8): totals, lists you can switch between, and a summary for each sealed jar.
import type { DMPromise } from '../db/types';
import { drawStillJar } from '../jar/engine';
import { insightTotals, jarSummary } from '../logic/insights';
import { orbsIn, toSpec } from '../logic/jar';
import { sealedJars } from '../logic/seal';
import { esc } from '../lib/util';
import { svg } from './kit';

type Tab = 'kept' | 'smaller' | 'released';
let tab: Tab = 'kept';
const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');

export async function insightsView(): Promise<string> {
  const t = await insightTotals();
  const jars = await sealedJars();
  const sums = await Promise.all(jars.map(jarSummary));
  const list: DMPromise[] = (tab === 'kept' ? t.kept : tab === 'smaller' ? t.smaller : t.released)
    .slice().sort((a, b) => (b.keptAt ?? b.releasedAt ?? b.updatedAt).localeCompare(a.keptAt ?? a.releasedAt ?? a.updatedAt));
  const row = (p: DMPromise) => {
    if (tab === 'smaller') return `<li><span class="was">${esc(p.refinedFrom!)}</span><span class="line"><span>→ ${esc(p.text)}</span><span class="${p.status === 'kept' ? 'st gold' : 'st'}">${p.status === 'kept' ? `Kept · ${day(p.keptAt)}` : p.status === 'released' ? 'Released' : 'Still open'}</span></span></li>`;
    if (tab === 'released') { const why = p.story.find((s) => s.kind === 'released')?.note; return `<li><span class="line"><span>${esc(p.text)}</span><span class="st">${day(p.releasedAt)}</span></span>${why ? `<span class="was">${esc(why)}</span>` : ''}</li>`; }
    return `<li><span class="line"><span>${esc(p.text)}</span><span class="st gold">${day(p.keptAt)}</span></span></li>`;
  };
  const tabBtn = (id: Tab, label: string) => `<button role="tab" aria-selected="${tab === id}" data-itab="${id}">${label}</button>`;
  return `<div class="detail-head"><button class="icon-btn" data-back aria-label="Back to Settings">${svg('<path d="M15 5l-7 7 7 7"/>', 22, 1.8)}</button><h1 class="serif">Insights</h1></div>
<div class="ins">
  <div class="tiles"><div class="tile"><span class="n gold">${t.kept.length}</span><span>Kept</span></div><div class="tile"><span class="n orchid">${t.smaller.length}</span><span>Made smaller</span></div><div class="tile"><span class="n pink">${t.released.length}</span><span>Released</span></div></div>
  <p class="muted small">Released promises are choices, never failures.</p>
  <div class="seg" role="tablist">${tabBtn('kept', 'Kept')}${tabBtn('smaller', 'Made smaller')}${tabBtn('released', 'Released')}</div>
  ${list.length ? `<ul class="ins-list">${list.map(row).join('')}</ul>` : `<p class="muted small" style="text-align:center;padding:16px 0">Nothing here yet.</p>`}
  <h2 class="serif ins-h">Jar summaries</h2>
  ${jars.length ? jars.map((j, i) => `<div class="sum card"><canvas data-sum="${j.id}" aria-hidden="true"></canvas><span><span class="serif l">${esc(j.label)}</span><span class="muted d">${esc(sums[i])}</span></span></div>`).join('')
    : '<p class="muted small">Your first sealed jar will be summarised here.</p>'}
</div>`;
}

export async function startInsights(root: HTMLElement, back: () => void, redraw: () => void): Promise<void> {
  root.querySelector('[data-back]')?.addEventListener('click', back);
  root.querySelectorAll<HTMLButtonElement>('[data-itab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.itab as Tab; redraw(); }));
  for (const c of root.querySelectorAll<HTMLCanvasElement>('[data-sum]')) {
    const j = (await sealedJars()).find((x) => x.id === c.dataset.sum);
    if (j) drawStillJar(c, 60, j.style, (await orbsIn(j.id)).map(toSpec));
  }
}

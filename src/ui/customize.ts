// Settings › Jar and what's inside (Mockups v1 › L3, L4). The jar changes the glass right away; what's inside changes
// from the next promise; sealed jars never change. Locked options show the level and kept promises that open them.
import { db, getSettings, updateSettings } from '../db/db';
import type { InsideId, JarStyleId } from '../db/types';
import { drawOrbPreview, drawStillJar, INSIDES, JAR_STYLES, setJarStyle } from '../jar/engine';
import { activeJar, orbsIn, toSpec } from '../logic/jar';
import { LEVEL_AT } from '../logic/levels';
import { isOpen, markSeen, newUnlocks } from '../logic/unlocks';
import { esc } from '../lib/util';
import { svg, toast } from './kit';
import { openSheet } from './sheet';

const LOCK = '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>';
const nameOf = (id: InsideId) => INSIDES.find((i) => i.id === id)!.name;

export async function customizeView(): Promise<string> {
  const s = await getSettings();
  const jar = await activeJar();
  const orbs = await orbsIn(jar.id);
  const fresh = await newUnlocks();
  const layers = [...new Set(orbs.map((o) => o.inside))];
  const now = !orbs.length ? 'Empty for now. Your next promise starts it.'
    : layers.length === 1 ? `${nameOf(layers[0])} so far.`
    : `${layers.map(nameOf).join(', then ')}, in layers.`;
  const card = async (kind: 'jar' | 'in', id: string, name: string, lv: number, sel: boolean) => {
    const open = await isOpen(kind, lv);
    const isNew = fresh.includes(`${kind}:${id}`);
    return `<button class="opt-card${sel ? ' sel' : ''}${open ? '' : ' locked'}" data-${kind}="${id}" data-lv="${lv}" aria-pressed="${sel}" ${open ? '' : 'aria-disabled="true"'}>
${isNew ? '<span class="new">NEW</span>' : ''}<canvas data-thumb="${kind}:${id}" aria-hidden="true"></canvas><span class="n">${esc(name)}</span>
${open ? `<span class="s${sel ? ' gold' : ''}">${sel ? 'In use' : 'Unlocked'}</span>` : `<span class="s lk">${svg(LOCK, 12, 2)} Level ${lv} · ${LEVEL_AT[lv - 1]} kept</span>`}</button>`;
  };
  const jars = (await Promise.all(JAR_STYLES.map((j) => card('jar', j.id, j.name, j.level, j.id === s.style)))).join('');
  const ins = (await Promise.all(INSIDES.map((i) => card('in', i.id, i.name, i.level, i.id === s.inside)))).join('');
  return `<div class="detail-head"><button class="icon-btn" data-back aria-label="Back to Settings">${svg('<path d="M15 5l-7 7 7 7"/>', 22, 1.8)}</button><h1 class="serif">Jar and what’s inside</h1></div>
<div class="cz">
  <div class="now card"><canvas data-now aria-hidden="true"></canvas><div><span class="kicker">Your jar now</span><p class="serif">${esc(now)}</p><p class="muted">Each orb keeps the look it had when it dropped in.</p></div></div>
  <div class="note">${svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>', 18, 1.8)}<span>What’s inside changes from your <b>next</b> promise. The jar changes the glass right away. Sealed jars on your shelf never change.</span></div>
  <span class="label">Jar</span><div class="opt-grid">${jars}</div>
  <span class="label">What’s inside</span><div class="opt-grid">${ins}</div>
</div>`;
}

export async function startCustomize(root: HTMLElement, back: () => void, redraw: () => void): Promise<void> {
  const s = await getSettings();
  const jar = await activeJar();
  const orbs = await orbsIn(jar.id);
  const now = root.querySelector<HTMLCanvasElement>('[data-now]');
  if (now) drawStillJar(now, 110, s.style, orbs.map(toSpec));
  root.querySelectorAll<HTMLCanvasElement>('[data-thumb]').forEach((c) => {
    const [kind, id] = c.dataset.thumb!.split(':');
    if (kind === 'jar') drawStillJar(c, 64, id as JarStyleId, [0, 1, 2].map((k) => ({ id: `t${k}`, inside: s.inside, color: k, hue: k })));
    else drawOrbPreview(c, id as InsideId, 52);
  });
  await markSeen(await newUnlocks());
  root.querySelector('[data-back]')?.addEventListener('click', back);
  root.querySelectorAll<HTMLButtonElement>('[data-jar]').forEach((b) => b.addEventListener('click', async () => {
    const id = b.dataset.jar as JarStyleId, lv = +b.dataset.lv!;
    if (!(await isOpen('jar', lv))) { toast(`Opens at Level ${lv} · ${LEVEL_AT[lv - 1]} promises kept.`); return; }
    if (id === s.style) return;
    await updateSettings({ style: id }); await db.jars.put({ ...jar, style: id }); setJarStyle(id);
    toast('The glass changes right away.'); redraw();
  }));
  root.querySelectorAll<HTMLButtonElement>('[data-in]').forEach((b) => b.addEventListener('click', async () => {
    const id = b.dataset.in as InsideId, lv = +b.dataset.lv!;
    if (!(await isOpen('in', lv))) { toast(`Opens at Level ${lv} · ${LEVEL_AT[lv - 1]} promises kept.`); return; }
    if (id === s.inside) return;
    if (!orbs.length) { await updateSettings({ inside: id }); toast(`${nameOf(id)} start with your next promise.`); redraw(); return; }
    confirmInside(id, s.inside, orbs.map((o) => o.inside), redraw);
  }));
}

function confirmInside(next: InsideId, current: InsideId, inJar: InsideId[], redraw: () => void): void {
  const have = [...new Set(inJar)].slice(-3);
  openSheet(`<div class="ci-head"><canvas data-big aria-hidden="true"></canvas><p class="serif sheet-title">${esc(nameOf(next))} from your next promise</p></div>
<div class="ci-flow"><div><div class="ci-row" data-row="have"></div><span class="muted">In your jar · stays</span></div>
${svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 22, 1.8)}
<div><div class="ci-row" data-row="next"></div><span class="muted">Next orbs</span></div></div>
<p class="sheet-copy">Your jar grows in layers, like chapters inside a chapter. You can switch back anytime.</p>
<button class="btn" id="use">Use ${esc(nameOf(next))}</button>
<button class="btn-text" id="keepcur" style="align-self:center">Keep ${esc(nameOf(current))}</button>`, (el, close) => {
    drawOrbPreview(el.querySelector('[data-big]')!, next, 56);
    const fill = (row: string, kinds: InsideId[]) => kinds.forEach((k) => { const c = document.createElement('canvas'); el.querySelector(`[data-row="${row}"]`)!.append(c); drawOrbPreview(c, k, 30); });
    fill('have', have); fill('next', [next, next]);
    el.querySelector('#keepcur')!.addEventListener('click', close);
    el.querySelector('#use')!.addEventListener('click', async () => {
      await updateSettings({ inside: next, homeToast: `${nameOf(next)} start with your next promise` });
      close(); toast(`${nameOf(next)} start with your next promise.`); redraw();
    });
  }, 'Change what is inside');
}

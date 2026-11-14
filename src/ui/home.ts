// Home (the Jar tab): date, "Dear Me,", mirror line, the live jar, progress, and 1–3 promise slots.
// Tap a promise for options (Mark as kept, Edit, Refine, Release). Hold it to keep it: the card fills gold with
// twinkles, the cork lifts and the orb drops in. Mockups v1 › 1–4.
import { getSettings } from '../db/db';
import type { DMPromise } from '../db/types';
import { dropOrb, isBusy, mountJar } from '../jar/engine';
import { activeJar, JAR_SIZE, makeOrb, orbsIn, toSpec } from '../logic/jar';
import { slotCount } from '../logic/levels';
import { activePromises, editPromise, jarIsFull, keepPromise, makePromise, MAX_LEN, refinePromise, releasePromise } from '../logic/promises';
import { esc, headerDate, reducedMotion } from '../lib/util';
import { icon, svg, toast } from './kit';
import { closeSheet, openSheet } from './sheet';

const HOLD_MS = 1100;
const KEPT_LINES = ['Kept. That one is yours.', 'You did what you said you would.', 'Another light in your jar.', 'Proof, glowing.', 'You showed up for you.'];
let root: HTMLElement;
let mirror = "You're still here, showing up for yourself.";

export async function homeView(): Promise<string> {
  const s = await getSettings();
  const name = s.useName && s.name ? s.name : 'Me';
  const jar = await activeJar();
  const kept = (await orbsIn(jar.id)).length;
  return `<header class="head"><span class="date">${headerDate()}${s.sandbox ? ' <span class="chip-beta">Sandbox</span>' : ''}</span>
<h1 class="wordmark">Dear ${esc(name)}<span class="c">,</span></h1></header>
<p class="mirror" id="mirror" aria-live="polite">${esc(mirror)}</p>
<section class="stage" aria-label="Your jar">
  <div class="jar-box"><canvas id="jar" role="img" aria-label="Your jar, ${esc(jar.label)}, with ${kept} kept promises"></canvas></div>
  <div class="progress"><span><b id="kept">${kept}</b> / ${JAR_SIZE} promises kept</span><div class="bar" aria-hidden="true"><i id="fill" style="width:${(kept / JAR_SIZE) * 100}%"></i></div></div>
</section>
<div class="slots" id="slots">${await slotsHTML()}</div>`;
}

async function slotsHTML(): Promise<string> {
  const [list, slots, full] = [await activePromises(), await slotCount(), await jarIsFull()];
  const compact = slots > 1 && list.length > 1;
  let html = list.map((p) => card(p, compact)).join('');
  if (full) html += `<div class="slot-note card"><span class="serif" style="font-size:19px">Your jar is full.</span><span class="muted" style="font-size:13px">Twelve times you kept your word. Sealing this chapter arrives next.</span></div>`;
  else if (list.length < slots) html += `<button class="slot-empty" data-act="new"><span class="plus">${svg(icon.plus, 20, 2)}</span>
    <span><span class="serif t" style="display:block">I promise myself…</span><span class="s">${list.length ? 'You have room for one more.' : 'Your slot is free. Make a promise.'}</span></span></button>`;
  return html;
}

const card = (p: DMPromise, compact: boolean) => `<button class="promise${compact ? ' compact' : ''}" data-id="${p.id}" aria-label="${esc(p.text)}. Tap for options, hold to keep.">
  <span class="fillbar" aria-hidden="true"></span><span class="twinkles" aria-hidden="true">${'<i></i>'.repeat(6)}</span>
  ${compact ? '' : '<span class="kicker">I promise myself</span>'}
  <span class="serif text">${esc(p.text)}</span>
  <span class="hint">Tap for options · hold to keep</span>
</button>`;

/** After the Home view is on screen: start the live jar and wire the slots. */
export async function startHome(el: HTMLElement): Promise<void> {
  root = el;
  const c = root.querySelector<HTMLCanvasElement>('#jar');
  if (!c) return;
  const s = await getSettings();
  const jar = await activeJar();
  mountJar(c, { style: s.style, label: jar.label, orbs: (await orbsIn(jar.id)).map(toSpec) });
  wireSlots();
}

async function refreshSlots(): Promise<void> {
  const box = root.querySelector('#slots');
  if (!box) return;
  box.innerHTML = await slotsHTML();
  wireSlots();
}
async function refreshCount(): Promise<void> {
  const n = (await orbsIn((await activeJar()).id)).length;
  const k = root.querySelector('#kept'), f = root.querySelector<HTMLElement>('#fill');
  if (k) k.textContent = String(n);
  if (f) f.style.width = `${(n / JAR_SIZE) * 100}%`;
}
function setMirror(text: string): void { mirror = text; const m = root.querySelector('#mirror'); if (m) m.textContent = text; }

function wireSlots(): void {
  root.querySelector('[data-act="new"]')?.addEventListener('click', () => promiseSheet());
  root.querySelectorAll<HTMLButtonElement>('.promise').forEach(wireHold);
}

/* ---------- hold to keep ---------- */
function wireHold(b: HTMLButtonElement): void {
  const id = b.dataset.id!;
  let t0 = 0, timer = 0, done = false;
  const stop = () => { clearTimeout(timer); b.classList.remove('holding'); };
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  b.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || isBusy()) return;
    t0 = performance.now(); done = false;
    b.classList.add('holding');
    timer = window.setTimeout(() => { done = true; b.classList.remove('holding'); void keep(id, b); }, HOLD_MS);
  });
  b.addEventListener('pointerup', () => {
    const quick = performance.now() - t0 < 260;
    stop();
    if (!done && quick) void optionsSheet(id);
  });
  b.addEventListener('pointerleave', stop);
  b.addEventListener('pointercancel', stop);
  // Keyboard: Enter or Space opens the options (Mark as kept is there).
  b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void optionsSheet(id); } });
}

async function keep(id: string, b?: HTMLElement): Promise<void> {
  if (await jarIsFull()) { toast('Your jar is full. Sealing arrives next.'); return; }
  navigator.vibrate?.(18);
  const orb = await keepPromise(id);
  if (!orb) return;
  b?.classList.add('gone');
  setMirror(KEPT_LINES[Math.floor(Math.random() * KEPT_LINES.length)]);
  dropOrb(toSpec(orb), () => { void refreshCount(); });
  setTimeout(() => void refreshSlots(), reducedMotion() ? 0 : 420);
}

/* ---------- sheets ---------- */
async function optionsSheet(id: string): Promise<void> {
  const p = (await activePromises()).find((x) => x.id === id);
  if (!p) return;
  const opt = (act: string, ic: string, t: string, d: string) =>
    `<button class="opt-row" data-o="${act}">${svg(ic, 22, 1.7)}<span><span class="t">${t}</span><span class="d">${d}</span></span></button>`;
  openSheet(`<span class="kicker">I promise myself</span><p class="serif sheet-title">${esc(p.text)}</p>
${p.refinedFrom ? `<p class="from">Made smaller from: ${esc(p.refinedFrom)}</p>` : ''}
<button class="btn" data-o="keep">Mark as kept</button>
<div class="opt-list">
${opt('edit', '<path d="M4 20h4L19 9l-4-4L4 16z"/>', 'Edit', 'Change the words')}
${opt('refine', '<path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"/>', 'Refine', 'Make it smaller or reshape it')}
${opt('release', '<path d="M12 4v10M8 10l4 4 4-4M5 20h14"/>', 'Release', 'Set it down, no guilt. It frees your slot.')}
</div><p class="tip">Tip: hold the promise on Home to keep it.</p>`, (el, close) => {
    el.querySelectorAll<HTMLButtonElement>('[data-o]').forEach((b) => b.addEventListener('click', () => {
      const o = b.dataset.o; close();
      setTimeout(() => {
        if (o === 'keep') void keep(id, root.querySelector<HTMLElement>(`.promise[data-id="${id}"]`) ?? undefined);
        if (o === 'edit') promiseSheet(p);
        if (o === 'refine') refineSheet(p);
        if (o === 'release') releaseSheet(p);
      }, 220);
    }));
  }, 'Promise options');
}

const IDEAS = ['Drink a glass of water', 'Pack my gym bag tonight', 'Phone outside the room at 11', 'Send one kind message'];

function promiseSheet(p?: DMPromise): void {
  const editing = !!p;
  openSheet(`<p class="serif sheet-title">${editing ? 'Edit your promise' : 'Make a promise'}</p>
<label class="field-label" for="ptext">I promise myself…</label>
<textarea id="ptext" class="field serif" maxlength="${MAX_LEN}" rows="2" placeholder="Something small you can keep">${editing ? esc(p!.text) : ''}</textarea>
${editing ? '' : `<span class="field-label">Small is good. Ideas:</span><div class="chips">${IDEAS.map((i) => `<button class="chip" data-idea="${esc(i)}">${esc(i)}</button>`).join('')}</div>`}
<button class="btn" id="psave" ${editing ? '' : 'disabled'}>${editing ? 'Save' : 'Put it on my jar'}</button>`, (el, close) => {
    const ta = el.querySelector<HTMLTextAreaElement>('#ptext')!, save = el.querySelector<HTMLButtonElement>('#psave')!;
    const sync = () => { save.disabled = !ta.value.trim(); };
    ta.addEventListener('input', sync);
    el.querySelectorAll<HTMLButtonElement>('[data-idea]').forEach((c) => c.addEventListener('click', () => { ta.value = c.dataset.idea!; sync(); ta.focus(); }));
    save.addEventListener('click', async () => {
      const text = ta.value.trim(); if (!text) return;
      if (editing) await editPromise(p!.id, text); else { await makePromise(text); setMirror('A new promise. Small and doable.'); }
      close(); void refreshSlots();
    });
  }, editing ? 'Edit promise' : 'Make a promise');
}

function refineSheet(p: DMPromise): void {
  openSheet(`<p class="serif sheet-title">Make it smaller</p>
<p class="sheet-copy">It still matters. It might just need a different shape. What's a version you could keep?</p>
<p class="from">Now: ${esc(p.text)}</p>
<label class="field-label" for="rtext">A smaller version</label>
<textarea id="rtext" class="field serif" maxlength="${MAX_LEN}" rows="2">${esc(p.text)}</textarea>
<p class="sheet-copy" style="margin-top:-4px">Keeping it still earns a full orb.</p>
<button class="btn" id="rsave">Use this version</button>`, (el, close) => {
    const ta = el.querySelector<HTMLTextAreaElement>('#rtext')!;
    ta.select();
    el.querySelector('#rsave')!.addEventListener('click', async () => {
      const text = ta.value.trim(); if (!text || text === p.text) { close(); return; }
      await refinePromise(p.id, text); close(); setMirror('Smaller is still a promise.'); void refreshSlots();
    });
  }, 'Refine promise');
}

const WHY = ['No time', 'No energy', 'Not for me right now', 'Something changed', 'It felt scary'];
function releaseSheet(p: DMPromise): void {
  openSheet(`<p class="serif sheet-title">Release this promise?</p>
<p class="from">${esc(p.text)}</p>
<p class="sheet-copy">Circumstances change. Setting it down is allowed, and it's never counted against you.</p>
<span class="field-label">Want to share why? (optional)</span>
<div class="chips">${WHY.map((w) => `<button class="chip" data-why="${esc(w)}" aria-pressed="false">${esc(w)}</button>`).join('')}</div>
<button class="btn" id="rel">Release</button>
<button class="btn-text" id="hold-on" style="align-self:center">Keep holding it</button>`, (el, close) => {
    let why = '';
    el.querySelectorAll<HTMLButtonElement>('[data-why]').forEach((c) => c.addEventListener('click', () => {
      why = why === c.dataset.why ? '' : c.dataset.why!;
      el.querySelectorAll<HTMLButtonElement>('[data-why]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.why === why)));
    }));
    el.querySelector('#hold-on')!.addEventListener('click', close);
    el.querySelector('#rel')!.addEventListener('click', async () => {
      await releasePromise(p.id, why || undefined); close();
      setMirror('Released. That’s allowed.'); toast('Released. Your slot is free.'); void refreshSlots();
    });
  }, 'Release promise');
}

/** Beta: drop a test orb (no promise) into the current jar. */
export async function dropTestOrb(): Promise<void> {
  if (await jarIsFull()) { toast('This jar is full. Empty it in Beta test mode.'); return; }
  const orb = await makeOrb('test');
  dropOrb(toSpec(orb), () => void refreshCount());
}
export { closeSheet };

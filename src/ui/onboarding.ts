// Onboarding (Mockups v1 › O1–O6): Welcome → How it works → What's hard → What gets in the way → Gentle Help →
// Your first promise. Skippable; answers stay on this phone and only shape Gentle Help (Phase 10).
import { getSettings, updateSettings } from '../db/db';
import { drawStillJar } from '../jar/engine';
import { makePromise, MAX_LEN } from '../logic/promises';
import { safeToSave, wireSoftNote } from './safety';
import { wireGentleHelp } from './gentle';
import { esc } from '../lib/util';
import { cloud, friendlyError, signInWithPasskey, syncNow } from '../lib/cloud';
import { toast } from './kit';
import { showParticles } from './particles';

const HARD: [string, string][] = [
  ['Going to the gym', 'Pack my gym bag tonight'], ['Skincare', 'Wash my face before bed'], ['Sleeping early', 'Phone outside the room at 11'],
  ['Drinking water', 'Drink a glass of water first thing'], ['Reaching out to people', 'Send one message to a friend'],
  ['Starting my business', 'Write down one idea for my business'], ['Studying', 'Open my notes for 10 minutes'],
  ['Saying no', 'Say no to one small thing'], ['Resting', 'Take a 5-minute break'], ['Something else', ''],
];
const BLOCKS: [string, string][] = [
  ['It feels too big', 'I don’t know where to start'], ['No energy', 'I’m tired when it’s time'],
  ['I forget', 'Nothing reminds me at the right moment'], ['It feels scary', 'Being judged, rejected or failing'], ['Not enough time', 'My days are full'],
];
const STEPS = 5; // after Welcome

let root: HTMLElement, done: () => void;
let hard: string[] = [], blocks: string[] = [];

export async function startOnboarding(el: HTMLElement, onDone: () => void): Promise<void> {
  root = el; done = onDone;
  const s = await getSettings(); hard = [...s.hard]; blocks = [...s.blocks];
  showParticles(true);
  welcome();
}

const dots = (i: number) => `<div class="dots" aria-label="Step ${i + 1} of ${STEPS}">${Array.from({ length: STEPS }, (_, k) => `<span${k === i ? ' class="on"' : ''}></span>`).join('')}</div>`;
function page(i: number, body: string, cta: string, opts: { skip?: boolean; secondary?: string } = {}): void {
  root.innerHTML = `<main class="onb"><div class="onb-top">${dots(i)}${opts.skip === false ? '' : '<button class="btn-text" data-skip>Skip</button>'}</div>
<div class="onb-body">${body}</div>
<div class="onb-cta"><button class="btn" data-next>${cta}</button>${opts.secondary ? `<button class="btn-secondary" data-second>${opts.secondary}</button>` : ''}</div></main>`;
  root.querySelector('[data-skip]')?.addEventListener('click', () => void finish());
  window.scrollTo(0, 0);
}
const on = (sel: string, fn: () => void) => root.querySelector(sel)?.addEventListener('click', fn);

function welcome(): void {
  root.innerHTML = `<main class="onb welcome"><div class="onb-body center"><canvas data-jar aria-hidden="true"></canvas>
<h1 class="wordmark" style="font-size:52px">Dear Me<span class="c">,</span></h1><p class="muted lead">A jar of kept promises to yourself.</p></div>
<div class="onb-cta"><button class="btn" data-next>Begin</button><button class="btn-text" data-signin>I have an Innova Space passkey · Sign in</button></div></main>`;
  drawStillJar(root.querySelector('[data-jar]')!, 210, 'classic', []);
  on('[data-next]', how);
  on('[data-signin]', async () => {
    try {
      await signInWithPasskey(); await syncNow();
      if ((await getSettings()).onboarded) { toast('Welcome back. Your jars are here.'); return done(); }
      toast('Signed in. Let\u2019s set up your jar.'); how();
    } catch (e) { toast(friendlyError(e)); }
  });
}

function how(): void {
  page(0, `<h2 class="serif onb-h">Every promise you keep becomes a little light.</h2>
<p class="muted">Make a small promise to yourself. When you keep it, hold it, and an orb drops into your jar. Twelve fill a jar: a chapter of you keeping your word.</p>
<div class="center"><canvas data-jar aria-hidden="true"></canvas></div>
<p class="muted">No streaks. No overdue. Letting a promise go is allowed.</p>`, 'Next');
  drawStillJar(root.querySelector('[data-jar]')!, 190, 'classic', [0, 1, 2, 3, 4].map((k) => ({ id: `w${k}`, inside: 'pearl', color: (k * 5 + 1) % 6, hue: k })));
  on('[data-next]', hardStep);
}

function hardStep(): void {
  page(1, `<h2 class="serif onb-h">Which promises are hard to keep?</h2><p class="muted">Pick any. This helps Dear Me understand you, not judge you.</p>
<div class="chips">${HARD.map(([t]) => `<button class="chip big" data-h="${esc(t)}" aria-pressed="${hard.includes(t)}">${esc(t)}</button>`).join('')}</div>`, 'Next');
  root.querySelectorAll<HTMLButtonElement>('[data-h]').forEach((b) => b.addEventListener('click', () => {
    const t = b.dataset.h!; hard = hard.includes(t) ? hard.filter((x) => x !== t) : [...hard, t];
    b.setAttribute('aria-pressed', String(hard.includes(t)));
  }));
  on('[data-next]', wayStep);
}

function wayStep(): void {
  page(2, `<h2 class="serif onb-h">What usually gets in the way?</h2><p class="muted">There’s always a reason. It’s rarely “I can’t”.</p>
<div class="ways">${BLOCKS.map(([t, d]) => `<button class="way" data-b="${esc(t)}" aria-pressed="${blocks.includes(t)}"><span class="t">${esc(t)}</span><span class="d">${esc(d)}</span></button>`).join('')}</div>`, 'Next');
  root.querySelectorAll<HTMLButtonElement>('[data-b]').forEach((b) => b.addEventListener('click', () => {
    const t = b.dataset.b!; blocks = blocks.includes(t) ? blocks.filter((x) => x !== t) : [...blocks, t];
    b.setAttribute('aria-pressed', String(blocks.includes(t)));
  }));
  on('[data-next]', helpStep);
}

function helpStep(): void {
  page(3, `<h2 class="serif onb-h">Want Gentle Help?</h2>
<p class="muted">When a promise feels big, Gentle Help can suggest a smaller first step. You decide: use it, change it, or ignore it.</p>
<div class="card gh"><span class="kicker">You wrote</span><span class="serif" style="font-size:19px">Go to the gym 3 times a week</span>
<div class="gh-say"><span class="who">Gentle Help</span><span>A smaller first step: pack your gym bag tonight and leave it by the door.</span></div>
<div class="chips"><span class="chip on">Use this</span><span class="chip">Change it</span><span class="chip">No thanks</span></div></div>
<p class="muted small">It needs sign-in and internet, and it’s coming soon. You can turn it off anytime in Settings.</p>`, 'Allow Gentle Help', { skip: false, secondary: 'Not now' });
  on('[data-next]', () => { void updateSettings({ gentleHelp: true }); firstStep(); });
  on('[data-second]', () => { void updateSettings({ gentleHelp: false }); firstStep(); });
}

function firstStep(): void {
  const ideas = HARD.filter(([t, i]) => i && hard.includes(t)).map(([, i]) => i);
  const list = (ideas.length ? ideas : ['Drink a glass of water', 'Pack my gym bag tonight', 'Send one kind message']).slice(0, 4);
  page(4, `<h2 class="serif onb-h">Your first promise</h2><p class="muted">Small is good. You can always make it bigger later.</p>
<label class="field-label" for="p1">I promise myself…</label>
<textarea id="p1" class="field serif" rows="2" maxlength="${MAX_LEN}" placeholder="Something small you can keep"></textarea>
<span class="field-label">${ideas.length ? 'Ideas from what you picked' : 'Ideas'}</span>
<div class="chips">${list.map((i) => `<button class="chip" data-i="${esc(i)}">${esc(i)}</button>`).join('')}</div>`, 'Put it on my jar', { skip: false, secondary: 'I’ll do it later' });
  const ta = root.querySelector<HTMLTextAreaElement>('#p1')!, go = root.querySelector<HTMLButtonElement>('[data-next]')!;
  const sync = () => { go.disabled = !ta.value.trim(); }; sync();
  ta.addEventListener('input', sync); wireSoftNote(ta);
  root.querySelectorAll<HTMLButtonElement>('[data-i]').forEach((c) => c.addEventListener('click', () => { ta.value = c.dataset.i!; sync(); }));
  if (cloud.get().signedIn) void wireGentleHelp(root.querySelector('.chips') ?? ta, ta, { mode: 'first', hard, onSignIn: () => toast('Sign in from Settings › Account after this. Your promise is safe here.') });
  on('[data-next]', async () => { const t = ta.value.trim(); if (!t) return; const save = async () => { await makePromise(t, ta.dataset.from); await finish(); }; if (safeToSave(t, () => void save())) await save(); });
  on('[data-second]', () => void finish());
}

async function finish(): Promise<void> {
  await updateSettings({ onboarded: true, hard, blocks });
  done();
}

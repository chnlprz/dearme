// The Gentle Help box inside a promise field: ask, read one warm line (and maybe a question), tap a smaller version.
import { getSettings } from '../db/db';
import { askGentleHelp, type HelpReq } from '../lib/help';
import { checkText } from '../logic/safety';
import { esc } from '../lib/util';
import { safetySheet } from './safety';

interface Opts { mode: HelpReq['mode']; block?: string; hard?: string[]; label?: string; auto?: boolean; onSignIn: () => void; onPick?: (text: string) => void }

/** Adds the box after `anchor`. Picking an option fills the field; `from` keeps the first wording. */
export async function wireGentleHelp(anchor: HTMLElement, ta: HTMLTextAreaElement, o: Opts): Promise<void> {
  if (!(await getSettings()).gentleHelp) return;
  const box = document.createElement('div');
  box.className = 'hb';
  box.innerHTML = `<button type="button" class="btn-secondary hb-ask">${esc(o.label ?? 'Help me make it smaller')}</button><div class="hb-out" aria-live="polite"></div>`;
  anchor.insertAdjacentElement('afterend', box);
  const out = box.querySelector<HTMLElement>('.hb-out')!, btn = box.querySelector<HTMLButtonElement>('.hb-ask')!;
  let lastAsk = '';

  const run = async (answer?: string) => {
    const text = ta.value.trim() || ta.dataset.from || '';
    if (!text) { out.innerHTML = '<p class="hb-say">Write your promise first, even roughly.</p>'; return; }
    const k = checkText(text + ' ' + (answer ?? ''));
    if (k === 'crisis' || k === 'abuse') { void safetySheet(k); return; }
    btn.disabled = true;
    out.innerHTML = '<p class="hb-say hb-wait">Gentle Help is thinking<span>.</span><span>.</span><span>.</span></p>';
    const r = await askGentleHelp({ mode: o.mode, text, block: o.block, hard: o.hard, ...(answer ? { ask: lastAsk, answer } : {}) });
    btn.disabled = false;
    if ('error' in r) {
      out.innerHTML = r.error === 'signed-out'
        ? '<p class="hb-say">Gentle Help needs you signed in, so it can stay private to you. <button type="button" class="inline hb-in">Sign in</button></p>'
        : `<p class="hb-say">${esc(r.error)}</p>`;
      out.querySelector('.hb-in')?.addEventListener('click', o.onSignIn);
      return;
    }
    if (r.safety !== 'none') { out.innerHTML = r.say ? `<p class="hb-say serif">${esc(r.say)}</p>` : ''; void safetySheet(r.safety); return; }
    lastAsk = r.ask;
    out.innerHTML = `${r.say ? `<p class="hb-say serif">${esc(r.say)}</p>` : ''}
${r.options.length ? `<div class="hb-opts">${r.options.map((x) => `<button type="button" class="hb-opt serif" data-opt="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : ''}
${r.ask && !answer ? `<div class="hb-q"><p class="hb-say">${esc(r.ask)}</p><div class="hb-reply"><input class="field" id="hb-a" maxlength="300" placeholder="Your answer (optional)" aria-label="Your answer"><button type="button" class="btn-text hb-send">Ask again</button></div></div>` : ''}
<p class="hb-note">Just ideas. Pick one, change it, or ignore it.</p>`;
    out.querySelectorAll<HTMLButtonElement>('[data-opt]').forEach((b) => b.addEventListener('click', () => {
      if (!ta.dataset.from) ta.dataset.from = ta.value.trim();
      ta.value = b.dataset.opt!; ta.dispatchEvent(new Event('input')); o.onPick?.(b.dataset.opt!);
      out.querySelectorAll('[data-opt]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    }));
    out.querySelector('.hb-send')?.addEventListener('click', () => { const a = out.querySelector<HTMLInputElement>('#hb-a')!.value.trim(); if (a) void run(a); });
  };
  btn.addEventListener('click', () => void run());
  if (o.auto) void run();
}

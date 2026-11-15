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
  const beta = (await getSettings()).beta;
  const box = document.createElement('div');
  box.className = 'hb';
  box.innerHTML = `<button type="button" class="hb-ask"><span aria-hidden="true">✦</span> ${esc(o.label ?? 'Help me make it smaller')}</button><div class="hb-out" aria-live="polite"></div>`;
  anchor.insertAdjacentElement('afterend', box);
  const out = box.querySelector<HTMLElement>('.hb-out')!, btn = box.querySelector<HTMLButtonElement>('.hb-ask')!;
  // while there are suggestions, the generic ideas step aside
  const scope = ta.closest('.sheet') ?? ta.closest('main') ?? document.body;
  const ideas = [...scope.querySelectorAll<HTMLElement>('.chips')].filter((c) => !c.closest('.hb') && !!c.querySelector('[data-idea], [data-i]'));
  const ideaLabel = ideas.map((c) => c.previousElementSibling as HTMLElement | null).filter((x): x is HTMLElement => !!x && x.matches('.field-label'));
  const showIdeas = (on: boolean) => [...ideas, ...ideaLabel].forEach((x) => { x.style.display = on ? '' : 'none'; });
  let lastAsk = '';

  const run = async (answer?: string) => {
    const text = ta.value.trim() || ta.dataset.from || '';
    if (!text) { out.innerHTML = '<p class="hb-say">Write your promise first, even roughly.</p>'; return; }
    const k = checkText(text + ' ' + (answer ?? ''));
    if (k === 'crisis' || k === 'abuse') { void safetySheet(k); return; }
    btn.disabled = true;
    out.innerHTML = '<p class="hb-say hb-wait">Thinking<span>.</span><span>.</span><span>.</span></p>';
    const r = await askGentleHelp({ mode: o.mode, text, block: o.block, hard: o.hard, ...(answer ? { ask: lastAsk, answer } : {}) });
    btn.disabled = false;
    if ('error' in r) {
      out.innerHTML = r.error === 'signed-out'
        ? '<p class="hb-say">Gentle Help needs you signed in. <button type="button" class="inline hb-in">Sign in</button></p>'
        : `<p class="hb-say">${esc(r.error)} <button type="button" class="inline hb-retry">Try again</button></p>${beta && r.detail ? `<p class="hb-note">${esc(r.detail)}</p>` : ''}`;
      out.querySelector('.hb-in')?.addEventListener('click', o.onSignIn);
      out.querySelector('.hb-retry')?.addEventListener('click', () => void run(answer));
      return;
    }
    if (r.safety !== 'none') { out.innerHTML = r.say ? `<p class="hb-say">${esc(r.say)}</p>` : ''; void safetySheet(r.safety); return; }
    lastAsk = r.ask;
    showIdeas(false);
    out.innerHTML = `${r.say ? `<p class="hb-say">${esc(r.say)}</p>` : ''}
${r.options.length ? `<div class="hb-opts">${r.options.map((x) => `<button type="button" class="hb-opt" data-opt="${esc(x)}"><span>${esc(x.replace(/\.$/, ''))}</span><span class="hb-use">Use</span></button>`).join('')}</div>` : ''}
${r.ask && !answer ? `<div class="hb-q"><p class="hb-say">${esc(r.ask)} <button type="button" class="inline hb-ans">Answer</button></p></div>` : ''}`;
    out.querySelectorAll<HTMLButtonElement>('[data-opt]').forEach((b) => b.addEventListener('click', () => {
      if (!ta.dataset.from) ta.dataset.from = ta.value.trim();
      ta.value = b.dataset.opt!.replace(/\.$/, ''); ta.dispatchEvent(new Event('input')); o.onPick?.(ta.value);
      out.querySelectorAll('[data-opt]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    }));
    out.querySelector('.hb-ans')?.addEventListener('click', () => {
      const q = out.querySelector<HTMLElement>('.hb-q')!;
      q.insertAdjacentHTML('beforeend', '<div class="hb-reply"><input class="field" id="hb-a" maxlength="300" placeholder="A few words" aria-label="Your answer"><button type="button" class="btn-text hb-send">Ask</button></div>');
      out.querySelector<HTMLElement>('.hb-ans')!.remove();
      const inp = out.querySelector<HTMLInputElement>('#hb-a')!; inp.focus();
      const go = () => { const a = inp.value.trim(); if (a) void run(a); };
      out.querySelector('.hb-send')!.addEventListener('click', go);
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    });
  };
  btn.addEventListener('click', () => void run());
  if (o.auto) void run();
}

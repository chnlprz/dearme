// Safety sheets (Bible › Safety): warm and direct, no shame, no lecture. Everything here works offline.
import { getSettings, updateSettings } from '../db/db';
import { COUNTRIES, countryFor, type Country, type Line } from '../logic/hotlines';
import { checkText } from '../logic/safety';
import { esc } from '../lib/util';
import { openSheet } from './sheet';

const lineRow = (l: Line) => `<a class="hot" href="tel:${l.tel}"><span><span class="t">${esc(l.name)}</span><span class="d">${esc(l.note)}</span></span><span class="num">${esc(l.show)}</span></a>`;

function lines(c: Country, kind: 'crisis' | 'abuse'): string {
  const list = kind === 'abuse' && c.abuse.length ? c.abuse : c.crisis;
  const emergencyListed = list.some((l) => l.tel === c.emergency.tel);
  return `<div class="hots">${list.map(lineRow).join('')}</div>
${emergencyListed ? '' : `<p class="sheet-copy">${esc(c.emergency.note)}, call <a class="inline" href="tel:${c.emergency.tel}">${esc(c.emergency.show)}</a>.</p>`}
${kind === 'abuse' && c.abuse.length ? `<p class="sheet-copy">To talk to someone: ${c.crisis.slice(0, 1).map((l) => `<a class="inline" href="tel:${l.tel}">${esc(l.name)} ${esc(l.show)}</a>`).join('')}</p>` : ''}`;
}

function countryPick(c: Country): string {
  return `<label class="hot-country"><span>Not in ${esc(({ PH: 'the Philippines', US: 'the US', GB: 'the UK' } as Record<string, string>)[c.id] ?? c.name)}?</span>
<select id="hcountry" class="pick" aria-label="Country for hotlines">${COUNTRIES.map((x) => `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}<option value="other">Somewhere else</option></select></label>`;
}

const OTHER = `<div class="hots"><a class="hot" href="https://findahelpline.com" target="_blank" rel="noopener"><span><span class="t">Find a Helpline</span><span class="d">Free lines in your country (needs internet)</span></span><span class="num">Open</span></a></div>
<p class="sheet-copy">If you are in danger right now, call your local emergency number.</p>`;

const COPY = {
  crisis: { title: 'Mukhang sobrang bigat ng dala mo ngayon.', body: 'You don’t have to carry this alone. This can’t go in your jar, but you can talk to someone right now. It’s free, private and open all day and night.' },
  help: { title: 'Kailangan mo ba ng kausap?', body: 'Talking to someone can help, even on a day that’s only a little heavy. These lines are free, private and open all day and night.' },
  abuse: { title: 'You deserve to be safe.', body: 'If someone is hurting you, it’s not your fault, and real help is here. You can still keep your promise.' },
} as const;

/** The hotline sheet. kind: crisis (from the safety check), help (from Settings) or abuse. onKeep lets an abuse-flagged promise be saved. */
export async function safetySheet(kind: 'crisis' | 'help' | 'abuse', onKeep?: () => void): Promise<void> {
  const s = await getSettings();
  let other = s.country === 'other';
  const c = countryFor(other ? undefined : s.country);
  const k = kind === 'abuse' ? 'abuse' : 'crisis';
  openSheet(`<p class="serif sheet-title">${COPY[kind].title}</p>
<p class="sheet-copy">${COPY[kind].body}</p>
<div id="hbox">${other ? OTHER : lines(c, k)}</div>
${countryPick(c)}
<a class="btn-secondary" href="sms:">Message someone you trust</a>
${onKeep ? '<button class="btn" id="hkeep">Keep my promise</button>' : ''}
<button class="btn-text" id="hback" style="align-self:center">Back to my jar</button>`, (el, close) => {
    const sel = el.querySelector<HTMLSelectElement>('#hcountry')!;
    if (other) sel.value = 'other';
    sel.addEventListener('change', () => {
      other = sel.value === 'other';
      void updateSettings({ country: sel.value });
      el.querySelector('#hbox')!.innerHTML = other ? OTHER : lines(countryFor(sel.value), k);
    });
    el.querySelector('#hback')!.addEventListener('click', close);
    el.querySelector('#hkeep')?.addEventListener('click', () => { close(); onKeep!(); });
  }, kind === 'crisis' ? 'Support' : 'Help lines');
}

/**
 * Run before saving any promise text. Returns true when it is fine to save now.
 * crisis → never saved, safety sheet. abuse → help sheet with "Keep my promise" (calls save). heavy → saves; the soft line is shown while typing.
 */
export function safeToSave(text: string, save: () => void): boolean {
  const k = checkText(text);
  if (k === 'crisis') { void safetySheet('crisis'); return false; }
  if (k === 'abuse') { void safetySheet('abuse', save); return false; }
  return true;
}

/** A soft line under a promise field when the words sound heavy (not a danger sign): listen first, help is near. */
export function wireSoftNote(ta: HTMLTextAreaElement): void {
  const note = document.createElement('p');
  note.className = 'soft-note'; note.hidden = true;
  note.innerHTML = 'Mukhang mabigat ang pinagdadaanan mo. <button class="inline" type="button">Kailangan mo ng kausap?</button>';
  ta.insertAdjacentElement('afterend', note);
  note.querySelector('button')!.addEventListener('click', () => void safetySheet('help'));
  const sync = () => { note.hidden = checkText(ta.value) !== 'heavy'; };
  ta.addEventListener('input', sync); sync();
}

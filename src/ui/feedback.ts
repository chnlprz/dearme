// Send feedback from inside the app (like Nudge!): saved, then emailed to Innova Space. Works signed in or not.
import { call } from '../lib/cloud';
import { getSettings } from '../db/db';
import { toast } from './kit';
import { openSheet } from './sheet';
import { VERSION } from './shell';

const ADDRESS = 'feedback@innovaspace.app';
const installed = () => matchMedia('(display-mode: standalone)').matches || !!(navigator as { standalone?: boolean }).standalone;

export async function feedbackSheet(): Promise<void> {
  const s = await getSettings();
  let kind = 'Something broke';
  openSheet(`<p class="serif sheet-title">Send feedback</p>
<span class="field-label">What is it?</span>
<div class="chips">${['Something broke', 'An idea', 'Other'].map((t, i) => `<button type="button" class="chip" data-kind="${t}" aria-pressed="${i === 0}">${t}</button>`).join('')}</div>
<label class="field-label" for="fbm">Tell us</label>
<textarea id="fbm" class="field" rows="4" maxlength="4000"></textarea>
<label class="field-label" for="fbr">Your email, if you’d like a reply</label>
<input id="fbr" class="field" type="email" inputmode="email" autocomplete="email" placeholder="Optional">
<div class="row fb-info"><span><span class="t">Include app info</span><span class="d">Version, device, screen size, jar look. Never your promises.</span></span><button class="switch" role="switch" aria-checked="true" aria-label="Include app info" id="fbi"></button></div>
<button class="btn" id="fbsend">Send feedback</button>
<p class="sheet-copy" style="text-align:center">Goes straight to Innova Space. No email app needed.</p>`, (el, close) => {
    el.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach((b) => b.addEventListener('click', () => {
      kind = b.dataset.kind!; el.querySelectorAll('[data-kind]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    }));
    const inf = el.querySelector<HTMLButtonElement>('#fbi')!;
    inf.addEventListener('click', () => inf.setAttribute('aria-checked', String(inf.getAttribute('aria-checked') !== 'true')));
    const send = el.querySelector<HTMLButtonElement>('#fbsend')!;
    send.addEventListener('click', async () => {
      const ta = el.querySelector<HTMLTextAreaElement>('#fbm')!, msg = ta.value.trim();
      if (!msg) { toast('Write a few words first. Nothing was sent.'); ta.focus(); return; }
      const replyTo = el.querySelector<HTMLInputElement>('#fbr')!.value.trim();
      const info = inf.getAttribute('aria-checked') === 'true'
        ? `Dear Me, ${VERSION} · ${installed() ? 'installed app' : 'browser'}\n${navigator.userAgent}\n${screen.width}×${screen.height}\nJar: ${s.style} · ${s.inside} · sound ${s.sound ? 'on' : 'off'} · motion ${s.motion ? 'on' : 'off'}` : '';
      send.disabled = true; send.textContent = 'Sending…';
      try {
        await call('/feedback', { kind, message: msg, replyTo, info, version: VERSION });
        close(); toast('Thank you! Your feedback was sent.');
      } catch {
        send.disabled = false; send.textContent = 'Send feedback';
        const all = msg + (info ? `\n\n— App info —\n${info}` : '');
        setTimeout(() => openSheet(`<p class="serif sheet-title">It didn’t send this time</p>
<p class="sheet-copy">${navigator.onLine ? 'Try again in a moment, or send it by email.' : 'You’re offline. Try again when you’re back online, or send it by email later.'}</p>
<p class="sheet-copy"><b>${ADDRESS}</b></p>
<button class="btn-secondary" data-c="addr">Copy address</button><button class="btn" data-c="msg">Copy message and app info</button>`, (el2, close2) => {
          el2.querySelectorAll<HTMLButtonElement>('[data-c]').forEach((b) => b.addEventListener('click', async () => {
            try { await navigator.clipboard?.writeText(b.dataset.c === 'msg' ? all : ADDRESS); toast('Copied.'); } catch { toast('Couldn’t copy. Nothing changed.'); }
            if (b.dataset.c === 'msg') close2();
          }));
        }, 'Feedback not sent'), 50);
      }
    });
  }, 'Send feedback');
}

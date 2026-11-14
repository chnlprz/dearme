// The level-up card (Mockups v1 › L1): what just opened, and that new looks start with the next promise.
import { drawOrbPreview, drawStillJar } from '../jar/engine';
import { LEVEL_AT } from '../logic/levels';
import { unlocksAt } from '../logic/unlocks';
import { esc } from '../lib/util';

export function showLevelUp(level: number, tryLook: () => void): void {
  const u = unlocksAt(level);
  const back = document.createElement('div');
  back.className = 'lvl-back';
  back.innerHTML = `<div class="lvl" role="dialog" aria-modal="true" aria-label="Level ${level}">
<span class="kicker gold">Level ${level}</span>
<p class="serif lvl-title">${LEVEL_AT[level - 1]} promises kept.<br>Look what opened up.</p>
<div class="lvl-tiles">
${u.slots ? `<div class="tile"><span class="big">${u.slots}</span><span>promise slots</span></div>` : ''}
${u.jar ? `<div class="tile"><canvas data-j aria-hidden="true"></canvas><span>${esc(u.jar.name)} jar</span></div>` : ''}
${u.inside ? `<div class="tile"><canvas data-i aria-hidden="true"></canvas><span>${esc(u.inside.name)} inside</span></div>` : ''}
</div>
<p class="sheet-copy" style="text-align:center">New shapes start with your next promise. Orbs already in your jar keep their look, so your jar grows in layers.</p>
${u.jar || u.inside ? '<button class="btn" data-try>Try a new look</button>' : ''}
<button class="btn-text" data-later>Later</button></div>`;
  document.body.append(back);
  if (u.jar) drawStillJar(back.querySelector('[data-j]')!, 40, u.jar.id, []);
  if (u.inside) drawOrbPreview(back.querySelector('[data-i]')!, u.inside.id, 40);
  const close = () => back.remove();
  back.querySelector('[data-later]')!.addEventListener('click', close);
  back.querySelector('[data-try]')?.addEventListener('click', () => { close(); tryLook(); });
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  setTimeout(() => back.querySelector<HTMLElement>('.btn, .btn-text')?.focus(), 50);
}

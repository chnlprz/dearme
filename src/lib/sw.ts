import { registerSW } from 'virtual:pwa-register';

// Service worker. When a new version is waiting, the next tab tap (no sheet open, not typing)
// or the next return to the screen moves into it. Pattern from Nudge! 2.15 / Noggin?.
sessionStorage.removeItem('dearme-update-ready');
let reg: ServiceWorkerRegistration | undefined, lastCheck = 0;
const ready = () => !!sessionStorage.getItem('dearme-update-ready');
const busy = () => !!document.querySelector('.sheet, [role="dialog"]') || !!document.activeElement?.matches('input, textarea, select');

export const updateSW = registerSW({
  onNeedRefresh() { sessionStorage.setItem('dearme-update-ready', '1'); },
  onRegisteredSW(_url, r) { reg = r; },
});

function check(): void {
  if (!reg || !navigator.onLine || Date.now() - lastCheck < 30_000) return;
  lastCheck = Date.now(); void reg.update().catch(() => {});
}

export function applyUpdate(): void {
  sessionStorage.removeItem('dearme-update-ready');
  sessionStorage.setItem('dearme-updated', '1');
  void updateSW(true);
  setTimeout(() => location.reload(), 1500);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (ready() && !busy()) return applyUpdate();
  check();
});
window.addEventListener('focus', check);
setInterval(check, 15 * 60_000);

document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('.tabbar [data-tab]');
  if (!b) return;
  if (ready() && !busy()) { e.preventDefault(); e.stopImmediatePropagation(); return applyUpdate(); }
  check();
}, true);

/** True once, right after an update reload. */
export function afterUpdate(): boolean {
  const u = !!sessionStorage.getItem('dearme-updated'); sessionStorage.removeItem('dearme-updated');
  return u;
}

import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import { afterUpdate } from './lib/sw';
import { ensureSeeded } from './db/db';
import { isInstalled, requestPersistence } from './lib/storage';
import { mountParticles } from './ui/particles';
import { startShell, VERSION } from './ui/shell';
import { startOnboarding } from './ui/onboarding';
import { getSettings } from './db/db';
import { toast } from './ui/kit';
import { startAutoSync } from './lib/cloud';
import { wireSwipeBack, wireSystemBack } from './ui/gesture';
import { closeSheet } from './ui/sheet';
import { render } from './ui/shell';

// No pinch zoom.
for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });

const app = document.getElementById('app')!;

(async () => {
  await ensureSeeded();
  if (isInstalled()) void requestPersistence();
  mountParticles();
  if ((await getSettings()).onboarded) startShell(app);
  else void startOnboarding(app, () => startShell(app));
  // Sync (when signed in): a change from another device redraws the screen, unless a sheet is open or you're typing.
  startAutoSync(() => { if ((window as { __dmShell?: boolean }).__dmShell && !document.querySelector('.sheet') && !document.activeElement?.matches('input, textarea, select')) void render(); });
  wireSwipeBack(); // swipe right on any screen with a back arrow
  wireSystemBack(closeSheet); // Android back gesture / browser Back = Dear Me's back
  // iOS: after the keyboard closes, a fixed tab bar can stay lifted. Nudge the page so it settles back down.
  document.addEventListener('focusout', (e) => {
    if (!(e.target as HTMLElement).matches?.('input, textarea')) return;
    setTimeout(() => { if (!document.activeElement?.matches('input, textarea')) window.scrollTo(window.scrollX, window.scrollY); }, 120);
  });
  if (afterUpdate()) setTimeout(() => toast(`You're on the new Dear Me, ${VERSION}.`), 400);
})();

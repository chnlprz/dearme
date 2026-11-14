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
  if (afterUpdate()) setTimeout(() => toast(`You're on the new Dear Me, ${VERSION}.`), 400);
})();

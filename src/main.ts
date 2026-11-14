import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import { afterUpdate } from './lib/sw';
import { ensureSeeded } from './db/db';
import { isInstalled, requestPersistence } from './lib/storage';
import { mountParticles } from './ui/particles';
import { startShell, VERSION } from './ui/shell';
import { toast } from './ui/kit';

// No pinch zoom.
for (const ev of ['gesturestart', 'gesturechange']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });

const app = document.getElementById('app')!;

(async () => {
  await ensureSeeded();
  if (isInstalled()) void requestPersistence();
  mountParticles();
  startShell(app); // Onboarding arrives in Phase 6.
  if (afterUpdate()) setTimeout(() => toast(`You're on the new Dear Me, ${VERSION}.`), 400);
})();

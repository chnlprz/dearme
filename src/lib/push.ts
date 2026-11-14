// Evening reminders by Web Push (Phase 9). No account needed: the subscription is this phone, a time and a time zone.
// iPhone: works once Dear Me is added to the Home Screen (iOS 16.4+).
import { call } from './cloud';

export const pushWorks = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const needsInstall = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !(navigator as { standalone?: boolean }).standalone && !matchMedia('(display-mode: standalone)').matches;

const b64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

async function subscription(create: boolean): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready;
  const have = await reg.pushManager.getSubscription();
  if (have || !create) return have;
  const { key } = await call<{ key: string }>('/push/key');
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
}

/** Turn on (or move) the evening reminder. Returns a gentle reason when it can't. */
export async function setReminder(time: string): Promise<string | null> {
  if (needsInstall()) return 'On iPhone, add Dear Me to your Home Screen first (Share › Add to Home Screen), then turn this on there.';
  if (!pushWorks()) return 'This browser can’t show reminders. Your time is saved.';
  if (Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted') return 'Notifications are off for Dear Me. You can allow them in your phone’s settings.';
  try {
    const sub = await subscription(true);
    if (!sub) return 'That didn’t work this time. Try again in a moment.';
    let tz = 'Asia/Manila'; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* default */ }
    await call('/push/set', { sub: sub.toJSON(), time, tz });
    return null;
  } catch { return navigator.onLine ? 'That didn’t work this time. Try again in a moment.' : 'You’re offline. Turn it on again when you’re back online.'; }
}

export async function clearReminder(): Promise<void> {
  try { const sub = await subscription(false); if (sub) { await call('/push/off', { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); } } catch { /* nothing to undo */ }
}

/** Beta: the evening line, right now. */
export async function testReminder(): Promise<string> {
  try { const sub = await subscription(false); if (!sub) return 'Turn on the evening reminder first.'; const r = await call<{ status: number }>('/push/test', { endpoint: sub.endpoint }); return r.status < 300 ? 'Sent. It should arrive in a moment.' : `Push service said ${r.status}.`; }
  catch (e) { return `Didn’t send (${(e as Error).message}).`; }
}

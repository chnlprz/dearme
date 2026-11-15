// Gentle Help (Phase 10): the friction detective. Needs sign-in and internet; called only when you ask.
import { call, cloud } from './cloud';

export interface HelpReq { mode: 'smaller' | 'stuck' | 'first'; text: string; block?: string; hard?: string[]; ask?: string; answer?: string }
export interface HelpRes { say: string; ask: string; options: string[]; safety: 'none' | 'crisis' | 'abuse' }

export async function askGentleHelp(req: HelpReq): Promise<HelpRes | { error: string }> {
  if (!cloud.get().signedIn) return { error: 'signed-out' };
  if (!navigator.onLine) return { error: 'Gentle Help needs internet. Your promise still works offline.' };
  try { return await call<HelpRes>('/help', req); }
  catch (e) {
    const m = (e as Error).message;
    if (m === 'signed-out') return { error: 'signed-out' };
    if (m === 'rest') return { error: 'Gentle Help is resting for today. You can still shape it yourself.' };
    if (m === 'help-off') return { error: 'Gentle Help isn’t switched on yet.' };
    return { error: 'Gentle Help couldn’t answer this time. Try again in a moment.' };
  }
}

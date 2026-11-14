// Offline safety check (Bible › Safety). Works without AI or internet: a built-in list of clear phrases in
// English, Tagalog and Taglish. It only flags clear words; deeper listening is Gentle Help's job (Phase 10).
//  crisis = self-harm or not wanting to live → never saved as a promise, safety sheet with hotlines
//  abuse  = someone hurting the person → point to real help, the promise may still be kept
//  heavy  = sounds heavy but is not a danger sign ("don't give up") → a soft line, nothing blocked

export type SafetyKind = 'crisis' | 'abuse' | 'heavy';

/** lower case, straight quotes, no punctuation, single spaces, apostrophes dropped (don't → dont). */
export function normalize(t: string): string {
  return ` ${t.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[‘’'`]/g, '').replace(/[^a-z0-9\s-]/g, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim()} `;
}

const CRISIS: RegExp[] = [
  // English
  /\bkill(ing)? my ?self\b/, /\bkms\b/, /\bsuicid(e|al)\b/, /\bunalive\b/,
  /\bend(ing)? (my|this|my own) life\b/, /\bend it all\b/, /\btake my (own )?life\b/,
  /\b(hurt|hurting|harm|harming|burn|burning|starve|starving) my ?self\b/, /\bcut(ting)? my ?self\b(?! (some )?slack| a break| off)/, /\bself ?harm/,
  /\b(want|wanna|going|ready) (to )?die\b/, /\bwish i (was|were) dead\b/, /\bbetter off dead\b/,
  /\b(dont|do not) want to (live|be alive|exist|be here anymore|wake up)\b/,
  /\b(no|nothing|no more) reasons? to live\b/, /\btired of (living|life|being alive)\b/,
  /\bhang(ing)? my ?self\b/, /\b(overdose|overdosing|mag ?overdose) (on |sa )?(pills|meds|my meds|gamot|tablets)\b/, /\bmag ?overdose\b/, /\bjump off (a|the) (bridge|building|roof)\b/,
  // Tagalog / Taglish
  /\b(mag|nag|pag)(papa)?kamatay\b/, /\bmagpapakamatay\b/,
  /\b(patayin|papatayin|pinatay|pumatay) (ko )?(na )?(ang |yung |ung )?sarili\b/,
  /\b(saktan|sasaktan|sinasaktan|manakit|nanakit) (ko )?(ang |yung |ung )?sarili\b/,
  /\b(gusto|gustong|gustuhin) (ko )?(na |nang )?(ng )?mamatay\b/, /\bmamatay na (lang|lng)\b/, /\bsana mamatay\b/,
  /\b(ayoko|ayaw ko|ayaw kong) (na |nang )?mabuhay\b/, /\bpagod na (ako|akong) (mabuhay|sa buhay)\b/,
  /\b(wakasan|tapusin|tatapusin|wawakasan) (ko )?(na )?(ang |yung )?buhay\b/,
  /\b(mag|nag)?laslas\b/, /\b(mag|nag)?bibigti\b/, /\bmagbigti\b/, /\b(uminom|iinom|inom) (ng )?lason\b/,
  /\bwala (na |nang )?(saysay|silbi) (ang |yung )?buhay\b/, /\bayoko na sa mundo\b/,
];

const ABUSE: RegExp[] = [
  /\b(he|she|they|my [a-z]+) (hits|beats|chokes|slaps|kicks|hurts|abuses|rapes) me\b/,
  /\b(hitting|beating|choking|slapping|abusing) me\b/, /\b(let|letting) (him|her|them) (hit|hurt|beat|abuse|slap) me\b/,
  /\babusive (partner|relationship|husband|wife|boyfriend|girlfriend|parent|father|mother|home)\b/, /\b(being|been|was|am) abused\b/, /\babused me\b/, /\bdomestic violence\b/,
  /\b(binubugbog|bubugbugin|binugbog|sinasaktan|sinaktan|sinasampal|sinampal|sinisipa|sinipa) (ako|niya ako|nya ako)\b/,
  /\bpinagbubuhatan (ako )?(ng )?kamay\b/,
];

const HEAVY: RegExp[] = [
  /\bgiv(e|ing) up\b/, /\b(susuko|sumuko|sumusuko)\b/, /\bhopeless\b/, /\bwala (na |nang )?pag ?asa\b/,
  /\bpagod na pagod\b/, /\b(di|hindi) ko na kaya\b/, /\bcant (do this|go on|take it) anymore\b/, /\bcant go on\b/,
];

export function checkText(text: string): SafetyKind | null {
  const t = normalize(text);
  if (CRISIS.some((r) => r.test(t))) return 'crisis';
  if (ABUSE.some((r) => r.test(t))) return 'abuse';
  if (HEAVY.some((r) => r.test(t))) return 'heavy';
  return null;
}

/** Guard at the data layer too: a crisis text is never stored as a promise, whatever the UI does. */
export function assertSafe(text: string): void {
  if (checkText(text) === 'crisis') throw new Error('safety');
}

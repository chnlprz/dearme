// Hotlines live in the app (never fetched), so they show instantly offline. Verified Nov 2026; re-check before launch.
export interface Line { name: string; note: string; tel: string; show: string }
export interface Country { id: string; name: string; crisis: Line[]; emergency: Line; abuse: Line[] }

const em = (n: string): Line => ({ name: 'Emergency', note: 'If you are in danger right now', tel: n, show: n });

export const COUNTRIES: Country[] = [
  { id: 'PH', name: 'Philippines',
    crisis: [
      { name: 'NCMH Crisis Hotline', note: 'Landline, toll-free · 24/7', tel: '1553', show: '1553' },
      { name: 'NCMH · Smart/TNT', note: 'Free, confidential · 24/7', tel: '+639190571553', show: '0919 057 1553' },
      { name: 'NCMH · Globe/TM', note: 'Free, confidential · 24/7', tel: '+639178998727', show: '0917 899 8727' },
      { name: 'NCMH · Globe/TM', note: 'Free, confidential · 24/7', tel: '+639663514518', show: '0966 351 4518' },
    ],
    emergency: em('911'),
    abuse: [
      { name: 'Emergency 911', note: 'Also takes violence against women and children', tel: '911', show: '911' },
      { name: 'Aleng Pulis (PNP)', note: 'Call or text', tel: '+639197777377', show: '0919 777 7377' },
    ] },
  { id: 'US', name: 'United States', crisis: [{ name: '988 Suicide & Crisis Lifeline', note: 'Call or text · 24/7', tel: '988', show: '988' }], emergency: em('911'),
    abuse: [{ name: 'National Domestic Violence Hotline', note: '24/7', tel: '18007997233', show: '1-800-799-7233' }] },
  { id: 'CA', name: 'Canada', crisis: [{ name: '988 Suicide Crisis Helpline', note: 'Call or text · 24/7', tel: '988', show: '988' }], emergency: em('911'), abuse: [] },
  { id: 'GB', name: 'United Kingdom', crisis: [{ name: 'Samaritans', note: 'Free · 24/7', tel: '116123', show: '116 123' }], emergency: em('999'), abuse: [] },
  { id: 'IE', name: 'Ireland', crisis: [{ name: 'Samaritans', note: 'Free · 24/7', tel: '116123', show: '116 123' }], emergency: em('112'), abuse: [] },
  { id: 'AU', name: 'Australia', crisis: [{ name: 'Lifeline', note: '24/7', tel: '131114', show: '13 11 14' }], emergency: em('000'), abuse: [] },
  { id: 'ES', name: 'España', crisis: [{ name: 'Línea 024', note: 'Gratis · 24/7', tel: '024', show: '024' }], emergency: em('112'), abuse: [] },
];

const TZ: Record<string, string> = { 'Asia/Manila': 'PH', 'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Madrid': 'ES', 'Atlantic/Canary': 'ES' };

/** The user's pick, else a guess from time zone and language, else the Philippines (Bible: PH first). */
export function countryFor(pick?: string): Country {
  const by = (id?: string) => COUNTRIES.find((c) => c.id === id);
  if (pick && by(pick)) return by(pick)!;
  let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* none */ }
  if (by(TZ[tz])) return by(TZ[tz])!;
  if (tz.startsWith('Australia/')) return by('AU')!;
  const region = (navigator.language.split('-')[1] || '').toUpperCase();
  return by(region) ?? by('PH')!;
}

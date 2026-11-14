export const nowISO = () => new Date().toISOString();
export const uid = () => {
  const b = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(b, (x) => x.toString(36).padStart(2, '0')).join('').slice(0, 18);
};
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** "Sunday · 15 November" in the header. */
export function headerDate(d = new Date()): string {
  const day = d.toLocaleDateString('en-US', { weekday: 'long' });
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  return `${day} · ${date}`;
}

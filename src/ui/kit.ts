// Small shared pieces: icons, toast.
export const icon = {
  jar: '<rect x="8" y="2.5" width="8" height="3.5" rx="1"/><path d="M9 6v1c0 1-4 1.5-4 4.5V19a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 19 19v-7.5C19 8.5 15 8 15 7V6"/>',
  shelf: '<path d="M3 20h18M3 12h18"/><rect x="5" y="5" width="4" height="7" rx="1"/><rect x="11" y="14" width="4" height="6" rx="1"/><rect x="15.5" y="6" width="4" height="6" rx="1"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
};
export const svg = (paths: string, size = 22, sw = 1.6) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

let toastTimer = 0;
export function toast(text: string): void {
  document.querySelector('.toast')?.remove();
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = text;
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.remove(), 2600);
}

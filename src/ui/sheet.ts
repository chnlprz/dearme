// Bottom sheets: one at a time, closes on scrim tap, Escape or a drag down. Focus moves in and back.
let current: { close: () => void } | null = null;

export function openSheet(html: string, onMount?: (el: HTMLElement, close: () => void) => void, label = 'Sheet'): () => void {
  current?.close();
  const back = document.createElement('div');
  back.className = 'sheet-back';
  back.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="${label}"><span class="grab" aria-hidden="true"></span>${html}</div>`;
  const prev = document.activeElement as HTMLElement | null;
  const sheet = back.querySelector<HTMLElement>('.sheet')!;
  const close = () => {
    if (!back.isConnected) return;
    back.classList.add('out');
    setTimeout(() => back.remove(), 200);
    document.removeEventListener('keydown', onKey);
    current = null; prev?.focus?.();
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  document.addEventListener('keydown', onKey);
  // drag the grab handle down to close
  let y0 = -1;
  sheet.addEventListener('pointerdown', (e) => { if ((e.target as HTMLElement).classList.contains('grab')) y0 = e.clientY; });
  sheet.addEventListener('pointerup', (e) => { if (y0 >= 0 && e.clientY - y0 > 60) close(); y0 = -1; });
  document.body.append(back);
  current = { close };
  onMount?.(sheet, close);
  setTimeout(() => sheet.querySelector<HTMLElement>('textarea, input, button:not(.grab)')?.focus(), 60);
  return close;
}

export const closeSheet = () => current?.close();

// Swipe right to go back (like Nudge!): on every screen with a back arrow, the page follows your finger
// and slides away or springs back. Only a sideways swipe counts: a diagonal or up/down move is a scroll.
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(.2,.8,.2,1)';

export function wireSwipeBack(): void {
  const backBtn = () => document.querySelector<HTMLElement>('#main .detail-head .icon-btn');
  const view = () => document.querySelector<HTMLElement>('#main');
  const sideways = (el: HTMLElement | null) => { for (; el && el !== document.body; el = el.parentElement) if (el.scrollWidth > el.clientWidth + 2 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return true; return false; };
  let x0 = 0, y0 = 0, t0 = 0, active = false, mode: 'idle' | 'h' | 'v' = 'idle', dx = 0;
  document.addEventListener('touchstart', (e) => {
    const t = e.touches[0], el = e.target as HTMLElement;
    x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); mode = 'idle'; dx = 0;
    active = e.touches.length === 1 && !!backBtn() && !document.querySelector('.sheet') && !el.closest('.tabbar, input, textarea, select, canvas') && !sideways(el);
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!active) return;
    const t = e.touches[0], mx = t.clientX - x0, my = t.clientY - y0;
    if (mode === 'idle') {
      if (Math.abs(mx) < 10 && Math.abs(my) < 10) return;
      // straight to the right only: within ~25° of horizontal
      mode = mx > 0 && Math.abs(mx) > Math.abs(my) * 2.2 ? 'h' : 'v';
      if (mode === 'v') { active = false; return; }
    }
    e.preventDefault();
    dx = Math.max(0, mx);
    const v = view(); if (v) { v.style.transition = 'none'; v.style.transform = `translateX(${dx}px)`; }
  }, { passive: false });
  const end = () => {
    if (!active || mode !== 'h') { active = false; return; }
    active = false;
    const v = view(); if (!v) return;
    const w = innerWidth, fast = dx > 50 && Date.now() - t0 < 300;
    if (dx > w * 0.33 || fast) {
      const a = v.animate([{ transform: `translateX(${dx}px)` }, { transform: `translateX(${w}px)` }], { duration: calm() ? 0 : 180, easing: 'ease-out', fill: 'forwards' });
      a.onfinish = () => backBtn()?.click();
    } else {
      v.style.transition = `transform 220ms ${EASE}`; v.style.transform = 'none';
      setTimeout(() => { v.style.transition = ''; }, 240);
    }
  };
  document.addEventListener('touchend', end);
  document.addEventListener('touchcancel', end);
}

/** Swipe down to close a sheet: from its top bar, or anywhere once it's scrolled to the top. Straight down only. */
export function wireSheetSwipe(sheet: HTMLElement, dim: HTMLElement, close: () => void): void {
  let x0 = 0, y0 = -1, dy = 0, mode: 'idle' | 'v' | 'no' = 'idle';
  sheet.addEventListener('touchstart', (e) => {
    const t = e.touches[0], top = t.clientY - sheet.getBoundingClientRect().top;
    y0 = -1;
    if (e.touches.length > 1 || (sheet.scrollTop > 0 && top > 56)) return;
    if (top > 56 && (e.target as HTMLElement).closest('input, textarea, select, .chips')) return;
    x0 = t.clientX; y0 = t.clientY; dy = 0; mode = 'idle';
  }, { passive: true });
  sheet.addEventListener('touchmove', (e) => {
    if (y0 < 0 || mode === 'no') return;
    const t = e.touches[0], mx = t.clientX - x0; dy = t.clientY - y0;
    if (mode === 'idle') {
      if (Math.abs(mx) < 10 && Math.abs(dy) < 10) return;
      mode = dy > 0 && dy > Math.abs(mx) * 2.2 && sheet.scrollTop <= 0 ? 'v' : 'no';
      if (mode === 'no') return;
      sheet.style.transition = 'none';
    }
    e.preventDefault();
    sheet.style.transform = `translateY(${Math.max(0, dy)}px)`;
    dim.style.background = `rgba(10, 4, 20, ${Math.max(0.15, 0.55 - dy / 700)})`;
  }, { passive: false });
  sheet.addEventListener('touchend', () => {
    if (y0 < 0 || mode !== 'v') { y0 = -1; return; }
    y0 = -1;
    if (dy > 110) {
      if (calm()) return close();
      sheet.style.transition = 'transform 180ms ease-in'; sheet.style.transform = 'translateY(100%)';
      setTimeout(close, 170);
    } else { sheet.style.transition = 'transform 160ms ease-out'; sheet.style.transform = ''; dim.style.background = ''; }
  });
}

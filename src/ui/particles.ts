// Small glowing particles drifting behind Home, Shelf and Welcome (Bible › Navigation). Off with reduced motion.
const COLORS = ['255,214,240', '215,155,255', '207,216,255', '255,230,170'];

export function mountParticles(n = 34): void {
  if (document.querySelector('.particles')) return;
  const layer = document.createElement('div');
  layer.className = 'particles'; layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    const r = [1, 1, 1.5, 1.5, 2, 2.5][Math.floor(Math.random() * 6)];
    const c = COLORS[Math.floor(Math.random() * COLORS.length)];
    const a = (.45 + Math.random() * .45).toFixed(2);
    const d = 9 + Math.random() * 10;
    s.style.cssText = `left:${(Math.random() * 100).toFixed(1)}%;top:${(Math.random() * 100).toFixed(1)}%;width:${r * 2}px;height:${r * 2}px;` +
      `background:rgba(${c},${a});box-shadow:0 0 ${r * 5}px ${r * 1.5}px rgba(${c},${(+a * .6).toFixed(2)});` +
      `--d:${d.toFixed(1)}s;--dl:${(-Math.random() * d).toFixed(1)}s;--dx:${(Math.random() * 28 - 14).toFixed(0)}px;--dy:${(-20 - Math.random() * 30).toFixed(0)}px`;
    layer.append(s);
  }
  document.body.prepend(layer);
}

export function showParticles(on: boolean): void {
  const l = document.querySelector<HTMLElement>('.particles');
  if (l) l.style.display = on ? '' : 'none';
}

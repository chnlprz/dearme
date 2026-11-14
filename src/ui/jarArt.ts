// The Classic jar as a still picture (Phase 1). Phase 2 replaces Home's jar with the live canvas jar (physics, orbs, cork).
import { esc } from '../lib/util';

let n = 0;
export function jarSVG(label: string): string {
  const u = `j${++n}`;
  const body = 'M80 50 L180 50 L180 68 C180 84 228 88 228 118 L228 296 C228 314 214 322 196 322 L64 322 C46 322 32 314 32 296 L32 118 C32 88 80 84 80 68 Z';
  const L = Math.max(58, label.length * 6.6 + 8);
  return `<svg class="jar-svg" role="img" aria-label="Your jar, ${esc(label)}" viewBox="-20 0 300 340">
<defs>
<linearGradient id="${u}g" x1="0" x2="1"><stop offset="0" stop-color="#ffd9f5" stop-opacity=".22"/><stop offset=".12" stop-color="#ffd9f5" stop-opacity=".07"/><stop offset=".5" stop-color="#ffd9f5" stop-opacity=".03"/><stop offset=".88" stop-color="#ffd9f5" stop-opacity=".07"/><stop offset="1" stop-color="#ffd9f5" stop-opacity=".2"/></linearGradient>
<linearGradient id="${u}c" x1="0" x2="1"><stop offset="0" stop-color="#7a5232"/><stop offset=".35" stop-color="#c99c6a"/><stop offset=".55" stop-color="#d6ab79"/><stop offset="1" stop-color="#6e4628"/></linearGradient>
<radialGradient id="${u}s"><stop offset="0" stop-color="#ffb3dc" stop-opacity=".12"/><stop offset="1" stop-color="#ffb3dc" stop-opacity="0"/></radialGradient>
</defs>
<ellipse cx="130" cy="326" rx="150" ry="22" fill="url(#${u}s)"/>
<path d="${body}" fill="url(#${u}g)"/>
<ellipse cx="130" cy="50" rx="50" ry="8" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="1.5"/>
<path d="M46 132 L46 284" stroke="#fff" stroke-opacity=".24" stroke-width="7" stroke-linecap="round"/>
<path d="M60 140 L60 250" stroke="#fff" stroke-opacity=".14" stroke-width="2.5" stroke-linecap="round"/>
<path d="M212 140 L212 280" stroke="#fff" stroke-opacity=".18" stroke-width="4" stroke-linecap="round"/>
<path d="${body}" fill="none" stroke="#fff3fb" stroke-opacity=".5" stroke-width="2"/>
<path d="M48 302 Q130 322 212 302" fill="none" stroke="#ffd2ea" stroke-opacity=".45" stroke-width="2.5"/>
<rect x="74" y="12" width="112" height="44" rx="9" fill="url(#${u}c)"/><ellipse cx="130" cy="13" rx="56" ry="9" fill="#d9b080"/>
<path d="M84 26 H176 M84 38 H176" stroke="#5b3a20" stroke-opacity=".25"/>
<path d="M80 60 Q130 70 180 60" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2.2"/>
<path d="M180 66 Q206 72 214 92" fill="none" stroke="#e2c3a2" stroke-width="1.3"/>
<g transform="translate(222 110) rotate(24)"><path d="M-10 -15 H${L - 6} Q${L} -15 ${L} -9 V9 Q${L} 15 ${L - 6} 15 H-10 L-22 0 Z" fill="#f5e4d6"/>
<circle cx="-11" cy="0" r="3" fill="#d9c0ad"/><text x="0" y="5" font-family="Fraunces, Georgia, serif" font-style="italic" font-weight="500" font-size="13" fill="#6d3a52">${esc(label)}</text></g>
</svg>`;
}

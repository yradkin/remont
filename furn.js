/* Мебель и техника: параметрическая библиотека. Размеры изделий — мм, сцена — метры.
   Перёд изделия смотрит в +Z, начало координат — центр основания на полу. Подвижные части несут userData.act. */
import * as THREE from 'three';
import { matFor } from './mats.js';

/* ---------- материалы и отделки ---------- */
const MC = new Map();
const M = (color, rough = 0.6, metal = 0, extra) => { const k = color + '|' + rough + '|' + metal + (extra ? JSON.stringify(extra) : ''); if (!MC.has(k)) MC.set(k, new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: metal, envMapIntensity: 0.6 }, extra))); return MC.get(k); };
export const FIN = [
  { id: 'white', name: 'Белый', c: '#f3f1ec' }, { id: 'cream', name: 'Кремовый', c: '#e6dccb' }, { id: 'lgrey', name: 'Светло-серый', c: '#c9c8c4' }, { id: 'grey', name: 'Серый', c: '#8d8f92' },
  { id: 'graph', name: 'Графит', c: '#3d4045' }, { id: 'black', name: 'Чёрный', c: '#1c1d1f' }, { id: 'oakl', name: 'Дуб светлый', c: '#d8c3a0', tex: 'lam-light' }, { id: 'oak', name: 'Дуб', c: '#c19a68', tex: 'lam-nat' },
  { id: 'walnut', name: 'Орех', c: '#765038', tex: 'lam-walnut' }, { id: 'sage', name: 'Шалфей', c: '#9aab92' }, { id: 'blue', name: 'Серо-синий', c: '#7f95a8' }, { id: 'navy', name: 'Тёмно-синий', c: '#34465c' },
  { id: 'terra', name: 'Терракота', c: '#b9735a' }, { id: 'must', name: 'Горчичный', c: '#c9a13f' }, { id: 'rose', name: 'Пыльная роза', c: '#d3a7a0' }, { id: 'green', name: 'Зелёный', c: '#4f6b55' }
];
const finOf = id => FIN.find(f => f.id === id) || FIN[0];
function hard(o) {   // корпусная отделка: цвет или дерево
  const f = finOf(o.f), k = 'hard|' + f.id; if (MC.has(k)) return MC.get(k);
  let m;
  if (f.tex) { const b = matFor(f.tex); m = b.clone(); m.map = b.map.clone(); m.map.repeat.set(0.55, 0.2); m.map.offset.set(0.1, 0.03); m.map.needsUpdate = true; }
  else m = new THREE.MeshStandardMaterial({ color: f.c, roughness: 0.45, envMapIntensity: 0.6 });
  MC.set(k, m); return m;
}
const soft = o => M(finOf(o.f).c, 0.97, 0, { envMapIntensity: 0.25 });
const STEEL = () => M('#c7cacd', 0.28, 0.9), DARK = () => M('#232427', 0.6), WHITE = () => M('#f6f5f2', 0.22), CHROME = () => M('#dfe2e5', 0.12, 1);
const GLASS = () => M('#cfe3ef', 0.05, 0, { transparent: true, opacity: 0.28, depthWrite: false });
const MIRROR = () => M('#e8eef2', 0.03, 1, { envMapIntensity: 1.4 });

/* ---------- примитивы ---------- */
const mm = v => v / 1000;
function bx(g, w, h, d, x, y, z, mat, sh = true) { const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(w, 0.002), Math.max(h, 0.002), Math.max(d, 0.002)), mat); m.position.set(x, y, z); m.castShadow = sh; m.receiveShadow = true; g.add(m); return m; }
function cy(g, r, h, x, y, z, mat, r2, seg = 28) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r2 ?? r, r, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; }
const grp = (g, x = 0, y = 0, z = 0) => { const p = new THREE.Group(); p.position.set(x, y, z); g.add(p); return p; };
const act = (p, a) => { p.userData.act = Object.assign({ t: 0, target: 0 }, a); return p; };
function handle(p, x, y, z, vert, len = 0.14) { const m = CHROME(); vert ? bx(p, 0.012, len, 0.024, x, y, z + 0.012, m) : bx(p, len, 0.012, 0.024, x, y, z + 0.012, m); }

/* ---------- корпус: ряды снизу вверх [{h: доля, k: drawer|door|doors|glass|flap|lift|slide|open|fix, n: в ряд}] ---------- */
function cab(g, o, s) {
  const W = mm(o.w), D = mm(o.d), H = mm(o.h), t = 0.018, pl = s.plinth || 0, top = s.top || 0, over = s.over || 0;
  const body = s.body || hard(o), front = s.front || hard(o), y0 = pl, hh = H - pl - top, fd = D / 2;
  if (pl) { if (s.legs) [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => bx(g, 0.03, pl, 0.03, a * (W / 2 - 0.04), pl / 2, b * (D / 2 - 0.04), DARK())); else bx(g, W - 0.004, pl, D - 0.06, 0, pl / 2, -0.02, DARK()); }
  bx(g, t, hh, D, -W / 2 + t / 2, y0 + hh / 2, 0, body); bx(g, t, hh, D, W / 2 - t / 2, y0 + hh / 2, 0, body);
  bx(g, W - 2 * t, t, D, 0, y0 + t / 2, 0, body); bx(g, W - 2 * t, t, D, 0, y0 + hh - t / 2, 0, body); bx(g, W - 2 * t, hh, 0.006, 0, y0 + hh / 2, -D / 2 + 0.003, body);
  if (top) bx(g, W + over * 2, top, D + over, 0, H - top / 2, over / 2, s.topMat || M('#34363a', 0.35));
  const tot = s.rows.reduce((a, r) => a + r.h, 0); let y = y0;
  s.rows.forEach(r => {
    const rh = hh * r.h / tot, k = r.k, n = (r.n || 1) * (k === 'doors' ? 2 : 1), cw = W / n, gap = 0.003, cyy = y + rh / 2, fh = rh - gap;
    if (y > y0 + 0.001) bx(g, W - 2 * t, t, D - 0.02, 0, y, 0, body);
    if (rh > 0.62 && k !== 'drawer' && k !== 'fix' && !r.empty) { const ns = Math.floor(rh / 0.36); for (let j = 1; j <= ns; j++) if (!(s.rail && j > ns - 3)) bx(g, W - 2 * t, t, D - 0.04, 0, y + rh * j / (ns + 1), -0.01, body); if (s.rail) cy(g, 0.012, W - 2 * t, 0, y + rh - 0.09, 0, CHROME()).rotation.z = Math.PI / 2; }
    for (let i = 0; i < n; i++) {
      const cx = -W / 2 + cw * (i + 0.5), fw = cw - gap, fm = k === 'glass' ? GLASS() : (r.mirror && i % 2 ? MIRROR() : (r.front || front));
      if (k !== 'doors' && n > 1 && i > 0 && k !== 'slide') bx(g, t, rh, D - 0.02, -W / 2 + cw * i, cyy, 0, body);
      if (k === 'drawer') {
        const p = act(grp(g, cx, cyy, 0), { kind: 'pos', axis: 'z', base: 0, to: Math.min((D - 0.06) * 0.8, 0.45) });
        bx(p, fw, fh, t, 0, 0, fd + t / 2, fm); const bw = cw - 2 * t - 0.012, bh = Math.max(0.04, fh - 0.05), bd = D - 0.06, sm = M('#e9e6df', 0.7);
        bx(p, bw, 0.008, bd, 0, -bh / 2, 0.01, sm); bx(p, 0.012, bh, bd, -bw / 2, 0, 0.01, sm); bx(p, 0.012, bh, bd, bw / 2, 0, 0.01, sm); bx(p, bw, bh, 0.012, 0, 0, -bd / 2 + 0.016, sm);
        if (!s.noHandle) handle(p, 0, fh > 0.26 ? fh / 2 - 0.05 : 0, fd + t, false, Math.min(0.18, fw * 0.4));
      } else if (k === 'door' || k === 'doors' || k === 'glass') {
        const left = k === 'doors' ? i % 2 === 0 : (r.hinge ? r.hinge === 'l' : i < n / 2), sx = left ? 1 : -1;
        const p = act(grp(g, cx - sx * fw / 2, cyy, fd), { kind: 'rot', axis: 'y', to: -sx * 1.75 });
        bx(p, fw, fh, t, sx * fw / 2, 0, t / 2, fm, k !== 'glass');
        if (!s.noHandle) fh > fw * 1.2 ? handle(p, sx * (fw - 0.04), Math.max(-fh / 2 + 0.1, Math.min(fh / 2 - 0.1, 1.0 - cyy - mm(o.y || 0))), t, true) : handle(p, sx * (fw - 0.1), -fh / 2 + 0.05 + (cyy > 1.3 ? 0 : fh - 0.1), t, false, 0.12);
      } else if (k === 'flap' || k === 'lift') {
        const up = k === 'lift', p = act(grp(g, cx, up ? y + rh - gap / 2 : y + gap / 2, fd), { kind: 'rot', axis: 'x', to: up ? -1.75 : (s.flapTo || 1.57) });
        bx(p, fw, fh, t, 0, (up ? -1 : 1) * fh / 2, t / 2, fm);
        if (r.window) bx(p, fw * 0.72, fh * 0.55, 0.004, 0, fh * 0.45, t + 0.002, M('#0b0c0e', 0.1, 0.2));
        if (!s.noHandle) handle(p, 0, (up ? -1 : 1) * (fh - 0.05), t, false, Math.min(0.4, fw * 0.6));
      } else if (k === 'slide') {
        const p = act(grp(g, cx, cyy, fd + (i % 2 ? 0.006 : 0.03)), { kind: 'pos', axis: 'x', base: cx, to: (i % 2 ? -1 : 1) * (cw - 0.04) * (i === n - 1 && n % 2 ? -1 : 1) });
        bx(p, cw + 0.02, fh, 0.02, 0, 0, 0, fm); bx(p, 0.02, fh, 0.026, (i % 2 ? 1 : -1) * (cw / 2 - 0.01), 0, 0.002, CHROME());
      } else if (k === 'fix') bx(g, fw, fh, t, cx, cyy, fd + t / 2, fm);
    }
    y += rh;
  });
}

/* ---------- мягкая мебель, столы, сантехника ---------- */
function sofa(g, o, s = {}) {
  const W = mm(o.w), D = mm(o.d), H = mm(o.h), f = soft(o), arm = s.noArms ? 0 : Math.min(0.18, W * 0.14), sh = 0.43, dd = s.chaise ? Math.min(0.98, D) : D, zb = -D / 2;
  [[-1, 0], [1, 0], [-1, 1], [1, 1]].forEach(([a, b]) => cy(g, 0.022, 0.1, a * (W / 2 - 0.07), 0.05, zb + 0.07 + b * (dd - 0.14), DARK()));
  bx(g, W, 0.2, dd, 0, 0.2, zb + dd / 2, f); bx(g, W, H - 0.3, 0.2, 0, 0.3 + (H - 0.3) / 2, zb + 0.1, f);
  if (arm) [-1, 1].forEach(a => bx(g, arm, sh + 0.2 - 0.1, dd, a * (W / 2 - arm / 2), 0.1 + (sh + 0.1) / 2, zb + dd / 2, f));
  const iw = W - 2 * arm, n = Math.max(1, Math.round(iw / 0.75)), cw = iw / n, f2 = M(finOf(o.f).c, 0.9, 0, { envMapIntensity: 0.3 });
  for (let i = 0; i < n; i++) { const x = -iw / 2 + cw * (i + 0.5); bx(g, cw - 0.012, 0.14, dd - 0.22, x, sh - 0.06, zb + 0.2 + (dd - 0.2) / 2, f2); bx(g, cw - 0.03, H - sh - 0.08, 0.14, x, sh + (H - sh - 0.08) / 2 + 0.01, zb + 0.27, f2).rotation.x = -0.14; }
  if (s.chaise) { const cwid = Math.min(0.95, W * 0.4), x = (s.chaise === 'r' ? 1 : -1) * (W / 2 - cwid / 2); bx(g, cwid, 0.2, D - dd, x, 0.2, zb + dd + (D - dd) / 2, f); bx(g, cwid - 0.02, 0.14, D - dd, x, sh - 0.06, zb + dd + (D - dd) / 2, f2); [-1, 1].forEach(a => cy(g, 0.022, 0.1, x + a * (cwid / 2 - 0.06), 0.05, D / 2 - 0.07, DARK())); }
}
function bed(g, o, s = {}) {
  const W = mm(o.w), D = mm(o.d), H = mm(o.h), f = s.wood ? hard(o) : soft(o), zb = -D / 2;
  bx(g, W, 0.24, D, 0, 0.2, 0, f); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => bx(g, 0.05, 0.08, 0.05, a * (W / 2 - 0.05), 0.04, b * (D / 2 - 0.05), DARK()));
  bx(g, W, H, 0.08, 0, H / 2, zb + 0.04, f); bx(g, W - 0.06, 0.2, D - 0.14, 0, 0.42, 0.03, M('#f4f2ee', 0.95));
  const np = W > 1.15 ? 2 : 1, pw = Math.min(0.68, W / np - 0.1); for (let i = 0; i < np; i++) bx(g, pw, 0.12, 0.42, (i - (np - 1) / 2) * (pw + 0.06), 0.57, zb + 0.36, M('#ffffff', 0.95)).rotation.x = -0.12;
  bx(g, W - 0.02, 0.07, D * 0.6, 0, 0.54, D / 2 - D * 0.3 - 0.02, M(s.blanket || '#b8b2a6', 1, 0, { envMapIntensity: 0.2 }));
  if (s.rails) [-1, 1].forEach(a => { bx(g, 0.025, 0.4, D, a * (W / 2 - 0.012), 0.72, 0, f); });
}
function table(g, o, s = {}) {
  const W = mm(o.w), D = mm(o.d), H = mm(o.h), m = hard(o);
  if (s.round) { cy(g, W / 2, 0.03, 0, H - 0.015, 0, m, W / 2, 48); cy(g, 0.05, H - 0.05, 0, (H - 0.03) / 2, 0, DARK()); cy(g, W * 0.3, 0.02, 0, 0.01, 0, DARK()); return; }
  bx(g, W, 0.032, D, 0, H - 0.016, 0, m); const lm = s.metal ? DARK() : m, l = s.metal ? 0.03 : 0.055;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => bx(g, l, H - 0.032, l, a * (W / 2 - 0.06), (H - 0.032) / 2, b * (D / 2 - 0.06), lm));
  if (s.shelf) bx(g, W - 0.14, 0.018, D - 0.14, 0, 0.14, 0, m);
}
function chair(g, o, s = {}) {
  const W = mm(o.w), D = mm(o.d), H = mm(o.h), sh = s.bar ? 0.75 : 0.46, f = soft(o), l = DARK();
  if (s.office) { cy(g, 0.03, sh - 0.12, 0, (sh - 0.12) / 2 + 0.06, 0, CHROME()); for (let i = 0; i < 5; i++) { const b = bx(g, 0.3, 0.03, 0.045, 0, 0.06, 0, l); b.rotation.y = i * Math.PI * 0.4; b.translateX(0.15); cy(g, 0.025, 0.04, Math.cos(-i * Math.PI * 0.4) * 0.29, 0.02, Math.sin(-i * Math.PI * 0.4) * 0.29, l); } }
  else if (s.bar || s.stool) { if (s.bar) { cy(g, 0.025, sh, 0, sh / 2, 0, CHROME()); cy(g, 0.2, 0.02, 0, 0.01, 0, CHROME()); cy(g, 0.14, 0.012, 0, 0.3, 0, CHROME()); } else [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => cy(g, 0.016, sh, a * (W / 2 - 0.05), sh / 2, b * (D / 2 - 0.05), l)); }
  else [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => bx(g, 0.03, b < 0 ? H : sh, 0.03, a * (W / 2 - 0.03), (b < 0 ? H : sh) / 2, b * (D / 2 - 0.03), l));
  if (s.stool || s.bar) cy(g, W / 2, 0.06, 0, sh, 0, f, W / 2 - 0.01, 32); else bx(g, W, 0.07, D, 0, sh, 0, f);
  if (!s.stool) bx(g, W - (s.bar ? 0.08 : 0.02), s.bar ? 0.2 : H - sh - 0.12, 0.05, 0, s.bar ? sh + 0.2 : sh + 0.1 + (H - sh - 0.12) / 2, -D / 2 + 0.04, f).rotation.x = -0.1;
  if (s.office) [-1, 1].forEach(a => { bx(g, 0.05, 0.03, D * 0.6, a * (W / 2), sh + 0.2, 0, l); bx(g, 0.03, 0.2, 0.03, a * (W / 2), sh + 0.1, 0.02, l); });
}
function lampLight(g, y, power, shade) { const l = new THREE.PointLight('#ffd9a8', 0, 7, 1.6); l.position.set(0, y, 0); g.add(l); act(g, { kind: 'light', light: l, on: power, glow: shade }); return l; }
function builtin(g, o, kind) {
  const W = mm(o.w), D = mm(o.d), H = mm(o.h), w = WHITE();
  if (kind === 'bath') { const t = 0.06; bx(g, W, 0.14, D, 0, 0.07, 0, w); [[W, t, 0, D / 2 - t / 2], [W, t, 0, -D / 2 + t / 2]].forEach(([a, b, x, z]) => bx(g, a, H - 0.14, b, x, 0.14 + (H - 0.14) / 2, z, w)); [-1, 1].forEach(a => bx(g, t, H - 0.14, D - 2 * t, a * (W / 2 - t / 2), 0.14 + (H - 0.14) / 2, 0, w)); cy(g, 0.012, 0.16, -W / 2 + 0.12, H + 0.08, -D / 2 + 0.05, CHROME()); bx(g, 0.03, 0.03, 0.14, -W / 2 + 0.12, H + 0.15, -D / 2 + 0.11, CHROME()); }
  else if (kind === 'shower') { bx(g, W, 0.06, D, 0, 0.03, 0, w); const gl = GLASS(), c = CHROME(); bx(g, 0.008, H - 0.06, D, W / 2 - 0.01, H / 2 + 0.03, 0, gl, false); bx(g, W / 2, H - 0.06, 0.008, -W / 4, H / 2 + 0.03, D / 2 - 0.01, gl, false);
    const p = act(grp(g, W / 2 - 0.012, H / 2 + 0.03, D / 2 - 0.01), { kind: 'rot', axis: 'y', to: 1.5 }); bx(p, W / 2 - 0.02, H - 0.08, 0.008, -(W / 2 - 0.02) / 2, 0, 0, gl, false); bx(p, 0.02, 0.3, 0.03, -(W / 2 - 0.06), 0, 0.02, c);
    bx(g, W, 0.025, 0.025, 0, H, D / 2 - 0.012, c); bx(g, 0.025, 0.025, D, W / 2 - 0.012, H, 0, c); cy(g, 0.012, 1.1, -W / 2 + 0.08, 1.5, -D / 2 + 0.06, c); cy(g, 0.1, 0.012, -W / 2 + 0.2, 2.05, -D / 2 + 0.2, c); }
  else if (kind === 'toilet') { bx(g, 0.36, 0.38, 0.17, 0, 0.62, -D / 2 + 0.085, w); const b = cy(g, 0.13, 0.4, 0, 0.2, 0.06, w, 0.185); b.scale.z = (D - 0.2) / 0.37; const p = act(grp(g, 0, 0.41, -D / 2 + 0.19), { kind: 'rot', axis: 'x', to: -1.7 }); const l = cy(p, 0.19, 0.022, 0, 0.011, (D - 0.2) / 2, w, 0.19); l.scale.z = (D - 0.2) / 0.38; bx(g, 0.05, 0.012, 0.03, 0.1, 0.815, -D / 2 + 0.085, CHROME()); }
  else if (kind === 'washer') { bx(g, W, H, D - 0.02, 0, H / 2, -0.01, w); bx(g, W - 0.02, 0.1, 0.012, 0, H - 0.07, D / 2 - 0.004, M('#2b2d30', 0.3)); const r = Math.min(W, H) * 0.3, p = act(grp(g, -r - 0.01, H * 0.47, D / 2), { kind: 'rot', axis: 'y', to: -1.9 }); const ring = cy(p, r, 0.03, r + 0.01, 0, 0.015, CHROME(), r, 40); ring.rotation.x = Math.PI / 2; const gls = cy(p, r * 0.78, 0.034, r + 0.01, 0, 0.016, M('#15181c', 0.08, 0.3), r * 0.78, 40); gls.rotation.x = Math.PI / 2; const hole = cy(g, r * 0.8, 0.01, 0, H * 0.47, D / 2 - 0.016, M('#0b0c0e', 0.5), r * 0.8, 40); hole.rotation.x = Math.PI / 2; }
  else if (kind === 'radiator') { const n = Math.max(3, Math.round(W / 0.08)); for (let i = 0; i < n; i++) bx(g, 0.06, H, D - 0.02, -W / 2 + (i + 0.5) * W / n, H / 2, 0, w); bx(g, W, 0.03, D, 0, H - 0.04, 0, w); bx(g, W, 0.03, D, 0, 0.04, 0, w); }
  else if (kind === 'ac') { bx(g, W, H, D, 0, H / 2, 0, w); bx(g, W - 0.06, 0.02, 0.01, 0, 0.05, D / 2, M('#3a3c40', 0.5)); const p = act(grp(g, 0, 0.012, D / 2 - 0.01), { kind: 'rot', axis: 'x', to: 0.9 }); bx(p, W - 0.04, 0.012, 0.07, 0, 0, -0.035, w); }
  else if (kind === 'tv') { bx(g, W, H, 0.03, 0, H / 2, 0, M('#141517', 0.5)); bx(g, W - 0.02, H - 0.02, 0.004, 0, H / 2, 0.016, M('#07080a', 0.08, 0.4, { envMapIntensity: 1.2 }), false); if (!o.y) { bx(g, 0.04, 0.08, 0.04, 0, -0.03, 0, DARK()); bx(g, W * 0.4, 0.015, D, 0, -0.07, 0, DARK()); g.children.forEach(c => { c.position.y += 0.08; }); } }
  else if (kind === 'mirror') { bx(g, W, H, 0.02, 0, H / 2, 0, hard(o)); bx(g, W - 0.04, H - 0.04, 0.004, 0, H / 2, 0.011, MIRROR(), false); }
  else if (kind === 'hood') { bx(g, W, 0.06, D, 0, 0.03, 0, STEEL()); bx(g, W * 0.45, H - 0.06, D * 0.55, 0, 0.06 + (H - 0.06) / 2, -D * 0.2, STEEL()); }
  else if (kind === 'rug') { bx(g, W, 0.012, D, 0, 0.006, 0, soft(o), false); bx(g, W - 0.24, 0.002, D - 0.24, 0, 0.0125, 0, M('#ffffff', 1, 0, { transparent: true, opacity: 0.12 }), false); }
  else if (kind === 'plant') { cy(g, W * 0.3, H * 0.28, 0, H * 0.14, 0, M('#b9735a', 0.8), W * 0.36); cy(g, 0.012, H * 0.4, 0, H * 0.45, 0, M('#5a4334', 0.9)); const lm = M('#4f7a52', 0.8); [[0, 0.72, 0, 0.5], [0.12, 0.6, 0.06, 0.34], [-0.1, 0.63, -0.08, 0.36], [0.02, 0.86, -0.04, 0.3]].forEach(([x, y, z, r]) => { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(W * r, 1), lm); s.position.set(x * W * 2, y * H, z * W * 2); s.scale.y = 1.25; s.castShadow = true; g.add(s); }); }
  else if (kind === 'flamp') { cy(g, 0.15, 0.02, 0, 0.01, 0, DARK()); cy(g, 0.012, H - 0.3, 0, (H - 0.3) / 2, 0, DARK()); const sm = new THREE.MeshStandardMaterial({ color: '#efe6d6', roughness: 0.9, emissive: '#ffcf96', emissiveIntensity: 0, side: THREE.DoubleSide }); cy(g, W / 2, 0.28, 0, H - 0.14, 0, sm, W / 2 - 0.05, 32); lampLight(g, H - 0.2, 9, sm); }
  else if (kind === 'clamp') { const sm = new THREE.MeshStandardMaterial({ color: '#f6f1e6', roughness: 0.6, emissive: '#ffe2bd', emissiveIntensity: 0 }); cy(g, W / 2, H, 0, H / 2, 0, sm, W / 2 - 0.02, 40); lampLight(g, -0.12, 16, sm); }
  else if (kind === 'hanger') { bx(g, W, 0.12, 0.02, 0, H - 0.06, 0, hard(o)); const n = Math.max(3, Math.round(W / 0.16)); for (let i = 0; i < n; i++) cy(g, 0.01, 0.06, -W / 2 + (i + 0.5) * W / n, H - 0.06, 0.04, CHROME()).rotation.x = Math.PI / 2; bx(g, W, 0.02, D, 0, H + 0.01, D / 2 - 0.01, hard(o)); }
  else if (kind === 'shelf') bx(g, W, H, D, 0, H / 2, 0, hard(o));
  else if (kind === 'bench') { bx(g, W, 0.08, D, 0, H - 0.04, 0, soft(o)); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => bx(g, 0.035, H - 0.08, 0.035, a * (W / 2 - 0.04), (H - 0.08) / 2, b * (D / 2 - 0.04), DARK())); bx(g, W - 0.1, 0.018, D - 0.06, 0, 0.14, 0, M('#765038', 0.6)); }
  else if (kind === 'pouf') cy(g, W / 2, H, 0, H / 2, 0, soft(o), W / 2 - 0.02, 36);
}
function vanity(g, o) { const W = mm(o.w), D = mm(o.d), H = mm(o.h); cab(g, { ...o, h: o.h - 120 }, { plinth: 0.2, legs: true, rows: [{ h: 1, k: 'drawer' }, { h: 1, k: 'drawer' }] }); bx(g, W + 0.01, 0.12, D + 0.01, 0, H - 0.06, 0, WHITE()); bx(g, W - 0.14, 0.004, D - 0.2, 0, H + 0.001, 0.02, M('#d9dcdf', 0.2), false); cy(g, 0.013, 0.2, 0, H + 0.1, -D / 2 + 0.06, CHROME()); bx(g, 0.022, 0.022, 0.13, 0, H + 0.19, -D / 2 + 0.12, CHROME()); }
function sinkBase(g, o) { cab(g, o, K_BASE([{ h: 1, k: 'doors' }])); const W = mm(o.w), D = mm(o.d), H = mm(o.h); bx(g, W - 0.14, 0.006, D - 0.2, 0, H + 0.002, 0.02, STEEL(), false); bx(g, W - 0.2, 0.002, D - 0.26, 0, H + 0.006, 0.02, M('#8d9196', 0.4, 0.8), false); cy(g, 0.014, 0.28, 0, H + 0.14, -D / 2 + 0.07, CHROME()); bx(g, 0.024, 0.024, 0.18, 0, H + 0.27, -D / 2 + 0.15, CHROME()); }
function stove(g, o) { cab(g, o, { plinth: 0.1, top: 0.03, topMat: M('#0d0e10', 0.12, 0.3), front: STEEL(), body: STEEL(), rows: [{ h: 0.2, k: 'drawer' }, { h: 0.62, k: 'flap', window: 1 }, { h: 0.12, k: 'fix', front: M('#1a1b1e', 0.3) }] }); const W = mm(o.w), D = mm(o.d), H = mm(o.h); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => cy(g, 0.08 + (a * b > 0 ? 0.015 : 0), 0.003, a * W * 0.22, H + 0.0015, b * D * 0.2, M('#3a3c40', 0.4))); }
function desk(g, o) { const W = mm(o.w), D = mm(o.d), H = mm(o.h), m = hard(o); bx(g, W, 0.03, D, 0, H - 0.015, 0, m); bx(g, 0.03, H - 0.03, D - 0.04, -W / 2 + 0.015, (H - 0.03) / 2, 0, m); const s = grp(g, W / 2 - 0.21, 0, 0); cab(s, { ...o, w: 420, d: o.d - 40, h: o.h - 30 }, { rows: [{ h: 1, k: 'drawer' }, { h: 1, k: 'drawer' }, { h: 1, k: 'drawer' }] }); bx(g, W - 0.46, 0.3, 0.018, -0.21, H - 0.2, -D / 2 + 0.05, m); }
function bunk(g, o) { const W = mm(o.w), D = mm(o.d), H = mm(o.h), m = hard(o); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => bx(g, 0.06, H, 0.06, a * (W / 2 - 0.03), H / 2, b * (D / 2 - 0.03), m)); [0.3, 1.25].forEach(y => { bx(g, W, 0.12, D, 0, y, 0, m); bx(g, W - 0.14, 0.14, D - 0.14, 0, y + 0.13, 0, M('#f4f2ee', 0.95)); bx(g, W - 0.16, 0.06, D * 0.55, 0, y + 0.22, D * 0.2, M(y > 1 ? '#8aa0b2' : '#c9a13f', 1)); bx(g, 0.5, 0.09, 0.36, 0, y + 0.24, -D / 2 + 0.3, M('#ffffff', 0.95)); }); bx(g, W, 0.3, 0.03, 0, 1.6, -D / 2 + 0.015, m); bx(g, 0.03, 0.3, D * 0.6, -W / 2 + 0.015, 1.6, -D * 0.2, m); bx(g, 0.03, 0.3, D, W / 2 - 0.015, 1.6, 0, m); for (let i = 0; i < 4; i++) bx(g, 0.03, 0.03, 0.4, -W / 2 - 0.005, 0.35 + i * 0.28, D / 2 - 0.26, m); }
const K_BASE = rows => ({ plinth: 0.1, top: 0.038, over: 0.02, rows });

/* ---------- каталог ---------- */
export const CATS = [['living', 'Гостиная'], ['bed', 'Спальня'], ['kitchen', 'Кухня'], ['bath', 'Ванная'], ['hall', 'Прихожая'], ['work', 'Кабинет и детская'], ['tech', 'Техника и свет'], ['decor', 'Декор']];
const C = (id, cat, name, w, d, h, b, x) => Object.assign({ id, cat, name, w, d, h, b, f: 'white' }, x);
const dr = n => Array.from({ length: n }, () => ({ h: 1, k: 'drawer' }));
export const CATALOG = [
  C('sofa2', 'living', 'Диван 2-местный', 1600, 900, 820, (g, o) => sofa(g, o), { f: 'lgrey', seat: 1 }), C('sofa3', 'living', 'Диван 3-местный', 2200, 950, 820, (g, o) => sofa(g, o), { f: 'sage', seat: 1 }),
  C('sofaL', 'living', 'Диван угловой, левый', 2600, 1650, 820, (g, o) => sofa(g, o, { chaise: 'l' }), { f: 'grey', seat: 1 }), C('sofaR', 'living', 'Диван угловой, правый', 2600, 1650, 820, (g, o) => sofa(g, o, { chaise: 'r' }), { f: 'cream', seat: 1 }),
  C('arm', 'living', 'Кресло', 850, 850, 800, (g, o) => sofa(g, o), { f: 'must', seat: 1 }), C('pouf', 'living', 'Пуф', 500, 500, 420, (g, o) => builtin(g, o, 'pouf'), { f: 'terra', seat: 1 }),
  C('coffee', 'living', 'Журнальный стол', 1000, 550, 420, (g, o) => table(g, o, { shelf: 1 }), { f: 'oak' }), C('coffeeR', 'living', 'Стол круглый низкий', 700, 700, 450, (g, o) => table(g, o, { round: 1 }), { f: 'walnut' }),
  C('tvst', 'living', 'ТВ-тумба 1800', 1800, 400, 480, (g, o) => cab(g, o, { plinth: 0.12, legs: true, rows: [{ h: 1, k: 'drawer', n: 3 }] }), { f: 'oakl' }), C('tvst2', 'living', 'ТВ-тумба с дверцами', 1500, 420, 550, (g, o) => cab(g, o, { plinth: 0.1, legs: true, rows: [{ h: 1, k: 'flap', n: 2 }, { h: 0.45, k: 'open' }], flapTo: 1.4 }), { f: 'graph' }),
  C('book', 'living', 'Стеллаж открытый', 800, 320, 2000, (g, o) => cab(g, o, { rows: [1, 1, 1, 1, 1].map(() => ({ h: 1, k: 'open', empty: 1 })) }), { f: 'oak' }), C('bookd', 'living', 'Шкаф книжный с дверцами', 900, 380, 2000, (g, o) => cab(g, o, { rows: [{ h: 0.8, k: 'doors' }, { h: 1.2, k: 'glass', n: 2 }] }), { f: 'white' }),
  C('side', 'living', 'Комод-витрина', 1200, 420, 900, (g, o) => cab(g, o, { plinth: 0.12, legs: true, rows: [{ h: 1, k: 'doors' }, { h: 0.35, k: 'drawer', n: 2 }] }), { f: 'walnut' }),
  C('bed90', 'bed', 'Кровать 90×200', 1000, 2100, 950, (g, o) => bed(g, o), { f: 'lgrey', seat: 1 }), C('bed140', 'bed', 'Кровать 140×200', 1500, 2100, 1000, (g, o) => bed(g, o), { f: 'cream', seat: 1 }),
  C('bed160', 'bed', 'Кровать 160×200', 1700, 2100, 1050, (g, o) => bed(g, o), { f: 'grey', seat: 1 }), C('bed180', 'bed', 'Кровать 180×200', 1900, 2100, 1100, (g, o) => bed(g, o, { blanket: '#7f95a8' }), { f: 'navy', seat: 1 }),
  C('night', 'bed', 'Тумба прикроватная', 450, 400, 500, (g, o) => cab(g, o, { plinth: 0.1, legs: true, rows: dr(2) }), { f: 'oakl' }), C('dress4', 'bed', 'Комод 4 ящика', 800, 450, 950, (g, o) => cab(g, o, { plinth: 0.06, rows: dr(4) }), { f: 'white' }),
  C('dress6', 'bed', 'Комод широкий 6 ящиков', 1400, 450, 800, (g, o) => cab(g, o, { plinth: 0.1, legs: true, rows: [1, 1, 1].map(() => ({ h: 1, k: 'drawer', n: 2 })) }), { f: 'oak' }),
  C('ward2', 'bed', 'Шкаф 2 двери', 1000, 600, 2300, (g, o) => cab(g, o, { plinth: 0.07, rail: 1, rows: [{ h: 1, k: 'doors' }] }), { f: 'white' }), C('ward3', 'bed', 'Шкаф 3 двери', 1500, 600, 2300, (g, o) => cab(g, o, { plinth: 0.07, rail: 1, rows: [{ h: 0.25, k: 'drawer', n: 3 }, { h: 1, k: 'door', n: 3 }] }), { f: 'cream' }),
  C('ward4', 'bed', 'Шкаф 4 двери', 2000, 600, 2400, (g, o) => cab(g, o, { plinth: 0.07, rail: 1, rows: [{ h: 1, k: 'doors', n: 2 }, { h: 0.2, k: 'doors', n: 2 }] }), { f: 'lgrey' }),
  C('coupe2', 'bed', 'Шкаф-купе 2 двери', 1600, 620, 2400, (g, o) => cab(g, o, { plinth: 0.06, rail: 1, rows: [{ h: 1, k: 'slide', n: 2, mirror: 1 }] }), { f: 'oakl' }), C('coupe3', 'bed', 'Шкаф-купе 3 двери', 2400, 620, 2500, (g, o) => cab(g, o, { plinth: 0.06, rail: 1, rows: [{ h: 1, k: 'slide', n: 3, mirror: 1 }] }), { f: 'white' }),
  C('vanit', 'bed', 'Туалетный столик', 1000, 450, 760, (g, o) => { table(g, o, { metal: 1 }); const s = grp(g, 0, mm(o.h) - 0.14, 0); cab(s, { ...o, w: o.w - 60, d: o.d - 40, h: 120 }, { rows: [{ h: 1, k: 'drawer', n: 2 }] }); }, { f: 'white' }),
  C('kb40', 'kitchen', 'Низ 400, дверца', 400, 580, 880, (g, o) => cab(g, o, K_BASE([{ h: 1, k: 'door' }]))), C('kb60', 'kitchen', 'Низ 600, дверцы', 600, 580, 880, (g, o) => cab(g, o, K_BASE([{ h: 1, k: 'doors' }]))),
  C('kd40', 'kitchen', 'Низ 400, 3 ящика', 400, 580, 880, (g, o) => cab(g, o, K_BASE(dr(3)))), C('kd60', 'kitchen', 'Низ 600, 3 ящика', 600, 580, 880, (g, o) => cab(g, o, K_BASE([{ h: 1.4, k: 'drawer' }, { h: 1.4, k: 'drawer' }, { h: 0.7, k: 'drawer' }]))),
  C('kd80', 'kitchen', 'Низ 800, 2 ящика', 800, 580, 880, (g, o) => cab(g, o, K_BASE(dr(2)))), C('ksink', 'kitchen', 'Мойка 600', 600, 580, 880, sinkBase),
  C('ku40', 'kitchen', 'Верх 400', 400, 320, 720, (g, o) => cab(g, o, { rows: [{ h: 1, k: 'door' }] }), { y: 1420, wall: 1 }), C('ku60', 'kitchen', 'Верх 600', 600, 320, 720, (g, o) => cab(g, o, { rows: [{ h: 1, k: 'doors' }] }), { y: 1420, wall: 1 }),
  C('ku80', 'kitchen', 'Верх 800, подъёмный', 800, 320, 360, (g, o) => cab(g, o, { rows: [{ h: 1, k: 'lift' }] }), { y: 1780, wall: 1 }), C('kug', 'kitchen', 'Верх 600, стекло', 600, 320, 720, (g, o) => cab(g, o, { rows: [{ h: 1, k: 'glass', n: 2 }] }), { y: 1420, wall: 1 }),
  C('ktall', 'kitchen', 'Пенал с духовкой', 600, 580, 2140, (g, o) => cab(g, o, { plinth: 0.1, rows: [{ h: 0.72, k: 'door' }, { h: 0.6, k: 'flap', window: 1, front: STEEL() }, { h: 0.38, k: 'lift', front: STEEL() }, { h: 0.34, k: 'door' }] })),
  C('stove', 'kitchen', 'Плита 600', 600, 600, 850, stove, { f: 'grey' }), C('dishw', 'kitchen', 'Посудомоечная 600', 600, 570, 880, (g, o) => cab(g, o, { ...K_BASE([{ h: 1, k: 'flap' }]) })), C('fridge', 'kitchen', 'Холодильник', 600, 650, 2000, (g, o) => cab(g, o, { plinth: 0.04, front: STEEL(), body: STEEL(), rows: [{ h: 0.7, k: 'door', empty: 0 }, { h: 1.25, k: 'door' }] }), { f: 'grey' }),
  C('fridge2', 'kitchen', 'Холодильник Side-by-Side', 910, 700, 1800, (g, o) => cab(g, o, { plinth: 0.04, front: STEEL(), body: STEEL(), rows: [{ h: 1, k: 'doors' }] }), { f: 'grey' }), C('hood', 'kitchen', 'Вытяжка 600', 600, 480, 700, (g, o) => builtin(g, o, 'hood'), { y: 1550, wall: 1 }),
  C('micro', 'kitchen', 'Микроволновка', 480, 360, 280, (g, o) => cab(g, o, { noHandle: 0, front: M('#141517', 0.15, 0.3), body: STEEL(), rows: [{ h: 1, k: 'door', hinge: 'l' }] }), { y: 920 }),
  C('dt4', 'kitchen', 'Стол обеденный 120×75', 1200, 750, 750, (g, o) => table(g, o), { f: 'oak' }), C('dt6', 'kitchen', 'Стол обеденный 160×90', 1600, 900, 750, (g, o) => table(g, o, { metal: 1 }), { f: 'walnut' }), C('dtR', 'kitchen', 'Стол круглый Ø100', 1000, 1000, 750, (g, o) => table(g, o, { round: 1 }), { f: 'white' }),
  C('chair', 'kitchen', 'Стул', 450, 500, 850, (g, o) => chair(g, o), { f: 'lgrey', seat: 1 }), C('barst', 'kitchen', 'Стул барный', 400, 400, 950, (g, o) => chair(g, o, { bar: 1 }), { f: 'graph', seat: 1 }), C('stool', 'kitchen', 'Табурет', 360, 360, 460, (g, o) => chair(g, o, { stool: 1 }), { f: 'oak', seat: 1 }),
  C('bath170', 'bath', 'Ванна 170×70', 1700, 700, 600, (g, o) => builtin(g, o, 'bath')), C('bath150', 'bath', 'Ванна 150×70', 1500, 700, 600, (g, o) => builtin(g, o, 'bath')), C('shower', 'bath', 'Душевая 90×90', 900, 900, 2000, (g, o) => builtin(g, o, 'shower')),
  C('shower12', 'bath', 'Душевая 120×80', 1200, 800, 2000, (g, o) => builtin(g, o, 'shower')), C('wc', 'bath', 'Унитаз', 370, 650, 800, (g, o) => builtin(g, o, 'toilet'), { seat: 1 }), C('van60', 'bath', 'Раковина с тумбой 600', 600, 460, 850, vanity, { f: 'oakl' }),
  C('van80', 'bath', 'Раковина с тумбой 800', 800, 460, 850, vanity, { f: 'graph' }), C('wash', 'bath', 'Стиральная машина', 600, 550, 850, (g, o) => builtin(g, o, 'washer')), C('dryer', 'bath', 'Сушильная машина', 600, 600, 850, (g, o) => builtin(g, o, 'washer'), { y: 860 }),
  C('bcab', 'bath', 'Шкаф зеркальный', 600, 150, 700, (g, o) => cab(g, o, { noHandle: 1, rows: [{ h: 1, k: 'doors', front: MIRROR() }] }), { y: 1200, wall: 1 }), C('btall', 'bath', 'Пенал для ванной', 350, 330, 1800, (g, o) => cab(g, o, { plinth: 0.1, legs: true, rows: [{ h: 1, k: 'door' }, { h: 1, k: 'door' }] })),
  C('towel', 'bath', 'Полотенцесушитель', 500, 90, 800, (g, o) => { const W = mm(o.w), H = mm(o.h), c = CHROME();[-1, 1].forEach(a => cy(g, 0.012, H, a * W / 2, H / 2, 0.04, c)); for (let i = 0; i < 7; i++) cy(g, 0.01, W, 0, 0.06 + i * (H - 0.12) / 6, 0.04, c).rotation.z = Math.PI / 2; }, { y: 900, wall: 1 }),
  C('hcoupe', 'hall', 'Шкаф-купе в прихожую', 1400, 600, 2400, (g, o) => cab(g, o, { plinth: 0.06, rail: 1, rows: [{ h: 1, k: 'slide', n: 2, mirror: 1 }] }), { f: 'graph' }), C('hward', 'hall', 'Шкаф узкий', 600, 400, 2200, (g, o) => cab(g, o, { plinth: 0.07, rail: 1, rows: [{ h: 1, k: 'door' }] })),
  C('shoe', 'hall', 'Обувница', 800, 300, 1100, (g, o) => cab(g, o, { plinth: 0.08, legs: true, flapTo: 0.8, rows: [1, 1, 1].map(() => ({ h: 1, k: 'flap' })) })), C('bench', 'hall', 'Банкетка', 900, 380, 460, (g, o) => builtin(g, o, 'bench'), { f: 'sage', seat: 1 }),
  C('hang', 'hall', 'Вешалка настенная', 900, 220, 150, (g, o) => builtin(g, o, 'hanger'), { f: 'oak', y: 1650, wall: 1 }), C('mirr', 'hall', 'Зеркало', 600, 30, 1600, (g, o) => builtin(g, o, 'mirror'), { f: 'black', y: 300, wall: 1 }),
  C('desk', 'work', 'Стол письменный', 1300, 650, 750, desk, { f: 'oakl' }), C('desk2', 'work', 'Стол-консоль', 1100, 550, 750, (g, o) => table(g, o, { metal: 1 }), { f: 'white' }), C('och', 'work', 'Кресло офисное', 620, 620, 1150, (g, o) => chair(g, o, { office: 1 }), { f: 'graph', seat: 1 }),
  C('rack', 'work', 'Стеллаж 4×2', 1500, 390, 800, (g, o) => cab(g, o, { rows: [{ h: 1, k: 'open', n: 4, empty: 1 }, { h: 1, k: 'open', n: 4, empty: 1 }] })), C('rackh', 'work', 'Стеллаж 2×4', 800, 390, 1500, (g, o) => cab(g, o, { rows: [1, 1, 1, 1].map((_, i) => ({ h: 1, k: i ? 'open' : 'door', n: 2, empty: 1 })) })),
  C('kbed', 'work', 'Кровать детская 80×160', 880, 1680, 800, (g, o) => bed(g, o, { wood: 1, blanket: '#c9a13f' }), { f: 'white', seat: 1 }), C('crib', 'work', 'Кроватка 60×120', 660, 1260, 900, (g, o) => bed(g, o, { wood: 1, rails: 1, blanket: '#d3a7a0' }), { f: 'oakl' }),
  C('bunk', 'work', 'Кровать двухъярусная', 980, 2060, 1750, bunk, { f: 'oakl' }), C('wshelf', 'work', 'Полка настенная', 900, 220, 30, (g, o) => builtin(g, o, 'shelf'), { f: 'oak', y: 1400, wall: 1 }),
  C('tv43', 'tech', 'Телевизор 43″', 960, 60, 560, (g, o) => builtin(g, o, 'tv'), { y: 1000, wall: 1 }), C('tv55', 'tech', 'Телевизор 55″', 1230, 60, 710, (g, o) => builtin(g, o, 'tv'), { y: 950, wall: 1 }), C('tv65', 'tech', 'Телевизор 65″', 1450, 60, 830, (g, o) => builtin(g, o, 'tv'), { y: 900, wall: 1 }),
  C('tv75', 'tech', 'Телевизор 75″', 1680, 60, 960, (g, o) => builtin(g, o, 'tv'), { y: 850, wall: 1 }), C('ac', 'tech', 'Кондиционер', 800, 210, 290, (g, o) => builtin(g, o, 'ac'), { y: 2250, wall: 1 }), C('rad', 'tech', 'Радиатор', 800, 100, 560, (g, o) => builtin(g, o, 'radiator'), { y: 120, wall: 1 }),
  C('flamp', 'tech', 'Торшер', 400, 400, 1550, (g, o) => builtin(g, o, 'flamp')), C('clamp', 'tech', 'Светильник потолочный', 450, 450, 90, (g, o) => builtin(g, o, 'clamp'), { ceil: 1 }),
  C('rug', 'decor', 'Ковёр 200×140', 2000, 1400, 12, (g, o) => builtin(g, o, 'rug'), { f: 'cream', flat: 1 }), C('rug2', 'decor', 'Ковёр 300×200', 3000, 2000, 12, (g, o) => builtin(g, o, 'rug'), { f: 'blue', flat: 1 }), C('rugR', 'decor', 'Дорожка 240×80', 2400, 800, 12, (g, o) => builtin(g, o, 'rug'), { f: 'terra', flat: 1 }),
  C('plant', 'decor', 'Растение большое', 500, 500, 1500, (g, o) => builtin(g, o, 'plant')), C('plant2', 'decor', 'Растение малое', 300, 300, 700, (g, o) => builtin(g, o, 'plant')), C('mirrF', 'decor', 'Зеркало напольное', 700, 40, 1800, (g, o) => builtin(g, o, 'mirror'), { f: 'oak' })
];
export const defOf = t => CATALOG.find(c => c.id === t);
export const recOf = d => ({ t: d.id, w: d.w, d: d.d, h: d.h, f: d.f, y: d.y || 0 });

/* изделие по записи {t,w,d,h,f,y}; roomH — высота потолка, м */
export function makeItem(rec, roomH = 2.63) {
  const d = defOf(rec.t), g = new THREE.Group(); if (!d) return g;
  const o = { w: rec.w || d.w, d: rec.d || d.d, h: rec.h || d.h, f: rec.f || d.f, y: rec.y || 0 };
  const inner = grp(g, 0, d.ceil ? roomH - mm(o.h) : mm(o.y), d.wall ? 0 : 0); d.b(inner, o);
  g.userData.def = d; g.userData.size = [mm(o.w), mm(o.d), mm(o.h)];
  return g;
}

/* ---------- подвижные части ---------- */
const LIVE = new Set();
function applyAct(o) { const a = o.userData.act, e = a.t * a.t * (3 - 2 * a.t); if (a.kind === 'rot') o.rotation[a.axis] = a.to * e; else if (a.kind === 'pos') o.position[a.axis] = a.base + a.to * e; else if (a.kind === 'scale') o.scale[a.axis] = 1 + (a.to - 1) * e; else if (a.kind === 'light') { a.light.intensity = a.on * e; if (a.glow) a.glow.emissiveIntensity = 1.6 * e; } }
export function findAct(obj) { for (let o = obj; o; o = o.parent) if (o.userData && o.userData.act) return o; return null; }
export function toggle(o, to) { const a = o.userData.act; a.target = to != null ? to : (a.target > 0.5 ? 0 : 1); LIVE.add(o); }
export function setAct(o, t) { const a = o.userData.act; a.t = a.target = t; applyAct(o); }
export function stepActs(dt) { LIVE.forEach(o => { const a = o.userData.act, sp = dt / (a.kind === 'light' ? 0.25 : 0.55); a.t = a.target > a.t ? Math.min(a.target, a.t + sp) : Math.max(a.target, a.t - sp); applyAct(o); if (a.t === a.target) LIVE.delete(o); }); return LIVE.size; }
export function allActs(root) { const r = []; root.traverse(o => { if (o.userData.act) r.push(o); }); return r; }

/* ---------- миниатюры каталога ---------- */
const TH = new Map(); let thS = null;
export function thumb(d, renderer) {
  if (TH.has(d.id)) return TH.get(d.id);
  const S = 144;
  if (!thS) { const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight('#ffffff', '#b9b2a6', 1.0)); const l = new THREE.DirectionalLight('#ffffff', 1.5); l.position.set(2, 4, 3); sc.add(l); thS = { sc, cam: new THREE.PerspectiveCamera(28, 1, 0.05, 60), rt: new THREE.WebGLRenderTarget(S, S), buf: new Uint8Array(S * S * 4), cv: document.createElement('canvas') }; thS.cv.width = thS.cv.height = S; }
  const g = makeItem(recOf(d)); thS.sc.add(g);
  const b = new THREE.Box3().setFromObject(g), c = b.getCenter(new THREE.Vector3()), r = b.getSize(new THREE.Vector3()).length() / 2 || 0.5, dist = r / Math.sin(14 * Math.PI / 180) * 1.02;
  thS.cam.position.set(c.x + dist * 0.5, c.y + dist * 0.38, c.z + dist * 0.78); thS.cam.lookAt(c);
  const env = renderer.getRenderTarget(), ca = renderer.getClearAlpha(); renderer.setRenderTarget(thS.rt); renderer.setClearAlpha(0); renderer.clear(); renderer.render(thS.sc, thS.cam);
  renderer.readRenderTargetPixels(thS.rt, 0, 0, S, S, thS.buf); renderer.setRenderTarget(env); renderer.setClearAlpha(ca); thS.sc.remove(g);
  const x = thS.cv.getContext('2d'), im = x.createImageData(S, S), src = thS.buf;
  for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) { const i = ((S - 1 - yy) * S + xx) * 4, j = (yy * S + xx) * 4; for (let k = 0; k < 3; k++) im.data[j + k] = Math.min(255, Math.pow(src[i + k] / 255, 1 / 2.2) * 255); im.data[j + 3] = src[i + 3]; }
  x.putImageData(im, 0, 0); const u = thS.cv.toDataURL('image/png'); TH.set(d.id, u); return u;
}

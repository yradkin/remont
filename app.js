/* «Ремонт · Тип 13» — квартира в 3D по эскизу и замерам «Обмера»; шаг 2 — отделка и двери.
   Единицы сцены — метры. План «Обмера» нарисован в пикселях: 1 px = K мм. Ось Y плана → ось Z сцены. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MATS, PAINTS, matFor, swatch, loadLibrary, openImporter, removeUser, storeRecord } from './mats.js';
import { openLayout } from './lay.js';

const G = window.__GEO;                        // геометрия из «Обмера» (стены, окна, двери, комнаты)
const K = G.K;                                 // мм на пиксель плана
const SYNC_URL = window.__SYNC || 'https://script.google.com/macros/s/AKfycbxmRZ8en5tzIkbOwHbD_kEpJkf0s3iOJPBJn0fidTg5Z0_C-oWoWlLGt6RUQQVBz4yPdA/exec';
const $ = s => document.querySelector(s);
const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) {} } };
const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Math.round(n).toLocaleString('ru-RU');

/* ---------- координаты ---------- */
let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
G.WALLS.concat(G.WINDOWS).forEach(w => { minX = Math.min(minX, w[0]); minY = Math.min(minY, w[1]); maxX = Math.max(maxX, w[2]); maxY = Math.max(maxY, w[3]); });
const CX = (minX + maxX) / 2, CY = (minY + maxY) / 2;
const X = px => (px - CX) * K / 1000;          // пиксели плана → метры сцены
const Z = py => (py - CY) * K / 1000;

/* ---------- замеры ---------- */
const M = { vals: {}, src: 'sketch', n: 0 };
function loadLocalVals() {   // копия замеров, которую «Обмер» хранит в этом же браузере
  try { const j = JSON.parse(ls.get('priemka-t13') || 'null'); if (j && j.vals) { M.vals = j.vals; M.src = 'local'; } } catch (e) {}
}
const val = (rid, k) => { const v = M.vals[rid] && M.vals[rid][k]; return v != null && isFinite(+v) && +v > 0 ? +v : null; };
function countVals() { let n = 0; Object.values(M.vals).forEach(o => { n += Object.keys(o || {}).length; }); return n; }
function ceilOf(rid) { const hs = ['h1', 'h2', 'h3', 'h4', 'h5'].map(k => val(rid, k)).filter(Boolean); return hs.length ? hs.reduce((a, b) => a + b, 0) / hs.length : null; }
function ceilAll() { const hs = G.ROOMS.map(r => ceilOf(r.id)).filter(Boolean); return hs.length ? hs.reduce((a, b) => a + b, 0) / hs.length : null; }

/* ---------- сцена ---------- */
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
const BG = { light: new THREE.Color('#d9d4cc'), dark: new THREE.Color('#15171b') };
const dark = () => matchMedia('(prefers-color-scheme: dark)').matches;
scene.background = dark() ? BG.dark : BG.light;

const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.495; controls.minDistance = 2; controls.maxDistance = 40;

const hemi = new THREE.HemisphereLight('#ffffff', '#8f8577', 0.35); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1dc', 2.8);
sun.position.set(-7, 12, 9); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
scene.add(sun);

const matWall = new THREE.MeshStandardMaterial({ color: '#ebe6df', roughness: 0.92, envMapIntensity: 0.45 });
const matWallTop = new THREE.MeshStandardMaterial({ color: '#3b3f46', roughness: 1, envMapIntensity: 0.2 });
const wallMats = [matWall, matWall, matWallTop, matWall, matWall, matWall];   // верхний торец стены — тёмный, чтобы читался план
const matFloorBase = new THREE.MeshStandardMaterial({ color: '#bdb5a9', roughness: 1, envMapIntensity: 0.3 });
const matFrame = new THREE.MeshStandardMaterial({ color: '#fbfbfa', roughness: 0.5 });
const matSill = new THREE.MeshStandardMaterial({ color: '#f4f2ef', roughness: 0.35 });
const matGlass = new THREE.MeshPhysicalMaterial({ color: '#cfe3ef', roughness: 0.05, metalness: 0, transmission: 0.9, transparent: true, opacity: 0.35, thickness: 0.01 });
const matCeil = new THREE.MeshStandardMaterial({ color: '#fbfaf8', roughness: 0.95, side: THREE.DoubleSide, envMapIntensity: 0.6 });
const matGap = new THREE.MeshStandardMaterial({ color: '#2a2b2e', roughness: 1 });
const matHandle = new THREE.MeshStandardMaterial({ color: '#c9ccd1', roughness: 0.25, metalness: 0.9 });

/* ---------- отделка: что выбрано в каждой комнате (хранится в этом браузере) ---------- */
const P_KEY = 'remont-p1';
let P = { rooms: {}, doors: {}, lay: {}, mats: {}, matsDel: [] };
try { const j = JSON.parse(ls.get(P_KEY) || 'null'); if (j) P = Object.assign(P, j); } catch (e) {}
function saveP(local) { ls.set(P_KEY, JSON.stringify(P)); if (local) return; SY.dirty = true; ls.set('remont-dirty', '1'); pushSoon(); setSync(); }
const fixP = () => { ['rooms', 'doors', 'lay', 'mats'].forEach(k => { if (!P[k] || typeof P[k] !== 'object') P[k] = {}; }); if (!Array.isArray(P.matsDel)) P.matsDel = []; };
fixP();
const SY = { at: +(ls.get('remont-at') || 0), dirty: ls.get('remont-dirty') === '1', t: 0, busy: false, on: false, err: '' };
if (!SY.at && (Object.keys(P.rooms).length || Object.keys(P.doors).length || Object.keys(P.lay).length)) SY.dirty = true;
const WET = rid => rid === 'wc' || rid === 'bath' || rid === 'bal';
function fin(rid) { return Object.assign({ floor: WET(rid) ? 'tile-600-lgrey' : 'lam-nat', walls: 'paint', wallColor: '#f1ede6', floorColor: '#c9c4bb', ceil: '#fbfaf8' }, P.rooms[rid] || {}); }
const wallMatOf = rid => { const f = fin(rid), id = MATS.has(f.walls) ? f.walls : 'paint', lo = layOpt(rid, 'walls', id); return matFor(id, f.wallColor, lo && lo.pat); };
/* настройки раскладки, если они сделаны для текущего материала поверхности */
function layOpt(rid, kind, id) { const L = P.lay && P.lay[rid], o = L && L.opt && L.opt[kind]; return o && o.mat === id ? o : null; }

/* поверхности комнаты в мм для раскладки: пол и 4 стены с проёмами (стена — вид изнутри, y от потолка) */
const SURF = new Map();
const WALL_KEYS = { top: 'w0', right: 'w1', bottom: 'w2', left: 'w3' };
function surfacesOf(rid) {
  if (SURF.has(rid)) return SURF.get(rid);
  const r = G.ROOMS.find(x => x.id === rid), [a, b, c, d] = r.rect, sw = (c - a) * K, sl = (d - b) * K;
  let W = sw, L = sl; const Wm = val(rid, 'W'), Lm = val(rid, 'L');
  if (Wm && Lm) { if (Math.abs(Wm - sw) + Math.abs(Lm - sl) <= Math.abs(Lm - sw) + Math.abs(Wm - sl)) { W = Wm; L = Lm; } else { W = Lm; L = Wm; } }
  W = Math.round(W); L = Math.round(L);
  const kx = W / sw, ky = L / sl, Hc = Math.round(ceilOf(rid) || H * 1000);
  const ops = [];
  const add = (q, kind) => {
    const [orid, key] = q[4].split('.'), it = key.split('_')[0];
    let f0 = 0, f1;
    if (kind === 'door') f1 = Math.min(val(orid, it + '_H') ?? 2100, Hc);
    else { const bal = orid === 'bal', S = val(orid, it + '_S') ?? (bal ? val('bal', 'par') ?? 1000 : 850); let T = val(orid, it + '_Top'); if (T == null) { const h = val(orid, it + '_H'); T = h ? S + h : (bal ? Hc - 50 : 2400); } f0 = S; f1 = Math.min(T, Hc); }
    ops.push({ x0: Math.min(q[0], q[2]), x1: Math.max(q[0], q[2]), y0: Math.min(q[1], q[3]), y1: Math.max(q[1], q[3]), kind, f0, f1, wm: val(orid, it + '_W') });
  };
  G.DOORS.forEach(q => add(q, 'door')); G.WINDOWS.forEach(q => add(q, 'win'));
  const T = 70, out = { floor: { W, H: L, holes: [], name: 'Пол' }, kx, ky, rect: r.rect, plan: { W, L } };
  ['top', 'right', 'bottom', 'left'].forEach((side, i) => {
    const hor = side === 'top' || side === 'bottom', len = hor ? W : L, holes = [];
    ops.forEach(o => {
      const oh = o.x1 - o.x0 >= o.y1 - o.y0; if (oh !== hor) return;
      const near = side === 'top' ? o.y1 >= b - T && o.y0 <= b + 3 : side === 'bottom' ? o.y0 <= d + T && o.y1 >= d - 3 : side === 'left' ? o.x1 >= a - T && o.x0 <= a + 3 : o.x0 <= c + T && o.x1 >= c - 3;
      const over = hor ? o.x1 > a + 2 && o.x0 < c - 2 : o.y1 > b + 2 && o.y0 < d - 2;
      if (!near || !over) return;
      let u0 = side === 'top' ? (o.x0 - a) * K * kx : side === 'bottom' ? (c - o.x1) * K * kx : side === 'left' ? (d - o.y1) * K * ky : (o.y0 - b) * K * ky;
      let u1 = side === 'top' ? (o.x1 - a) * K * kx : side === 'bottom' ? (c - o.x0) * K * kx : side === 'left' ? (d - o.y0) * K * ky : (o.y1 - b) * K * ky;
      if (o.wm) { const m = (u0 + u1) / 2; u0 = m - o.wm / 2; u1 = m + o.wm / 2; }
      u0 = Math.max(0, Math.round(u0)); u1 = Math.min(len, Math.round(u1));
      if (u1 - u0 > 50) holes.push({ x0: u0, x1: u1, y0: Hc - o.f1, y1: Hc - o.f0, kind: o.kind });
    });
    out[WALL_KEYS[side]] = { W: len, H: Hc, holes, name: 'Стена ' + 'АБВГ'[i] };
  });
  SURF.set(rid, out); return out;
}
/* сдвиг UV стены так, чтобы швы проходили через метку раскладки */
function wallUVShift(rid, fi) {
  const f = fin(rid), id = MATS.has(f.walls) ? f.walls : 'paint', lo = layOpt(rid, 'walls', id); if (!lo) return null;
  const side = ['left', 'right', null, null, 'top', 'bottom'][fi], k = WALL_KEYS[side], mk = P.lay[rid].marks && P.lay[rid].marks[k]; if (!mk) return null;
  const sf = surfacesOf(rid), [a, b, c, d] = sf.rect, S = sf[k];
  const uj = side === 'top' ? X(a) + mk.mx / sf.kx / 1000 : side === 'bottom' ? -(X(c) - mk.mx / sf.kx / 1000) : side === 'left' ? -(Z(d) - mk.mx / sf.ky / 1000) : Z(b) + mk.mx / sf.ky / 1000;
  return { uj, vj: (S.H - mk.my) / 1000, rot: !!lo.rot };
}
function doorCfg(key) { return Object.assign({ type: key === 'hall.d1_W' ? 'entry' : 'std', color: key === 'hall.d1_W' ? '#3a3330' : '#f4f2ee' }, P.doors[key] || {}); }
function roomAt(x, z) { const px = x * 1000 / K + CX, py = z * 1000 / K + CY; const r = G.ROOMS.find(r => px >= r.rect[0] - 1 && px <= r.rect[2] + 1 && py >= r.rect[1] - 1 && py <= r.rect[3] + 1); return r ? r.id : null; }
function worldUV(geo, cx, cy, cz) {   // UV в метрах по мировым координатам: рисунок непрерывен между соседними кусками стены
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + cx, y = p.getY(i) + cy, z = p.getZ(i) + cz, nx = n.getX(i), nz = n.getZ(i);
    if (Math.abs(nx) > 0.5) uv.setXY(i, nx > 0 ? -z : z, y); else if (Math.abs(nz) > 0.5) uv.setXY(i, nz > 0 ? x : -x, y); else uv.setXY(i, x, -z);
  }
  uv.needsUpdate = true;
}

/* ---------- построение ---------- */
const world = new THREE.Group(); scene.add(world);
let H = 2.7, WALL_LOW = false;
const wallMeshes = [], ceilings = [], labels = [], solids = [];   // solids — прямоугольники для столкновений в прогулке
function box(x1, z1, x2, z2, y1, y2, mat, shadow = true) {
  const w = Math.abs(x2 - x1), d = Math.abs(z2 - z1), h = y2 - y1;
  if (w < 0.001 || d < 0.001 || h < 0.001) return null;
  const cx = (x1 + x2) / 2, cy = y1 + h / 2, cz = (z1 + z2) / 2, geo = new THREE.BoxGeometry(w, h, d);
  worldUV(geo, cx, cy, cz);
  if (mat === 'WALL') {   // каждая грань стены — в отделке той комнаты, куда она смотрит
    const f = (dx, dz) => { const r = roomAt(cx + dx, cz + dz); return r ? wallMatOf(r) : matWall; };
    const off = [[w / 2 + 0.06, 0], [-w / 2 - 0.06, 0], null, null, [0, d / 2 + 0.06], [0, -d / 2 - 0.06]];
    mat = [f(...off[0]), f(...off[1]), matWallTop, matWall, f(...off[4]), f(...off[5])];
    const uv = geo.attributes.uv;
    [0, 1, 4, 5].forEach(fi => { const r = roomAt(cx + off[fi][0], cz + off[fi][1]); const sh = r && wallUVShift(r, fi); if (!sh) return;
      for (let i = fi * 4; i < fi * 4 + 4; i++) { const u = uv.getX(i) - sh.uj, v = uv.getY(i) - sh.vj; if (sh.rot) uv.setXY(i, v, u); else uv.setXY(i, u, v); } });
  }
  const m = new THREE.Mesh(geo, mat);
  m.position.set(cx, cy, cz);
  m.castShadow = shadow; m.receiveShadow = true; world.add(m); return m;
}
function doorBand(d) {   // толщина стены у проёма: ищем соседние стены по концам двери
  const [x1, y1, x2, y2] = d, hor = y1 === y2, T = 10;
  let a = Infinity, b = -Infinity;
  G.WALLS.forEach(w => {
    const along = hor ? w[2] - w[0] >= w[3] - w[1] : w[3] - w[1] >= w[2] - w[0];   // только стены вдоль двери, а не примыкающие поперёк
    if (!along) return;
    if (hor) { if (y1 >= w[1] - 1 && y1 <= w[3] + 1 && (Math.abs(w[2] - x1) < T || Math.abs(w[0] - x2) < T || (w[0] <= x1 && w[2] >= x1) || (w[0] <= x2 && w[2] >= x2))) { a = Math.min(a, w[1]); b = Math.max(b, w[3]); } }
    else { if (x1 >= w[0] - 1 && x1 <= w[2] + 1 && (Math.abs(w[3] - y1) < T || Math.abs(w[1] - y2) < T || (w[1] <= y1 && w[3] >= y1) || (w[1] <= y2 && w[3] >= y2))) { a = Math.min(a, w[0]); b = Math.max(b, w[2]); } }
  });
  if (!isFinite(a)) { a = (hor ? y1 : x1) - 8; b = (hor ? y1 : x1) + 8; }
  return hor ? [x1, a, x2, b] : [a, y1, b, y2];
}
function textSprite(t1, t2) {
  const c = document.createElement('canvas'), g = c.getContext('2d'); c.width = 512; c.height = 160;
  g.font = '600 54px -apple-system,Segoe UI,Roboto,sans-serif'; g.textAlign = 'center'; g.fillStyle = '#1c1f24'; g.shadowColor = 'rgba(255,255,255,.9)'; g.shadowBlur = 12;
  g.fillText(t1, 256, 70); g.font = '500 40px -apple-system,Segoe UI,Roboto,sans-serif'; g.fillStyle = '#5a5f66'; g.fillText(t2, 256, 128);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, depthTest: false, transparent: true })); s.scale.set(1.9, 0.6, 1); s.renderOrder = 10; return s;
}
/* двери: обычная (коробка, полотно, наличники, ручка), входная, скрытая (заподлицо, в отделке стены), без двери */
function doorLeaf(d, b, rid, dh, top) {
  const cfg = doorCfg(d[4]); if (cfg.type === 'none') return;
  const hor = d[1] === d[3];
  const a1 = hor ? X(d[0]) : Z(d[1]), a2 = hor ? X(d[2]) : Z(d[3]), c1 = hor ? Z(b[1]) : X(b[0]), c2 = hor ? Z(b[3]) : X(b[2]), mid = (c1 + c2) / 2;
  const B = (p1, q1, p2, q2, y1, y2, mat, sh = true) => { y2 = Math.min(y2, top); if (y2 - y1 < 0.003) return; return hor ? box(p1, q1, p2, q2, y1, y2, mat, sh) : box(q1, p1, q2, p2, y1, y2, mat, sh); };
  if (cfg.type === 'hidden') {
    const am = (a1 + a2) / 2, s1 = hor ? roomAt(am, c1 - 0.06) : roomAt(c1 - 0.06, am);
    const front = s1 === rid ? c1 : c2, dir = front === c1 ? 1 : -1, wm = wallMatOf(rid);
    B(a1 + 0.003, Math.min(front, front + dir * 0.04), a2 - 0.003, Math.max(front, front + dir * 0.04), 0.006, dh - 0.003, wm);
    [[a1, a1 + 0.003], [a2 - 0.003, a2]].forEach(([p, q]) => B(p, Math.min(front, front + dir * 0.03), q, Math.max(front, front + dir * 0.03), 0, dh, matGap, false));
    B(a1, Math.min(front, front + dir * 0.03), a2, Math.max(front, front + dir * 0.03), dh - 0.003, dh, matGap, false);
    return;
  }
  const leafM = matFor('paint', cfg.color), fw = 0.03, cw = 0.07, ct = 0.012;
  B(a1, c1, a1 + fw, c2, 0, dh, leafM); B(a2 - fw, c1, a2, c2, 0, dh, leafM); B(a1, c1, a2, c2, dh - fw, dh, leafM);
  B(a1 + fw + 0.003, mid - 0.02, a2 - fw - 0.003, mid + 0.02, 0.01, dh - fw - 0.003, leafM);
  [[c1 - ct, c1], [c2, c2 + ct]].forEach(([q1, q2]) => { B(a1 - cw, q1, a1, q2, 0, dh + cw, leafM); B(a2, q1, a2 + cw, q2, 0, dh + cw, leafM); B(a1 - cw, q1, a2 + cw, q2, dh, dh + cw, leafM); });
  B(a2 - fw - 0.17, mid - 0.045, a2 - fw - 0.05, mid + 0.045, 0.99, 1.02, matHandle);
}
function build() {
  SURF.clear(); world.clear(); wallMeshes.length = 0; ceilings.length = 0; labels.length = 0; solids.length = 0;
  H = (ceilAll() || 2700) / 1000;
  const top = WALL_LOW ? Math.min(1.15, H) : H;
  // основание под всей квартирой
  const base = new THREE.Mesh(new THREE.BoxGeometry(X(maxX) - X(minX) + 0.6, 0.12, Z(maxY) - Z(minY) + 0.6), matFloorBase);
  base.position.set(0, -0.061, 0); base.receiveShadow = true; world.add(base);
  // полы комнат
  G.ROOMS.forEach(r => {
    const [a, b, c, d] = r.rect, w = X(c) - X(a), dd = Z(d) - Z(b);
    const fx = (X(a) + X(c)) / 2, fz = (Z(b) + Z(d)) / 2, fg = new THREE.PlaneGeometry(w, dd), fp = fg.attributes.position;
    const ff = fin(r.id), fid = MATS.has(ff.floor) ? ff.floor : 'lam-nat', lo = layOpt(r.id, 'floor', fid), fmk = lo && P.lay[r.id].marks && P.lay[r.id].marks.floor;
    let ox = 0, oz = 0; if (fmk) { const sf = surfacesOf(r.id); ox = X(a) + fmk.mx / sf.kx / 1000; oz = Z(b) + fmk.my / sf.ky / 1000; }
    for (let i = 0; i < fp.count; i++) { const u = fx + fp.getX(i) - ox, v = -(fz - fp.getY(i) - oz); if (fmk && lo.rot) fg.attributes.uv.setXY(i, v, u); else fg.attributes.uv.setXY(i, u, v); }
    const f = new THREE.Mesh(fg, matFor(fid, ff.floorColor, lo && lo.pat));
    f.rotation.x = -Math.PI / 2; f.position.set(fx, 0.002, fz); f.receiveShadow = true; f.userData.room = r.id; world.add(f);
    const rc = (ceilOf(r.id) || H * 1000) / 1000;
    const cl = new THREE.Mesh(new THREE.PlaneGeometry(w, dd), matFor('paint', ff.ceil)); cl.rotation.x = Math.PI / 2; cl.position.set(f.position.x, rc, f.position.z); cl.visible = false; world.add(cl); ceilings.push(cl);
    const lb = textSprite(r.short, r.proj.toLocaleString('ru-RU') + ' м²'); lb.position.set(f.position.x, top + 0.45, f.position.z); world.add(lb); labels.push(lb);
  });
  // стены
  G.WALLS.forEach(w => {
    const m = box(X(w[0]), Z(w[1]), X(w[2]), Z(w[3]), 0, top, 'WALL'); if (m) wallMeshes.push(m);
    solids.push([X(w[0]), Z(w[1]), X(w[2]), Z(w[3])]);
  });
  // окна: подоконная часть, перемычка, рама и стекло
  G.WINDOWS.forEach(wi => {
    const [rid, key] = wi[4].split('.'), it = key.split('_')[0];
    const bal = rid === 'bal';
    const S = (val(rid, it + '_S') ?? (bal ? val('bal', 'par') ?? 1000 : 850)) / 1000;
    let T = val(rid, it + '_Top'); if (T == null) { const h = val(rid, it + '_H'); T = h ? S * 1000 + h : (bal ? H * 1000 - 50 : 2400); } T = Math.min(T / 1000, H - 0.02);
    const x1 = X(wi[0]), z1 = Z(wi[1]), x2 = X(wi[2]), z2 = Z(wi[3]);
    box(x1, z1, x2, z2, 0, Math.min(S, top), 'WALL');
    if (!WALL_LOW) box(x1, z1, x2, z2, T, H, 'WALL');
    solids.push([x1, z1, x2, z2]);
    const hor = Math.abs(x2 - x1) > Math.abs(z2 - z1);
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, t = 0.06;
    if (S < top) {
      const gy1 = S, gy2 = Math.min(T, top);
      if (hor) { box(x1, cz - 0.004, x2, cz + 0.004, gy1, gy2, matGlass, false); [[x1, x1 + t], [x2 - t, x2]].forEach(([a, b]) => box(a, cz - 0.035, b, cz + 0.035, gy1, gy2, matFrame)); box(x1, cz - 0.035, x2, cz + 0.035, gy1, gy1 + t, matFrame); if (gy2 === T) box(x1, cz - 0.035, x2, cz + 0.035, T - t, T, matFrame); if (!bal) box(x1 - 0.03, Math.min(z1, z2) - 0.05, x2 + 0.03, cz, S, S + 0.025, matSill); }
      else { box(cx - 0.004, z1, cx + 0.004, z2, gy1, gy2, matGlass, false); [[z1, z1 + t], [z2 - t, z2]].forEach(([a, b]) => box(cx - 0.035, a, cx + 0.035, b, gy1, gy2, matFrame)); box(cx - 0.035, z1, cx + 0.035, z2, gy1, gy1 + t, matFrame); }
    }
  });
  // двери: проём и перемычка над ним (полотна — на шаге 2)
  G.DOORS.forEach(d => {
    const [rid, key] = d[4].split('.'), it = key.split('_')[0];
    const dh = Math.min((val(rid, it + '_H') ?? 2100) / 1000, H - 0.05);
    const b = doorBand(d);
    if (!WALL_LOW) box(X(b[0]), Z(b[1]), X(b[2]), Z(b[3]), dh, H, 'WALL');
    doorLeaf(d, b, rid, dh, top);
  });
  // торцы срезанных стен — чуть темнее, чтобы читался план
  ceilings.forEach(c => { c.visible = MODE === 'walk'; });
  labels.forEach(l => { l.visible = MODE === 'orbit' && SHOW_LABELS; });
  updateInfo();
}

/* ---------- режимы: обзор и прогулка ---------- */
let MODE = 'orbit', SHOW_LABELS = true, SEL = null, INFO_OPEN = false;
const MOB = matchMedia('(max-width:760px)');
const foldInfo = () => { if (MOB.matches && INFO_OPEN) { INFO_OPEN = false; updateInfo(); } document.body.classList.remove('hdr-open'); };
const walk = { yaw: 0, pitch: 0, keys: {}, pos: new THREE.Vector3(), eye: 1.6 };
function roomCenter(r) { const [a, b, c, d] = r.rect; return new THREE.Vector3((X(a) + X(c)) / 2, 0, (Z(b) + Z(d)) / 2); }
function homeView(animate) {
  const tgt = new THREE.Vector3(0, 0, 0.3), pos = new THREE.Vector3(5.5, 15.5, 12.5);
  flyTo(pos, tgt, animate);
}
let fly = null;
function flyTo(pos, tgt, animate = true) {
  if (!animate) { camera.position.copy(pos); controls.target.copy(tgt); controls.update(); return; }
  fly = { t: 0, p0: camera.position.clone(), p1: pos.clone(), q0: controls.target.clone(), q1: tgt.clone() };
}
function focusRoom(r) {
  if (SEL !== r.id) INFO_OPEN = !MOB.matches; SEL = r.id; updateInfo(); renderChips();
  if (MODE === 'walk') { const c = roomCenter(r); walk.pos.set(c.x, 0, c.z); return; }
  const c = roomCenter(r), [a, b, cc, d] = r.rect, size = Math.max(X(cc) - X(a), Z(d) - Z(b));
  flyTo(new THREE.Vector3(c.x + size * 0.55, size * 1.25 + 2.2, c.z + size * 1.05), c);
}
function setMode(m) {
  MODE = m; document.body.dataset.mode = m;
  controls.enabled = m === 'orbit';
  if (m === 'walk') {
    if (WALL_LOW) { WALL_LOW = false; }
    const r = G.ROOMS.find(x => x.id === SEL) || G.ROOMS.find(x => x.id === 'r14');
    const c = roomCenter(r); walk.pos.set(c.x, 0, c.z); walk.yaw = Math.PI; walk.pitch = 0;
    camera.fov = 70; camera.updateProjectionMatrix(); INFO_OPEN = false; build();
    const wh = $('#whint'); wh.classList.remove('off'); clearTimeout(setMode.t); setMode.t = setTimeout(() => wh.classList.add('off'), 10000);
  } else { camera.fov = 45; camera.updateProjectionMatrix(); build(); homeView(false); }
  document.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
}
function blocked(x, z) {
  const r = 0.22;
  return solids.some(([a, b, c, d]) => x > Math.min(a, c) - r && x < Math.max(a, c) + r && z > Math.min(b, d) - r && z < Math.max(b, d) + r);
}
// управление прогулкой: тянуть мышью — осмотреться; WASD/стрелки — идти; колесо — вперёд/назад
let drag = null;
canvas.addEventListener('pointerdown', e => { foldInfo(); if (MODE !== 'walk') return; $('#whint').classList.add('off'); drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now() }; walk.goal = null; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => { if (!drag) return; walk.yaw -= (e.clientX - drag.x) * 0.0045; walk.pitch = Math.max(-1.2, Math.min(1.2, walk.pitch - (e.clientY - drag.y) * 0.0045)); drag = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', e => {
  if (drag && MODE === 'walk' && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 8 && performance.now() - drag.t < 350) {   // короткое касание пола — идти туда
    const rc = new THREE.Raycaster(), v = new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); rc.setFromCamera(v, camera);
    const hit = rc.intersectObjects(world.children, false).filter(h => h.object.visible && !h.object.isSprite)[0];
    if (hit) {   // пол — идти в эту точку; стена или окно — подойти к ней
      const g = new THREE.Vector3(hit.point.x, 0, hit.point.z);
      if (!(hit.point.y < 0.05)) { const dx = g.x - walk.pos.x, dz = g.z - walk.pos.z, d = Math.hypot(dx, dz) || 1, back = Math.min(0.5, d); g.x -= dx / d * back; g.z -= dz / d * back; }
      walk.goal = g;
    }
  }
  drag = null;
});
// джойстик на телефоне
const joy = $('#joy'), knob = joy.querySelector('i'); walk.joy = { x: 0, y: 0 };
const joyMove = e => { const r = joy.getBoundingClientRect(), R = r.width / 2 - 14; let dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2; const m = Math.hypot(dx, dy); if (m > R) { dx *= R / m; dy *= R / m; } walk.joy = { x: dx / R, y: dy / R }; knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)'; };
joy.addEventListener('pointerdown', e => { e.preventDefault(); $('#whint').classList.add('off'); joy.setPointerCapture(e.pointerId); joy.classList.add('on'); walk.goal = null; foldInfo(); joyMove(e); });
joy.addEventListener('pointermove', e => { if (joy.classList.contains('on')) joyMove(e); });
const joyEnd = () => { joy.classList.remove('on'); walk.joy = { x: 0, y: 0 }; knob.style.transform = ''; };
joy.addEventListener('pointerup', joyEnd); joy.addEventListener('pointercancel', joyEnd);
canvas.addEventListener('wheel', e => { if (MODE !== 'walk') return; e.preventDefault(); step(-Math.sign(e.deltaY) * 0.35, 0); }, { passive: false });
addEventListener('keydown', e => { if (/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return; walk.keys[e.code] = true; if (e.code === 'Escape') closeModal(); });
addEventListener('keyup', e => { walk.keys[e.code] = false; });
document.addEventListener('input', e => { const t = e.target; if (!t.dataset.anycolor || !SEL) return; const R = P.rooms[SEL] = P.rooms[SEL] || {}; if (t.dataset.anycolor === 'ceil') R.ceil = t.value; else if (t.dataset.anycolor === 'floorc') R.floorColor = t.value; else R.wallColor = t.value; saveP(); clearTimeout(build.t); build.t = setTimeout(build, 120); });
function step(fw, sd) {
  const s = Math.sin(walk.yaw), c = Math.cos(walk.yaw);
  const dx = -s * fw + c * sd, dz = -c * fw - s * sd;
  const nx = walk.pos.x + dx, nz = walk.pos.z + dz;
  if (!blocked(nx, walk.pos.z)) walk.pos.x = nx;
  if (!blocked(walk.pos.x, nz)) walk.pos.z = nz;
}

/* ---------- интерфейс ---------- */
function renderChips() {
  $('#rooms').innerHTML = G.ROOMS.map(r => '<button type="button" class="chip" data-room="' + r.id + '" aria-pressed="' + (SEL === r.id) + '">' + esc(r.short) + '</button>').join('');
}
const DOOR_COLORS = [['#f4f2ee', 'Белая'], ['#ece4d6', 'Слоновая кость'], ['#cfccc6', 'Светло-серая'], ['#8b7560', 'Тёплый дуб'], ['#5a4334', 'Орех'], ['#3a3c40', 'Графит'], ['#1d1d1f', 'Чёрная']];
const DOOR_TYPES = [['std', 'Обычная'], ['hidden', 'Скрытая'], ['entry', 'Входная'], ['none', 'Без двери']];
function doorSides(d) { const b = doorBand(d), hor = d[1] === d[3], am = hor ? X((d[0] + d[2]) / 2) : Z((d[1] + d[3]) / 2), c1 = hor ? Z(b[1]) : X(b[0]), c2 = hor ? Z(b[3]) : X(b[2]);
  return [hor ? roomAt(am, c1 - 0.08) : roomAt(c1 - 0.08, am), hor ? roomAt(am, c2 + 0.08) : roomAt(c2 + 0.08, am)]; }
const roomName = id => (G.ROOMS.find(r => r.id === id) || {}).short || 'коридор';
function grid(kind, cur, color) {
  const list = [...MATS.values()].filter(m => kind === 'floor' ? (m.cat === 'floor' || m.cat === 'any') && m.type !== 'paint' : (m.cat === 'wall' || m.cat === 'any'));
  return '<div class="sw">' + list.map(m => '<button type="button" class="swb' + (m.id === cur ? ' on' : '') + '" data-fin="' + kind + '" data-mat="' + m.id + '" title="' + esc(m.name) + '"><img alt="" src="' + swatch(m.id, m.colorable ? color : '') + '"><span>' + esc(m.name.replace(/^(Ламинат|Керамогранит|Плитка|Обои) · /, '')) + '</span>' + (m.user ? '<i data-delmat="' + m.id + '" title="Удалить образец">×</i>' : '') + '</button>').join('') +
    '<button type="button" class="swb add" data-imp="' + kind + '"><b>+</b><span>Свой образец</span></button></div>';
}
function colors(kind, cur) { return '<div class="pal">' + PAINTS.map(c => '<button type="button" class="pc' + (c === cur ? ' on' : '') + '" style="background:' + c + '" data-pcolor="' + kind + '" data-c="' + c + '" aria-label="' + c + '"></button>').join('') + '<label class="pc any" title="Любой цвет"><input type="color" value="' + esc(cur) + '" data-anycolor="' + kind + '"></label></div>'; }
function updateInfo() {
  const n = countVals();
  $('#src').textContent = M.src === 'server' ? 'Замеры из «Обмера» · ' + n : M.src === 'local' ? 'Замеры из этого браузера · ' + n : 'По эскизу — замеры не подключены';
  $('#src').dataset.ok = M.src === 'sketch' ? '0' : '1';
  const r = G.ROOMS.find(x => x.id === SEL);
  if (!r) { $('#info').hidden = true; return; }
  const W = val(r.id, 'W'), L = val(r.id, 'L'), c = ceilOf(r.id), f = fin(r.id);
  const [a, b, cc, d] = r.rect, sw = (cc - a) * K, sl = (d - b) * K;
  const wm = MATS.get(f.walls) || MATS.get('paint'), fm = MATS.get(f.floor) || MATS.get('lam-nat');
  const doors = G.DOORS.filter(dd => doorSides(dd).includes(r.id) || dd[4].split('.')[0] === r.id);
  const tab = $('#info').dataset.tab || 'floor';
  $('#info').hidden = false;
  $('#info').classList.toggle('folded', MOB.matches && !INFO_OPEN);
  $('#info').innerHTML = '<div class="ih"><b data-act="fold">' + esc(r.name) + '</b><button type="button" class="fold" data-act="fold" aria-label="' + (INFO_OPEN ? 'Свернуть' : 'Развернуть') + '">' + (INFO_OPEN ? '▾' : '▴') + '</button><button type="button" class="x" data-act="unsel" aria-label="Закрыть">×</button></div>' +
    '<div class="kv"><span>По эскизу</span><b>' + fmt(sw) + ' × ' + fmt(sl) + ' мм</b></div>' +
    (W && L ? '<div class="kv"><span>По замеру</span><b>' + fmt(W) + ' × ' + fmt(L) + ' мм · ' + (W * L / 1e6).toFixed(2).replace('.', ',') + ' м²</b></div>' : '<div class="kv"><span>Площадь по проекту</span><b>' + r.proj.toLocaleString('ru-RU') + ' м²</b></div>') +
    '<div class="kv"><span>Потолок</span><b>' + (c ? fmt(c) + ' мм (замер)' : fmt(H * 1000) + ' мм' + (ceilAll() ? ' (среднее)' : ' (условно)')) + '</b></div>' +
    (() => { const ms = missing(r.id); return ms.length ? '<div class="need"><b>Не хватает замеров: ' + ms.length + '</b><span>' + esc(ms.slice(0, 4).join(', ')) + (ms.length > 4 ? '…' : '') + '</span><button type="button" class="btn ghost" data-measure="' + r.id + '">Замерить в «Обмере» →</button></div>' : '<div class="need ok"><b>Замеры комнаты полные</b><button type="button" class="btn ghost" data-measure="' + r.id + '">Открыть в «Обмере»</button></div>'; })() +
    '<div class="tabs" role="group">' + [['floor', 'Пол'], ['walls', 'Стены'], ['ceil', 'Потолок'], ['doors', 'Двери']].map(([k, l]) => '<button type="button" data-tab="' + k + '" aria-pressed="' + (tab === k) + '">' + l + '</button>').join('') + '</div>' +
    (tab === 'floor' ? '<button type="button" class="btn lay" data-lay="floor">Раскладка и расчёт пола →</button><p class="cur">' + esc(fm.name) + '</p>' + grid('floor', f.floor, f.floorColor) + (fm.colorable ? '<p class="sub">Цвет</p>' + colors('floorc', f.floorColor) : '') : '') +
    (tab === 'walls' ? '<button type="button" class="btn lay" data-lay="walls">Раскладка и расчёт стен →</button><p class="cur">' + esc(wm.name) + (wm.colorable ? ' · <span class="dot" style="background:' + f.wallColor + '"></span>' + f.wallColor : '') + '</p>' + grid('walls', f.walls, f.wallColor) + (wm.colorable ? '<p class="sub">Цвет</p>' + colors('walls', f.wallColor) : '') : '') +
    (tab === 'ceil' ? '<p class="sub">Цвет потолка</p>' + colors('ceil', f.ceil) + '<p class="muted">Потолок виден в режиме «Прогулка».</p>' : '') +
    (tab === 'doors' ? (doors.length ? doors.map(dd => { const cf = doorCfg(dd[4]), sd = doorSides(dd).filter(Boolean); return '<div class="door"><b>' + esc(sd.length === 2 ? roomName(sd[0]) + ' ↔ ' + roomName(sd[1]) : dd[4] === 'hall.d1_W' ? 'Входная дверь' : 'Дверь ' + roomName(sd[0])) + '</b>' +
      '<div class="seg2">' + DOOR_TYPES.map(([k, l]) => '<button type="button" data-door="' + dd[4] + '" data-dtype="' + k + '" aria-pressed="' + (cf.type === k) + '">' + l + '</button>').join('') + '</div>' +
      (cf.type === 'std' || cf.type === 'entry' ? '<div class="pal">' + DOOR_COLORS.map(([c, l]) => '<button type="button" class="pc' + (c === cf.color ? ' on' : '') + '" style="background:' + c + '" data-door="' + dd[4] + '" data-dcolor="' + c + '" title="' + l + '"></button>').join('') + '</div>' : cf.type === 'hidden' ? '<p class="muted">Полотно заподлицо со стеной, в отделке комнаты «' + esc(roomName(dd[4].split('.')[0])) + '».</p>' : '') + '</div>'; }).join('') : '<p class="muted">В этой комнате нет дверных проёмов.</p>') : '');
}
document.addEventListener('click', e => {
  const del = e.target.closest('[data-delmat]');
  if (del) { e.stopPropagation(); const id = del.dataset.delmat; if (!confirm('Удалить свой образец «' + (MATS.get(id) || {}).name + '»?')) return;
    removeUser(id).then(() => { Object.values(P.rooms).forEach(o => { if (o.floor === id) delete o.floor; if (o.walls === id) delete o.walls; }); delete P.mats[id]; if (!P.matsDel.includes(id)) P.matsDel.push(id); saveP(); build(); if (WEBTOK) api('rimg_del', { mid: id }).catch(() => {}); }); return; }
  const ms = e.target.closest('[data-measure]'); if (ms) { openMeasure(ms.dataset.measure); return; }
  const ly = e.target.closest('[data-lay]');
  if (ly && SEL) { const rid = SEL, r = G.ROOMS.find(x => x.id === rid), f = fin(rid), sf = surfacesOf(rid); P.lay[rid] = P.lay[rid] || {};
    openLayout({ title: r.name, start: ly.dataset.lay, surf: sf, plan: sf.plan, wallSides: WALL_KEYS, cfg: P.lay[rid],
      mat: { floor: { m: MATS.get(f.floor) || MATS.get('lam-nat') }, walls: { m: MATS.get(f.walls) || MATS.get('paint') } }, save: () => { saveP(); build(); } });
    return; }
  const f2 = e.target.closest('[data-fin],[data-tab],[data-pcolor],[data-dtype],[data-dcolor],[data-imp]');
  if (f2 && SEL) {
    const R = P.rooms[SEL] = P.rooms[SEL] || {};
    if (f2.dataset.tab) { $('#info').dataset.tab = f2.dataset.tab; updateInfo(); return; }
    if (f2.dataset.fin) { R[f2.dataset.fin === 'floor' ? 'floor' : 'walls'] = f2.dataset.mat; }
    else if (f2.dataset.pcolor) { const k = f2.dataset.pcolor; if (k === 'ceil') R.ceil = f2.dataset.c; else if (k === 'floorc') R.floorColor = f2.dataset.c; else R.wallColor = f2.dataset.c; }
    else if (f2.dataset.dtype) { P.doors[f2.dataset.door] = Object.assign(doorCfg(f2.dataset.door), { type: f2.dataset.dtype }); }
    else if (f2.dataset.dcolor) { P.doors[f2.dataset.door] = Object.assign(doorCfg(f2.dataset.door), { color: f2.dataset.dcolor }); }
    else if (f2.dataset.imp) { const kind = f2.dataset.imp, rid = SEL; openImporter({ cat: kind === 'floor' ? 'floor' : 'wall', onDone: id => { const RR = P.rooms[rid] = P.rooms[rid] || {}; RR[kind === 'floor' ? 'floor' : 'walls'] = id; saveP(); build(); syncMats(); } }); return; }
    saveP(); build(); return;
  }
  const t = e.target.closest('[data-room],[data-mode],[data-act]'); if (!t) return;
  if (t.dataset.room) { const r = G.ROOMS.find(x => x.id === t.dataset.room); if (r) focusRoom(r); return; }
  if (t.dataset.mode) { setMode(t.dataset.mode); return; }
  const a = t.dataset.act;
  if (a === 'home') { SEL = null; renderChips(); updateInfo(); if (MODE === 'orbit') homeView(true); }
  else if (a === 'cut') { WALL_LOW = !WALL_LOW; t.setAttribute('aria-pressed', String(WALL_LOW)); build(); }
  else if (a === 'labels') { SHOW_LABELS = !SHOW_LABELS; t.setAttribute('aria-pressed', String(SHOW_LABELS)); labels.forEach(l => { l.visible = MODE === 'orbit' && SHOW_LABELS; }); }
  else if (a === 'shot') { renderer.render(scene, camera); const u = canvas.toDataURL('image/png'); const l = document.createElement('a'); l.href = u; l.download = 'remont-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.png'; l.click(); }
  else if (a === 'unsel') { SEL = null; INFO_OPEN = false; renderChips(); updateInfo(); }
  else if (a === 'fold') { INFO_OPEN = !INFO_OPEN; updateInfo(); }
  else if (a === 'more') { const o = document.body.classList.toggle('hdr-open'); t.setAttribute('aria-expanded', String(o)); }
  else if (a === 'login') openLogin();
  else if (a === 'close') closeModal();
  else if (a === 'logout') { ls.set('obmer-webtok', ''); WEBTOK = ''; SY.on = false; setSync(); M.vals = {}; M.src = 'sketch'; loadLocalVals(); build(); closeModal(); }
});

/* ---------- замеры с сервера «Обмера»: тот же вход через Telegram ---------- */
let WEBTOK = ls.get('obmer-webtok') || '';
async function api(op, data) {
  const r = await fetch(SYNC_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ op, initData: '', token: WEBTOK || undefined }, data || {})) });
  const j = await r.json(); if (!j.ok) { const e = new Error(j.err || 'fail'); e.code = j.err; throw e; } return j;
}
async function loadServer() {
  if (!WEBTOK) return false;
  try {
    const h = await api(M.src === 'server' ? 'pull' : 'hello'); const v = {};
    Object.keys(h.rooms || {}).forEach(rid => { v[rid] = (h.rooms[rid] && h.rooms[rid].values) || {}; });
    const changed = M.src !== 'server' || JSON.stringify(v) !== JSON.stringify(M.vals);
    M.vals = v; M.src = 'server'; if (h.you) M.me = h.you; if (changed) build(); return true;
  } catch (e) { if (e.code === 'auth') { WEBTOK = ''; ls.set('obmer-webtok', ''); } return false; }
}
const WL = { secret: '', code: '', pin: '', bot: '', timer: 0 };
const hexOf = buf => Array.from(new Uint8Array(buf)).map(b => ('0' + b.toString(16)).slice(-2)).join('');
const pinOf = code => ('000' + (parseInt(String(code).slice(0, 8), 16) % 10000)).slice(-4);
function modal(html) { closeModal(); const m = document.createElement('div'); m.className = 'modal'; m.id = 'modal'; m.innerHTML = '<div class="mi" role="dialog" aria-modal="true">' + html + '</div>'; m.addEventListener('click', e => { if (e.target === m) closeModal(); }); document.body.appendChild(m); }
function closeModal() { const m = $('#modal'); if (m) m.remove(); clearInterval(WL.timer); WL.timer = 0; }
async function openLogin() {
  if (WEBTOK) {
    modal('<h3>Замеры из «Обмера»</h3><p>Подключено' + (M.me ? ' как <b>' + esc(M.me.name) + '</b>' : '') + '. Размеров: ' + countVals() + '. Модель берёт высоту потолков, окна и двери из ваших замеров.</p><div class="row"><button type="button" class="btn" data-act="close">Готово</button><button type="button" class="btn ghost" data-act="logout">Отключить</button></div>');
    return;
  }
  modal('<h3>Подключить замеры из «Обмера»</h3><p>Готовлю вход…</p>');
  try {
    const b = new Uint8Array(32); crypto.getRandomValues(b); WL.secret = hexOf(b);
    WL.code = hexOf(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(WL.secret))).slice(0, 16); WL.pin = pinOf(WL.code);
    const r = await api('web_start', { code: WL.code }); WL.bot = r.bot || 'obmer77_bot';
  } catch (e) { modal('<h3>Нет связи с сервером «Обмера»</h3><p>Проверьте интернет и попробуйте ещё раз.</p><div class="row"><button type="button" class="btn" data-act="login">Повторить</button></div>'); return; }
  modal('<h3>Подключить замеры из «Обмера»</h3><p>Откройте «Обмер» в Telegram по кнопке и нажмите там «Разрешить вход». Код должен совпасть:</p><div class="pin">' + WL.pin + '</div>' +
    '<div class="row"><a class="btn" href="tg://resolve?domain=' + esc(WL.bot) + '&appname=obmer77&startapp=web_' + WL.code + '">Открыть Telegram</a><a class="btn ghost" target="_blank" rel="noopener" href="https://t.me/' + esc(WL.bot) + '/obmer77?startapp=web_' + WL.code + '">Через t.me</a></div><p class="muted">Окно закроется само, когда вход подтвердится.</p>');
  WL.timer = setInterval(async () => {
    try { const r = await api('web_poll', { secret: WL.secret, ua: 'Ремонт · ' + (/Mac/.test(navigator.userAgent) ? 'Mac' : /Windows/.test(navigator.userAgent) ? 'Windows' : 'браузер') });
      if (r.token) { WEBTOK = r.token; ls.set('obmer-webtok', r.token); closeModal(); await loadServer(); await syncProject(); } } catch (e) {}
  }, 2500);
}

/* ---------- проект «Ремонта» на сервере «Обмера»: отделка, раскладка и свои образцы на всех устройствах ---------- */
function setSync() {
  const el = $('#sync'); if (!el) return;
  const t = !WEBTOK ? 'Только в этом браузере' : SY.err ? 'Нет связи — сохраню позже' : SY.dirty ? 'Сохраняю…' : SY.busy ? 'Сверяю с «Обмером»…' : 'Сохранено в «Обмере»';
  el.textContent = t; el.dataset.ok = WEBTOK && !SY.err && !SY.dirty ? '1' : WEBTOK ? '2' : '0';
}
function pushSoon() { clearTimeout(SY.t); if (WEBTOK) SY.t = setTimeout(pushProject, 1500); }
const isObj = x => x && typeof x === 'object' && !Array.isArray(x);
function mergeDoc(base, mine) {   // сервер + мои несохранённые правки (мои важнее)
  const out = JSON.parse(JSON.stringify(base || {}));
  ['rooms', 'doors', 'lay', 'mats'].forEach(k => { out[k] = Object.assign({}, isObj(out[k]) ? out[k] : {}, isObj(mine[k]) ? mine[k] : {}); });
  out.matsDel = [...new Set([...(out.matsDel || []), ...(mine.matsDel || [])])];
  out.matsDel.forEach(id => { delete out.mats[id]; });
  return out;
}
async function pushProject(force) {
  if (!WEBTOK || SY.busy) { if (SY.busy) pushSoon(); return; }
  SY.busy = true; setSync();
  try {
    const r = await api('rput', { doc: P, base: SY.at, force: !!force });
    SY.at = r.at; ls.set('remont-at', String(r.at)); SY.dirty = false; ls.set('remont-dirty', ''); SY.err = '';
  } catch (e) {
    if (e.code === 'conflict') { SY.busy = false; await syncProject(); return; }
    SY.err = e.code || 'net'; clearTimeout(SY.t); SY.t = setTimeout(pushProject, 10000);
  }
  SY.busy = false; setSync();
}
async function syncProject() {
  if (!WEBTOK || SY.busy) return;
  SY.busy = true; setSync();
  let changed = false;
  try {
    const r = await api('rget', { at: SY.dirty ? 0 : SY.at });
    if (!r.same && r.doc) {
      P = SY.dirty ? mergeDoc(r.doc, P) : r.doc; fixP(); changed = true;
      SY.at = r.at; ls.set('remont-at', String(r.at)); saveP(true);
    } else if (!r.doc && !r.same) SY.dirty = true;
    SY.err = ''; SY.on = true;
  } catch (e) { SY.err = e.code || 'net'; if (e.code === 'auth') { WEBTOK = ''; ls.set('obmer-webtok', ''); } }
  SY.busy = false;
  if (changed) build();
  if (SY.dirty) await pushProject(true); else setSync();
  syncMats();
}
let matsBusy = false, changedM = false;
async function syncMats() {
  if (!WEBTOK || matsBusy) return; matsBusy = true;
  try {
    // удалённые на другом устройстве
    for (const id of P.matsDel) if (MATS.has(id)) { await removeUser(id); changedM = true; }
    // свои образцы, которых ещё нет на сервере
    for (const m of [...MATS.values()].filter(x => x.user && !P.mats[x.id] && !P.matsDel.includes(x.id))) {
      const rec = m.rec; if (!rec || !rec.data) continue;
      await api('rimg_put', { mid: rec.id, data: rec.data });
      const meta = Object.assign({}, rec); delete meta.data; P.mats[rec.id] = meta; saveP();
    }
    // образцы с других устройств
    const need = Object.keys(P.mats).filter(id => !MATS.has(id));
    for (let i = 0; i < need.length; i += 4) {
      const r = await api('rimg_get', { mids: need.slice(i, i + 4) });
      for (const id of Object.keys(r.imgs || {})) { await storeRecord(Object.assign({}, P.mats[id], { data: r.imgs[id] })); changedM = true; }
    }
  } catch (e) {}
  matsBusy = false;
  if (changedM) { changedM = false; build(); }
}

function poll() { if (document.hidden || !WEBTOK) return; loadServer(); if (!SY.dirty) syncProject(); }
setInterval(poll, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });

/* ---------- чего не хватает в замерах и переход в «Обмер» ---------- */
const OBMER_TG = rid => 'https://t.me/obmer77_bot/obmer77?startapp=room_' + rid;
const OBMER_WEB = rid => 'https://yradkin.github.io/priemka/#room=' + rid;
function missing(rid) {
  const m = [], has = k => val(rid, k) != null;
  if (!has('W')) m.push('ширина комнаты');
  if (!has('L')) m.push(rid === 'bal' ? 'глубина' : 'длина комнаты');
  if (!ceilOf(rid)) m.push('высота потолка');
  if (rid === 'bal' && !has('par')) m.push('высота парапета');
  const own = q => q[4].split('.')[0] === rid, itOf = q => q[4].split('.')[1].split('_')[0];
  const ds = G.DOORS.filter(own), ws = G.WINDOWS.filter(own);
  ds.forEach((q, i) => { const it = itOf(q), n = ds.length > 1 ? ' ' + (i + 1) : ''; if (!has(it + '_W')) m.push('дверь' + n + ': ширина'); if (!has(it + '_H')) m.push('дверь' + n + ': высота'); });
  ws.forEach((q, i) => { const it = itOf(q), n = ws.length > 1 ? ' ' + (i + 1) : ''; if (!has(it + '_W')) m.push('окно' + n + ': ширина'); if (!has(it + '_S')) m.push('окно' + n + ': подоконник'); if (!has(it + '_Top') && !has(it + '_H')) m.push('окно' + n + ': верх проёма'); });
  return m;
}
function qrSvg(text) {
  if (typeof qrcode !== 'function') return '';
  const q = qrcode(0, 'M'); q.addData(text); q.make(); const n = q.getModuleCount(); let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += 'M' + (x + 2) + ' ' + (y + 2) + 'h1v1h-1z';
  return '<svg viewBox="0 0 ' + (n + 4) + ' ' + (n + 4) + '" class="qr" role="img" aria-label="QR-код"><rect width="' + (n + 4) + '" height="' + (n + 4) + '" fill="#fff"/><path d="' + d + '" fill="#111"/></svg>';
}
function openMeasure(rid) {
  const r = G.ROOMS.find(x => x.id === rid), ms = missing(rid);
  modal('<h3>Замерить: ' + esc(r.name) + '</h3>' + (ms.length ? '<p>Не хватает: ' + esc(ms.join(', ')) + '.</p>' : '<p>Все размеры для этой комнаты уже есть. Можно уточнить.</p>') +
    '<div class="qrbox">' + qrSvg(OBMER_TG(rid)) + '<p class="muted">Наведите камеру телефона — откроется «Обмер» в Telegram сразу на этой комнате. Что внесёте там, появится здесь само (раз в 30 секунд или когда вернётесь на вкладку).</p></div>' +
    '<div class="row"><a class="btn" target="_blank" rel="noopener" href="' + OBMER_TG(rid) + '">Открыть в Telegram</a><a class="btn ghost" target="_blank" rel="noopener" href="' + OBMER_WEB(rid) + '">В браузере</a><button type="button" class="btn ghost" data-act="close">Закрыть</button></div>');
}

/* ---------- цикл ---------- */
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { scene.background = dark() ? BG.dark : BG.light; });
const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(0.05, clock.getDelta());
  if (fly) { fly.t = Math.min(1, fly.t + dt / 0.9); const e = 1 - Math.pow(1 - fly.t, 3); camera.position.lerpVectors(fly.p0, fly.p1, e); controls.target.lerpVectors(fly.q0, fly.q1, e); if (fly.t >= 1) fly = null; }
  if (MODE === 'walk') {
    const k = walk.keys, sp = (k.ShiftLeft || k.ShiftRight ? 2.6 : 1.4) * dt;
    const fw = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0), sd = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0);
    if (k.ArrowLeft) walk.yaw += 1.8 * dt; if (k.ArrowRight) walk.yaw -= 1.8 * dt;
    if (fw || sd) step(fw * sp, sd * sp);
    const J = walk.joy; if (J && (J.x || J.y)) { const m = Math.min(1, Math.hypot(J.x, J.y)), s1 = 1.6 * dt * m; step(-J.y / (m || 1) * s1 * (Math.abs(J.y) > 0.15 ? 1 : 0), J.x / (m || 1) * s1 * 0.8 * (Math.abs(J.x) > 0.15 ? 1 : 0)); }
    if (walk.goal) { const dx = walk.goal.x - walk.pos.x, dz = walk.goal.z - walk.pos.z, d = Math.hypot(dx, dz); if (d < 0.08) walk.goal = null; else { const s2 = Math.min(d, 1.5 * dt), ox = walk.pos.x, oz = walk.pos.z, nx = ox + dx / d * s2, nz = oz + dz / d * s2; if (!blocked(nx, oz)) walk.pos.x = nx; if (!blocked(walk.pos.x, nz)) walk.pos.z = nz; if (walk.pos.x === ox && walk.pos.z === oz) walk.goal = null; } }
    camera.position.set(walk.pos.x, walk.eye, walk.pos.z);
    const d = new THREE.Vector3(-Math.sin(walk.yaw) * Math.cos(walk.pitch), Math.sin(walk.pitch), -Math.cos(walk.yaw) * Math.cos(walk.pitch));
    camera.lookAt(camera.position.clone().add(d));
  } else controls.update();
  if (!window.__pause) renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

loadLocalVals();
renderChips(); resize(); build(); homeView(false); tick();
loadLibrary().then(n => { if (n) build(); });
loadServer().then(() => syncProject()); setSync();
const deep = () => { const m = location.hash.match(/^#room=([a-z0-9_]+)/); const r = m && G.ROOMS.find(x => x.id === m[1]); if (r) focusRoom(r); };
addEventListener('hashchange', deep); setTimeout(deep, 300);
window.__app = { walk, scene, camera, setMode, focusRoom: id => focusRoom(G.ROOMS.find(r => r.id === id)), M, build, SY, getP: () => P };

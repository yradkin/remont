/* Материалы отделки: встроенная база и свои образцы из фото (из интернет-магазинов).
   Каждая текстура — ровно один «повтор» рисунка реального размера w×h мм; UV в сцене — в метрах. */
import * as THREE from 'three';

export const MATS = new Map();      // id → описание материала
const TEX = new Map();              // id → THREE.Texture
const MAT = new Map();              // id|цвет → THREE.Material
const SW = new Map();               // id|цвет → dataURL миниатюры

/* ---------- генераторы ---------- */
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const clamp = v => Math.max(0, Math.min(255, v | 0));
function noise(g, W, H, base, amp, blobs, size) {   // мягкий шум пятнами
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  for (let i = 0; i < blobs; i++) {
    const x = rnd() * W, y = rnd() * H, r = (0.3 + rnd()) * size, v = rnd() < 0.5 ? 0 : 255;
    for (const [dx, dy] of [[0, 0], [W, 0], [-W, 0], [0, H], [0, -H]]) {   // повтор по краям — бесшовно
      const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
      gr.addColorStop(0, `rgba(${v},${v},${v},${amp * rnd()})`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
      g.fillStyle = gr; g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
    }
  }
}
function grain(g, W, H, amp) { const d = g.getImageData(0, 0, W, H), a = d.data; for (let i = 0; i < a.length; i += 4) { const n = (rnd() - 0.5) * amp; a[i] = clamp(a[i] + n); a[i + 1] = clamp(a[i + 1] + n); a[i + 2] = clamp(a[i + 2] + n); } g.putImageData(d, 0, 0); }
function planks(rgb, dark) {   // ламинат: 4 ряда досок со смещением, волокна
  return (g, W, H) => {
    const rows = 4, bh = H / rows, [r0, g0, b0] = rgb;
    for (let r = 0; r < rows; r++) {
      const off = [0, 0.5, 0.25, 0.75][r] * W;
      for (let k = -1; k < 2; k++) {
        const x = off + k * W, j = (rnd() - 0.5) * 26;
        g.fillStyle = `rgb(${clamp(r0 + j)},${clamp(g0 + j)},${clamp(b0 + j)})`; g.fillRect(x, r * bh, W, bh);
        for (let i = 0; i < 22; i++) {
          g.strokeStyle = `rgba(${dark},${0.04 + rnd() * 0.1})`; g.lineWidth = 0.6 + rnd() * 2.2; g.beginPath();
          const y = r * bh + rnd() * bh; g.moveTo(x, y); g.bezierCurveTo(x + W * 0.3, y + rnd() * 5 - 2.5, x + W * 0.6, y + rnd() * 5 - 2.5, x + W, y + rnd() * 3 - 1.5); g.stroke();
        }
        if (rnd() < 0.6) { const kx = x + rnd() * W, ky = r * bh + bh * (0.3 + rnd() * 0.4); g.fillStyle = `rgba(${dark},.18)`; g.beginPath(); g.ellipse(kx, ky, 6 + rnd() * 8, 2 + rnd() * 3, 0, 0, 7); g.fill(); }
        g.fillStyle = `rgba(${dark},.45)`; g.fillRect(x, r * bh, 1.5, bh);
      }
      g.fillStyle = `rgba(${dark},.4)`; g.fillRect(0, r * bh, W, 1.5);
    }
    grain(g, W, H, 10);
  };
}
function stone(base, amp, blobs, size, veins) {
  return (g, W, H) => {
    noise(g, W, H, base, amp, blobs, size * W);
    if (veins) for (let i = 0; i < veins; i++) {
      g.strokeStyle = `rgba(90,90,95,${0.12 + rnd() * 0.2})`; g.lineWidth = 0.8 + rnd() * 2.5; g.beginPath();
      let x = rnd() * W, y = rnd() * H; g.moveTo(x, y);
      for (let s = 0; s < 14; s++) { x += (rnd() - 0.3) * W * 0.12; y += (rnd() - 0.5) * H * 0.12; g.lineTo(x, y); }
      g.stroke();
    }
    grain(g, W, H, 6);
  };
}
function terrazzo(g, W, H) { noise(g, W, H, '#e7e2da', 0.05, 30, W * 0.3); const cs = ['#9a9187', '#c9b8a3', '#6f6a64', '#d8cdbf', '#b8a48d']; for (let i = 0; i < 320; i++) { g.fillStyle = cs[(rnd() * cs.length) | 0]; g.beginPath(); const x = rnd() * W, y = rnd() * H, r = 1 + rnd() * 6; g.moveTo(x + r, y); for (let a = 1; a < 6; a++) g.lineTo(x + Math.cos(a * 1.2 + rnd()) * r, y + Math.sin(a * 1.2 + rnd()) * r); g.fill(); } grain(g, W, H, 5); }
function linen(g, W, H) { g.fillStyle = '#f1ece4'; g.fillRect(0, 0, W, H); for (let y = 0; y < H; y += 2) { g.fillStyle = `rgba(120,105,85,${0.03 + rnd() * 0.05})`; g.fillRect(0, y, W, 1); } for (let x = 0; x < W; x += 2) { g.fillStyle = `rgba(120,105,85,${0.03 + rnd() * 0.05})`; g.fillRect(x, 0, 1, H); } grain(g, W, H, 8); }
function brick(g, W, H) {   // белый кирпич 250×65, шов 10
  g.fillStyle = '#cfc9c0'; g.fillRect(0, 0, W, H); const rows = 4, bh = H / rows;
  for (let r = 0; r < rows; r++) { const off = r % 2 ? W / 2 : 0; for (let k = -1; k < 2; k++) { const x = off + k * W, v = 236 + rnd() * 14; g.fillStyle = `rgb(${v},${v - 2},${v - 6})`; g.fillRect(x + W * 0.02, r * bh + bh * 0.07, W * 0.96, bh * 0.86); } }
  grain(g, W, H, 14);
}

/* ---------- встроенная база ---------- */
const def = (id, o) => MATS.set(id, Object.assign({ id, rough: 0.8, env: 0.5, builtin: true }, o));
def('lam-nat', { name: 'Ламинат · дуб натуральный', cat: 'floor', type: 'wood', w: 1380, h: 772, piece: [1380, 193], draw: planks([196, 160, 112], '90,60,30'), rough: 0.55 });
def('lam-light', { name: 'Ламинат · дуб светлый', cat: 'floor', type: 'wood', w: 1380, h: 772, piece: [1380, 193], draw: planks([222, 200, 168], '120,95,60'), rough: 0.55 });
def('lam-grey', { name: 'Ламинат · дуб серый', cat: 'floor', type: 'wood', w: 1380, h: 772, piece: [1380, 193], draw: planks([176, 168, 156], '80,75,70'), rough: 0.55 });
def('lam-walnut', { name: 'Ламинат · орех', cat: 'floor', type: 'wood', w: 1380, h: 772, piece: [1380, 193], draw: planks([120, 82, 56], '50,30,15'), rough: 0.5 });
def('tile-600-lgrey', { name: 'Керамогранит 600×600 · светло-серый', cat: 'any', type: 'tile', w: 600, h: 600, grout: 2, groutColor: '#b9b5ae', draw: stone('#d9d6d1', 0.06, 40, 0.25), rough: 0.45 });
def('tile-600-concrete', { name: 'Керамогранит 600×600 · бетон', cat: 'any', type: 'tile', w: 600, h: 600, grout: 2, groutColor: '#8f8b85', draw: stone('#a9a59f', 0.12, 120, 0.12), rough: 0.7 });
def('tile-1200-marble', { name: 'Керамогранит 1200×600 · мрамор', cat: 'any', type: 'tile', w: 1200, h: 600, grout: 1.5, groutColor: '#d8d6d2', draw: stone('#efedea', 0.04, 30, 0.3, 9), rough: 0.18, env: 0.9 });
def('tile-600-terrazzo', { name: 'Керамогранит 600×600 · терраццо', cat: 'any', type: 'tile', w: 600, h: 600, grout: 2, groutColor: '#cfc9c0', draw: terrazzo, rough: 0.4 });
def('tile-300x600-white', { name: 'Плитка 300×600 · белая глянцевая', cat: 'wall', type: 'tile', w: 300, h: 600, grout: 2, groutColor: '#e4e2de', draw: stone('#f4f3f1', 0.02, 20, 0.3), rough: 0.12, env: 1 });
def('paint', { name: 'Краска', cat: 'wall', type: 'paint', colorable: true, rough: 0.9, env: 0.45 });
def('plaster', { name: 'Декоративная штукатурка', cat: 'wall', type: 'tex', w: 1000, h: 1000, colorable: true, draw: (g, W, H) => { noise(g, W, H, '#ffffff', 0.09, 260, W * 0.08); grain(g, W, H, 7); }, rough: 0.75 });
def('microcement', { name: 'Микроцемент', cat: 'any', type: 'tex', w: 1000, h: 1000, colorable: true, draw: (g, W, H) => { noise(g, W, H, '#ffffff', 0.11, 180, W * 0.14); grain(g, W, H, 5); }, rough: 0.6 });
def('wall-linen', { name: 'Обои · лён', cat: 'wall', type: 'paper', w: 530, h: 530, draw: linen, rough: 0.9 });
def('wall-brick', { name: 'Кирпич белый 250×65', cat: 'wall', type: 'tex', w: 260, h: 300, draw: brick, rough: 0.9 });
export const PAINTS = ['#f3f0ea', '#e9e3d8', '#d8d2c7', '#c9c4bb', '#b8b2a6', '#8f8a80', '#5c5953', '#2f3133', '#e8dcc8', '#d9c2a6', '#a98c6e', '#7a5a42', '#c9d3c4', '#9aab92', '#5e6f5a', '#c7d3dc', '#8aa0b2', '#3d4f63', '#e9c9bf', '#c88f7f'];

/* ---------- текстуры и материалы ---------- */
function texFor(d, pat) {
  if (pat === 'half' || pat === 'third') {   // ряды со сдвигом: текстура на 2–3 ряда
    const key = d.id + '#' + pat; if (TEX.has(key)) return TEX.get(key);
    const base = texFor(d).image, n = pat === 'half' ? 2 : 3, W = base.width, H = base.height;
    const c = document.createElement('canvas'); c.width = W; c.height = H * n; const g = c.getContext('2d');
    for (let r = 0; r < n; r++) { const off = Math.round(r * W / n); g.drawImage(base, off, r * H); g.drawImage(base, off - W, r * H); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    const p = per(d); t.repeat.set(1000 / p[0], 1000 / (p[1] * n)); TEX.set(key, t); return t;
  }
  if (TEX.has(d.id)) return TEX.get(d.id);
  let c;
  if (d.img) {   // свой образец: картинка + шов
    c = composeTile(d.img, d);
  } else {
    const sc = 1024 / Math.max(d.w, d.h); const W = Math.round(d.w * sc), H = Math.round(d.h * sc);
    c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    seed = [...d.id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) % 2147483647 || 7;
    d.draw(g, W, H);
    if (d.type === 'tile' && d.grout) groutLines(g, W, H, d.grout * sc, d.groutColor);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8; const p = per(d); t.repeat.set(1000 / p[0], 1000 / p[1]); TEX.set(d.id, t); return t;
}
const per = d => d.type === 'tile' ? [d.w + (d.grout || 0), d.h + (d.grout || 0)] : [d.w, d.h];   // шаг рисунка с учётом шва
function groutLines(g, W, H, gw, col) { gw = Math.max(1, gw); g.fillStyle = col || '#bdb8b0'; g.fillRect(0, 0, W, gw / 2); g.fillRect(0, H - gw / 2, W, gw / 2); g.fillRect(0, 0, gw / 2, H); g.fillRect(W - gw / 2, 0, gw / 2, H); }
function composeTile(img, d) {
  const sc = 1024 / Math.max(d.w, d.h); const W = Math.max(8, Math.round(d.w * sc)), H = Math.max(8, Math.round(d.h * sc));
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(img, 0, 0, W, H);
  if (d.type === 'tile' && d.grout) groutLines(g, W, H, d.grout * sc, d.groutColor);
  return c;
}
export function matFor(id, color, pat) {
  const d = MATS.get(id) || MATS.get('paint');
  if (d.type !== 'tile' || (pat !== 'half' && pat !== 'third')) pat = '';
  const key = d.id + '|' + (d.colorable ? color || '' : '') + (pat ? '|' + pat : '');
  if (MAT.has(key)) return MAT.get(key);
  const m = new THREE.MeshStandardMaterial({ roughness: d.rough, metalness: 0, envMapIntensity: d.env });
  if (d.type !== 'paint') m.map = texFor(d, pat);
  if (d.colorable) m.color.set(color || '#f1ede6');
  MAT.set(key, m); return m;
}
export function swatch(id, color) {
  const d = MATS.get(id); if (!d) return '';
  const key = id + '|' + (d.colorable ? color || '' : '');
  if (SW.has(key)) return SW.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d');
  if (d.type === 'paint') { g.fillStyle = color || '#f1ede6'; g.fillRect(0, 0, 96, 96); }
  else {
    const src = texFor(d).image, mm = 1000 * 96 / 120;   // миниатюра ≈ 1,2 × 1,2 м поверхности
    const pw = 96 * d.w / 1200, ph = 96 * d.h / 1200;
    for (let x = 0; x < 96; x += pw) for (let y = 0; y < 96; y += ph) g.drawImage(src, x, y, pw, ph);
    if (d.colorable) { g.globalCompositeOperation = 'multiply'; g.fillStyle = color || '#f1ede6'; g.fillRect(0, 0, 96, 96); g.globalCompositeOperation = 'source-over'; }
  }
  const u = c.toDataURL('image/png'); SW.set(key, u); return u;
}

/* ---------- своя библиотека (IndexedDB этого браузера) ---------- */
let dbp = null;
function db() { if (!dbp) dbp = new Promise((res, rej) => { const r = indexedDB.open('remont', 1); r.onupgradeneeded = () => r.result.createObjectStore('mats', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); return dbp; }
async function dbAll() { try { const d = await db(); return await new Promise(res => { const q = d.transaction('mats').objectStore('mats').getAll(); q.onsuccess = () => res(q.result || []); q.onerror = () => res([]); }); } catch (e) { return []; } }
async function dbPut(o) { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('mats', 'readwrite'); t.objectStore('mats').put(o); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
export async function dbDel(id) { const d = await db(); return new Promise(res => { const t = d.transaction('mats', 'readwrite'); t.objectStore('mats').delete(id); t.oncomplete = res; t.onerror = res; }); }
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
const GLOSS = { matte: [0.85, 0.4], semi: [0.45, 0.6], gloss: [0.12, 1] };
async function register(o) {
  const img = await loadImg(o.data);
  const [rough, env] = GLOSS[o.gloss] || GLOSS.matte;
  MATS.set(o.id, { id: o.id, name: o.name, cat: o.cat, type: o.type, w: o.w, h: o.h, piece: o.piece, grout: o.grout, groutColor: o.groutColor, img, rough, env, user: true, rec: o });
  [...TEX.keys()].filter(k => k === o.id || k.startsWith(o.id + '#')).forEach(k => TEX.delete(k)); [...MAT.keys()].filter(k => k.startsWith(o.id + '|')).forEach(k => MAT.delete(k)); [...SW.keys()].filter(k => k.startsWith(o.id + '|')).forEach(k => SW.delete(k));
}
export async function storeRecord(o) { try { await dbPut(o); } catch (e) {} await register(o); }
export async function loadLibrary() { const all = await dbAll(); for (const o of all) { try { await register(o); } catch (e) {} } return all.length; }
export async function removeUser(id) { await dbDel(id); MATS.delete(id); [...TEX.keys()].filter(k => k === id || k.startsWith(id + '#')).forEach(k => TEX.delete(k)); }

/* ---------- выравнивание фото: 4 угла → прямоугольник (проективное преобразование) ---------- */
function homography(q) {   // единичный квадрат → четырёхугольник q[0..3] (ЛВ, ПВ, ПН, ЛН)
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / den, h = (dx1 * dy3 - dx3 * dy1) / den;
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h];
}
function warp(img, quad, W, H) {
  const sc = document.createElement('canvas'); sc.width = img.naturalWidth || img.width; sc.height = img.naturalHeight || img.height;
  const sg = sc.getContext('2d'); sg.drawImage(img, 0, 0); const src = sg.getImageData(0, 0, sc.width, sc.height), S = src.data, SWd = sc.width, SH = sc.height;
  const out = document.createElement('canvas'); out.width = W; out.height = H; const og = out.getContext('2d'); const dst = og.createImageData(W, H), D = dst.data;
  const [a, b, c, d, e, f, g, h] = homography(quad);
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H;
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W, den = g * u + h * v + 1;
      let sx = (a * u + b * v + c) / den, sy = (d * u + e * v + f) / den;
      sx = Math.max(0, Math.min(SWd - 1.001, sx - 0.5)); sy = Math.max(0, Math.min(SH - 1.001, sy - 0.5));
      const ix = sx | 0, iy = sy | 0, fx = sx - ix, fy = sy - iy, i0 = (iy * SWd + ix) * 4, i1 = i0 + 4, i2 = i0 + SWd * 4, i3 = i2 + 4, o = (y * W + x) * 4;
      for (let k = 0; k < 3; k++) D[o + k] = (S[i0 + k] * (1 - fx) + S[i1 + k] * fx) * (1 - fy) + (S[i2 + k] * (1 - fx) + S[i3 + k] * fx) * fy;
      D[o + 3] = 255;
    }
  }
  og.putImageData(dst, 0, 0); return out;
}
function seamless(c, band) {   // смешиваем с копией, сдвинутой на половину: края становятся бесшовными
  const W = c.width, H = c.height, g = c.getContext('2d'), A = g.getImageData(0, 0, W, H), a = A.data;
  const B = new Uint8ClampedArray(a.length);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const s = (((y + (H >> 1)) % H) * W + ((x + (W >> 1)) % W)) * 4, o = (y * W + x) * 4; B[o] = a[s]; B[o + 1] = a[s + 1]; B[o + 2] = a[s + 2]; }
  const bw = Math.max(2, W * band), bh = Math.max(2, H * band);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const m = Math.min(1, Math.min(x, W - 1 - x) / bw, Math.min(y, H - 1 - y) / bh), t = m * m * (3 - 2 * m), o = (y * W + x) * 4;
    a[o] = a[o] * t + B[o] * (1 - t); a[o + 1] = a[o + 1] * t + B[o + 1] * (1 - t); a[o + 2] = a[o + 2] * t + B[o + 2] * (1 - t);
  }
  g.putImageData(A, 0, 0); return c;
}

/* ---------- окно «Свой образец» ---------- */
const TYPES = {
  tile: { n: 'Плитка / керамогранит', w: 600, h: 600, cat: 'any', grout: 2, seam: false, gloss: 'semi' },
  wood: { n: 'Ламинат / паркет (одна доска)', w: 1380, h: 193, cat: 'floor', grout: 0, seam: false, gloss: 'semi' },
  paper: { n: 'Обои (раппорт рисунка)', w: 530, h: 530, cat: 'wall', grout: 0, seam: true, gloss: 'matte' },
  tex: { n: 'Штукатурка, камень, другое', w: 1000, h: 1000, cat: 'any', grout: 0, seam: true, gloss: 'matte' },
};
export function openImporter({ cat, onDone }) {
  const st = { img: null, quad: null, type: cat === 'wall' ? 'paper' : 'tile', drag: -1 };
  let pvT = 0;
  const m = document.createElement('div'); m.className = 'modal'; m.id = 'imp';
  m.innerHTML = `<div class="mi wide" role="dialog" aria-modal="true" aria-label="Свой образец">
   <h3>Свой образец из магазина</h3>
   <p class="muted">Сохраните картинку товара с сайта и выберите файл, перетащите его сюда или скопируйте картинку и нажмите ⌘V / Ctrl+V. Потом потяните 4 угла точно по краям образца и укажите его реальный размер.</p>
   <div class="impgrid">
    <div class="stage" id="impStage"><div class="drop" id="impDrop">Перетащите картинку сюда<br><label class="btn">Выбрать файл<input type="file" accept="image/*" id="impFile" hidden></label></div><canvas id="impCv" hidden></canvas></div>
    <div class="fields">
     <label class="f">Название<input id="impName" placeholder="Например, Керамогранит Estima 60×60"></label>
     <label class="f">Что это<select id="impType">${Object.entries(TYPES).map(([k, t]) => `<option value="${k}">${t.n}</option>`).join('')}</select></label>
     <div class="f2"><label class="f">Ширина, мм<input id="impW" type="number" inputmode="numeric"></label><label class="f">Высота, мм<input id="impH" type="number" inputmode="numeric"></label></div>
     <div class="f2" id="impGroutRow"><label class="f">Шов, мм<input id="impG" type="number" step="0.5" inputmode="decimal"></label><label class="f">Цвет шва<input id="impGC" type="color" value="#bdb8b0"></label></div>
     <label class="f">Поверхность<select id="impGloss"><option value="matte">Матовая</option><option value="semi">Полуматовая</option><option value="gloss">Глянцевая</option></select></label>
     <label class="chk"><input type="checkbox" id="impSeam"> Сгладить стыки картинки</label>
     <div class="pv"><span class="muted">Как ляжет (1,2 × 1,2 м):</span><canvas id="impPv" width="180" height="180"></canvas></div>
    </div>
   </div>
   <div class="row"><button type="button" class="btn" id="impSave" disabled>Сохранить и применить</button><button type="button" class="btn ghost" id="impCancel">Отмена</button></div>
  </div>`;
  document.body.appendChild(m);
  const $ = s => m.querySelector(s);
  const setType = t => { st.type = t; const d = TYPES[t]; $('#impType').value = t; $('#impW').value = d.w; $('#impH').value = d.h; $('#impG').value = d.grout || ''; $('#impGroutRow').style.display = t === 'tile' ? '' : 'none'; $('#impSeam').checked = d.seam; $('#impGloss').value = d.gloss; preview(); };
  setType(st.type);
  const cv = $('#impCv'), cg = cv.getContext('2d');
  let view = { s: 1, ox: 0, oy: 0 };
  function draw() {
    if (!st.img) return;
    const box = $('#impStage').getBoundingClientRect(), maxW = Math.max(200, box.width), maxH = Math.min(380, innerHeight * 0.5);
    const iw = st.img.naturalWidth, ih = st.img.naturalHeight, s = Math.min(maxW / iw, maxH / ih);
    cv.width = Math.round(iw * s); cv.height = Math.round(ih * s); view = { s };
    cg.drawImage(st.img, 0, 0, cv.width, cv.height);
    const q = st.quad.map(([x, y]) => [x * s, y * s]);
    cg.fillStyle = 'rgba(0,0,0,.35)'; cg.beginPath(); cg.rect(0, 0, cv.width, cv.height); cg.moveTo(q[0][0], q[0][1]); for (let i = 3; i >= 0; i--) cg.lineTo(q[i][0], q[i][1]); cg.closePath(); cg.fill('evenodd');
    cg.strokeStyle = '#ffd27a'; cg.lineWidth = 2; cg.beginPath(); q.forEach(([x, y], i) => i ? cg.lineTo(x, y) : cg.moveTo(x, y)); cg.closePath(); cg.stroke();
    q.forEach(([x, y]) => { cg.fillStyle = '#ffd27a'; cg.beginPath(); cg.arc(x, y, 8, 0, 7); cg.fill(); cg.strokeStyle = '#1c1f24'; cg.lineWidth = 2; cg.stroke(); });
  }
  function result() {
    const w = +$('#impW').value || 600, h = +$('#impH').value || 600, sc = 1024 / Math.max(w, h);
    let c = warp(st.img, st.quad, Math.max(8, Math.round(w * sc)), Math.max(8, Math.round(h * sc)));
    if ($('#impSeam').checked) c = seamless(c, 0.12);
    return { c, w, h };
  }
  function preview() {
    clearTimeout(pvT); if (!st.img) return;
    pvT = setTimeout(() => {
      const { c, w, h } = result(); const p = $('#impPv'), g = p.getContext('2d'); g.clearRect(0, 0, 180, 180);
      const pw = 180 * w / 1200, ph = 180 * h / 1200, gw = st.type === 'tile' ? Math.max(1, (+$('#impG').value || 0) * 180 / 1200) : 0;
      for (let x = 0; x < 180; x += pw) for (let y = 0; y < 180; y += ph) { g.drawImage(c, x, y, pw, ph); if (gw) { g.fillStyle = $('#impGC').value; g.fillRect(x, y, pw, gw / 2); g.fillRect(x, y, gw / 2, ph); g.fillRect(x, y + ph - gw / 2, pw, gw / 2); g.fillRect(x + pw - gw / 2, y, gw / 2, ph); } }
    }, 120);
  }
  async function setImage(blob) {
    try {
      const url = URL.createObjectURL(blob); const img = await loadImg(url);
      st.img = img; const iw = img.naturalWidth, ih = img.naturalHeight, ix = iw * 0.04, iy = ih * 0.04;
      st.quad = [[ix, iy], [iw - ix, iy], [iw - ix, ih - iy], [ix, ih - iy]];
      $('#impDrop').hidden = true; cv.hidden = false; $('#impSave').disabled = false; draw(); preview();
      if (!$('#impName').value) $('#impName').value = (blob.name || 'Свой образец').replace(/\.[a-z0-9]+$/i, '').slice(0, 60);
    } catch (e) { alert('Не получилось открыть картинку. Сохраните её файлом (JPG или PNG) и выберите снова.'); }
  }
  $('#impFile').addEventListener('change', e => { const f = e.target.files[0]; if (f) setImage(f); });
  $('#impStage').addEventListener('dragover', e => { e.preventDefault(); });
  $('#impStage').addEventListener('drop', e => { e.preventDefault(); const f = [...(e.dataTransfer.files || [])].find(x => /^image\//.test(x.type)); if (f) setImage(f); else alert('Перетащите сам файл картинки. Если тянете прямо с сайта — сначала сохраните картинку или скопируйте её и нажмите ⌘V.'); });
  const onPaste = e => { const it = [...(e.clipboardData && e.clipboardData.items || [])].find(x => /^image\//.test(x.type)); if (it) { e.preventDefault(); setImage(it.getAsFile()); } };
  document.addEventListener('paste', onPaste);
  const pt = e => { const r = cv.getBoundingClientRect(), k = cv.width / (r.width || cv.width); return [(e.clientX - r.left) * k / view.s, (e.clientY - r.top) * k / view.s]; };
  cv.addEventListener('pointerdown', e => { const [x, y] = pt(e); let best = -1, bd = 1e9; st.quad.forEach(([qx, qy], i) => { const d = Math.hypot(qx - x, qy - y) * view.s; if (d < bd) { bd = d; best = i; } }); if (bd < 40) { st.drag = best; cv.setPointerCapture(e.pointerId); } });
  cv.addEventListener('pointermove', e => { if (st.drag < 0) return; const [x, y] = pt(e); st.quad[st.drag] = [Math.max(0, Math.min(st.img.naturalWidth, x)), Math.max(0, Math.min(st.img.naturalHeight, y))]; draw(); });
  cv.addEventListener('pointerup', () => { if (st.drag >= 0) { st.drag = -1; preview(); } });
  $('#impType').addEventListener('change', e => setType(e.target.value));
  ['#impW', '#impH', '#impG', '#impGC', '#impSeam'].forEach(s => $(s).addEventListener('input', preview));
  const close = () => { document.removeEventListener('paste', onPaste); m.remove(); };
  $('#impCancel').addEventListener('click', close);
  m.addEventListener('click', e => { if (e.target === m) close(); });
  $('#impSave').addEventListener('click', async () => {
    const { c, w, h } = result(); const t = st.type, T = TYPES[t];
    const o = { id: 'u' + Date.now().toString(36), name: ($('#impName').value || 'Свой образец').trim().slice(0, 80), type: t, cat: T.cat, w, h, piece: t === 'tile' || t === 'wood' ? [w, h] : null,
      grout: t === 'tile' ? +$('#impG').value || 0 : 0, groutColor: $('#impGC').value, gloss: $('#impGloss').value, data: c.toDataURL('image/jpeg', 0.9), at: Date.now() };
    if (t === 'wood') { o.h = h * 4; o.data = stackPlanks(c).toDataURL('image/jpeg', 0.9); }   // доска → 4 ряда со смещением
    try { await dbPut(o); } catch (e) {}
    await register(o); close(); onDone && onDone(o.id);
  });
  addEventListener('resize', draw, { once: true });
}
function stackPlanks(c) {   // одна доска → полотно из 4 рядов со смещением, как на полу
  const W = c.width, H = c.height, sc = Math.min(1, 1024 / (H * 4));
  const o = document.createElement('canvas'); o.width = Math.round(W * sc); o.height = Math.round(H * 4 * sc); const g = o.getContext('2d');
  [0, 0.5, 0.25, 0.75].forEach((off, r) => { for (let k = -1; k < 2; k++) g.drawImage(c, (off + k) * o.width, r * H * sc, o.width, H * sc); g.fillStyle = 'rgba(40,25,10,.35)'; g.fillRect(off * o.width, r * H * sc, 1.5, H * sc); g.fillRect(0, r * H * sc, o.width, 1.2); });
  return o;
}

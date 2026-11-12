/* Раскладка: плитка, ламинат, обои. Все размеры — мм.
   Поверхность S = { W, H, holes:[{x0,y0,x1,y1,kind}] }, ось y — вниз (для стен: 0 — потолок, H — пол).
   Метка (mx, my) — точка, через которую проходят швы: угол плитки / стык доски / край полосы обоев. */

const mod = (a, n) => ((a % n) + n) % n;

/* ---------- плитка и ламинат: расположение кусков ---------- */
export function layPieces(S, o) {
  const { W, H } = S, holes = S.holes || [];
  const lam = o.pat === 'lam', g = lam ? 0 : (o.g || 0), pw = o.pw, ph = o.ph, sx = pw + g, sy = ph + g;
  const pieces = [];
  const inHole = (x0, y0, x1, y1) => holes.some(h => x0 >= h.x0 - 0.5 && x1 <= h.x1 + 0.5 && y0 >= h.y0 - 0.5 && y1 <= h.y1 + 0.5);
  const hitHole = (x0, y0, x1, y1) => holes.some(h => x0 < h.x1 - 0.5 && x1 > h.x0 + 0.5 && y0 < h.y1 - 0.5 && y1 > h.y0 + 0.5);
  const add = (x, y, w, h, extra) => {
    let x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(W, x + w), y1 = Math.min(H, y + h);
    if (x1 - x0 < 0.5 || y1 - y0 < 0.5 || inHole(x0, y0, x1, y1)) return null;
    // проём перекрывает кусок на всю ширину или высоту — это обычный прямой рез, а не фигурный
    for (const hl of holes) {
      if (!(x0 < hl.x1 - 0.5 && x1 > hl.x0 + 0.5 && y0 < hl.y1 - 0.5 && y1 > hl.y0 + 0.5)) continue;
      if (hl.x0 <= x0 + 0.5 && hl.x1 >= x1 - 0.5) { if (hl.y0 - y0 >= y1 - hl.y1) y1 = Math.min(y1, hl.y0); else y0 = Math.max(y0, hl.y1); }
      else if (hl.y0 <= y0 + 0.5 && hl.y1 >= y1 - 0.5) { if (hl.x0 - x0 >= x1 - hl.x1) x1 = Math.min(x1, hl.x0); else x0 = Math.max(x0, hl.x1); }
    }
    if (x1 - x0 < 0.5 || y1 - y0 < 0.5) return null;
    const cw = x1 - x0, ch = y1 - y0, shape = hitHole(x0, y0, x1, y1);
    const p = Object.assign({ x: x0, y: y0, w: cw, h: ch, full: cw >= pw - 0.5 && ch >= ph - 0.5 && !shape, shape }, extra);
    pieces.push(p); return p;
  };
  const my = o.my, j0 = Math.floor(-my / sy) - 1, j1 = Math.ceil((H - my) / sy) + 1;
  let boards = 0;
  if (!lam) {
    const fr = o.pat === 'half' ? 1 / 2 : o.pat === 'third' ? 1 / 3 : 0;
    for (let j = j0; j <= j1; j++) {
      const y = my + j * sy; if (y + ph <= 0 || y >= H) continue;
      const x0 = o.mx + (fr ? mod(j * fr, 1) * sx : 0), k0 = Math.floor(-x0 / sx) - 1, k1 = Math.ceil((W - x0) / sx) + 1;
      for (let k = k0; k <= k1; k++) add(x0 + k * sx, y, pw, ph);
    }
  } else {
    /* ламинат: первый ряд — стык по метке; дальше отрезок с конца ряда идёт в начало следующего,
       если он не короче minP и стыки соседних рядов разнесены минимум на minS */
    const kerf = o.kerf ?? 3, minP = o.minPiece ?? 300, minS = Math.min(o.minShift ?? 300, pw / 3);
    const pool = [];   // обрезки полной ширины: длины
    const fromPool = need => { let bi = -1; pool.forEach((L, i) => { if (L >= need - 0.5 && (bi < 0 || L < pool[bi])) bi = i; }); return bi; };
    let prev = null;
    for (let j = j0; j <= j1; j++) {
      const y = my + j * ph; if (y + ph <= 0 || y >= H) continue;
      const rip = y < -0.5 || y + ph > H + 0.5;   // ряд распускается вдоль — его обрезки в запас не идут
      let s, src = 'new';
      if (prev == null) { s = mod(o.mx, pw); if (s < 1) s = pw; }
      else {
        const endOk = L => { const e = mod(W - L, pw); return W <= L || e < 1 || e >= minP - 0.5; };
        const ok = L => { const d = mod(L - prev, pw); return L >= minP && d >= minS - 0.5 && d <= pw - minS + 0.5 && endOk(L); };
        let bi = -1; pool.forEach((L, i) => { if (ok(Math.min(L, pw)) && (bi < 0 || L > pool[bi])) bi = i; });
        if (bi >= 0) { s = pool[bi]; pool.splice(bi, 1); src = 'off'; }
        else { s = pw; for (let t = 1; t < 40; t++) { const c = mod(prev + pw * (t % 2 ? 1 : 2) / 3 + Math.floor((t - 1) / 2) * 25 * (t % 4 < 2 ? 1 : -1), pw); if (c >= minP && ok(c)) { s = c; break; } } }
      }
      if (src === 'new') { boards++; const r = pw - s - kerf; if (s < pw && r >= 100 && !rip) pool.push(r); }
      let x = 0;
      const first = Math.min(s, W); add(x, y, first, ph, { row: j, from: src }); x += first;
      if (first < s && !rip) { const r = s - first - kerf; if (r >= 100) pool.push(r); }
      while (x + pw <= W + 0.5) { boards++; add(x, y, pw, ph, { row: j, from: 'new' }); x += pw; }
      const e = W - x;
      if (e > 0.5) {
        const bi = fromPool(e);
        if (bi >= 0) { const L = pool.splice(bi, 1)[0]; add(x, y, e, ph, { row: j, from: 'off' }); const r = L - e - kerf; if (r >= 100 && !rip) pool.push(r); }
        else { boards++; add(x, y, e, ph, { row: j, from: 'new' }); const r = pw - e - kerf; if (r >= 100 && !rip) pool.push(r); }
      }
      prev = mod(Math.min(s, W), pw);
    }
  }
  return { pieces, boards };
}

/* ---------- сколько покупать: целые + резаные (с обрезками или без) ---------- */
export function buyTiles(all, o) {
  if (o.pat === 'lam') return { buy: all.reduce((a, r) => a + r.boards, 0), fromOff: all.reduce((a, r) => a + r.pieces.filter(p => p.from === 'off').length, 0) };
  const pw = o.pw, ph = o.ph, kerf = o.kerf ?? 3, pool = [];
  let buy = 0, fromOff = 0;
  const cuts = [];
  all.forEach(r => r.pieces.forEach(p => { if (p.full) buy++; else cuts.push(p); }));
  cuts.sort((a, b) => b.w * b.h - a.w * a.h);
  for (const p of cuts) {
    const need = [p.w, p.h];
    let i = -1;
    if (o.reuse && !p.shape) pool.forEach((r, k) => { if (r[0] >= need[0] - 0.5 && r[1] >= need[1] - 0.5 && (i < 0 || r[0] * r[1] < pool[i][0] * pool[i][1])) i = k; });
    let src;
    if (i >= 0) { src = pool.splice(i, 1)[0]; p.from = 'off'; fromOff++; } else { src = [pw, ph]; buy++; p.from = 'new'; }
    if (p.shape) continue;
    const a = src[0] - need[0] - kerf, b = src[1] - need[1] - kerf;
    if (a >= 50) pool.push([a, src[1]]);
    if (b >= 50) pool.push([need[0], b]);
  }
  return { buy, fromOff };
}

/* ---------- группы резов: А — 600×213 — 12 шт ---------- */
const LET = 'АБВГДЕЖИКЛМНПРСТУФХЦЧШЭЮЯ';
export function groupCuts(all, o) {
  const m = new Map();
  all.forEach(r => r.pieces.forEach(p => {
    if (p.full) return;
    const key = (p.shape ? 'ф' : '') + Math.round(p.w) + '×' + Math.round(p.h);
    if (!m.has(key)) m.set(key, { key, w: Math.round(p.w), h: Math.round(p.h), shape: p.shape, n: 0, list: [] });
    const gr = m.get(key); gr.n++; gr.list.push(p);
  }));
  const gs = [...m.values()].sort((a, b) => (a.shape - b.shape) || b.n - a.n || b.w * b.h - a.w * a.h);
  gs.forEach((g, i) => { g.letter = i < LET.length ? LET[i] : LET[i % LET.length] + Math.floor(i / LET.length + 1); g.list.forEach(p => { p.grp = g.letter; }); });
  const lim = Math.max(40, Math.min(o.pw, o.ph) * 0.2), lx = o.limX ?? (o.pat === 'lam' ? o.minPiece ?? 300 : lim), ly = o.limY ?? (o.pat === 'lam' ? 50 : lim);
  const slivers = all.reduce((a, r) => a + r.pieces.filter(p => !p.full && ((p.w < o.pw - 0.5 && p.w < lx - 0.5) || (p.h < o.ph - 0.5 && p.h < ly - 0.5))).length, 0);
  return { groups: gs, slivers, lim: Math.min(lx, ly), limX: lx, limY: ly };
}

/* ---------- подбор метки: меньше покупать, без узких подрезок, симметрично ---------- */
export function autoMark(S, o, axes = 'xy') {
  const lam = o.pat === 'lam', sx = o.pw + (lam ? 0 : o.g || 0), sy = o.ph + (lam ? 0 : o.g || 0);
  const N = lam ? 28 : 40, xs = axes.includes('x') ? [...Array(N)].map((_, i) => i * sx / N) : [o.mx], ys = axes.includes('y') ? [...Array(N)].map((_, i) => i * sy / N) : [o.my];
  let best = null;
  for (const mx of xs) for (const my of ys) {
    const q = Object.assign({}, o, { mx, my }), r = layPieces(S, q), b = buyTiles([r], q), gc = groupCuts([r], q);
    const edge = side => { let v = 1e9; r.pieces.forEach(p => { if (side === 'l' && p.x < 0.5) v = Math.min(v, p.w); if (side === 'r' && p.x + p.w > S.W - 0.5) v = Math.min(v, p.w); if (side === 't' && p.y < 0.5) v = Math.min(v, p.h); if (side === 'b' && p.y + p.h > S.H - 0.5) v = Math.min(v, p.h); }); return v; };
    const asym = (axes.includes('x') && !lam ? Math.abs(edge('l') - edge('r')) / sx : 0) + (axes.includes('y') ? Math.abs(edge('t') - edge('b')) / sy : 0);
    const score = b.buy + gc.slivers * 4 + asym * 0.6;
    if (!best || score < best.score - 1e-9) best = { score, mx, my };
  }
  return { mx: Math.round(best.mx), my: Math.round(best.my) };
}

/* ---------- обои: полосы, куски, рулоны ---------- */
export function layPaper(S, o) {
  const { W, H } = S, holes = S.holes || [], rw = o.rw, strips = [];
  const x0 = mod(o.mx, rw), k0 = x0 > 0.5 ? -1 : 0;
  for (let k = k0; ; k++) {
    const a = x0 + k * rw, cx0 = Math.max(0, a), cx1 = Math.min(W, a + rw); if (cx0 >= W - 0.5) break; if (cx1 - cx0 < 0.5) continue;
    let iv = [[0, H]];
    holes.filter(h => h.x0 <= cx0 + 0.5 && h.x1 >= cx1 - 0.5).forEach(h => {
      iv = iv.flatMap(([u, v]) => (h.y1 <= u || h.y0 >= v) ? [[u, v]] : [[u, Math.max(u, h.y0)], [Math.min(v, h.y1), v]].filter(([p, q]) => q - p > 0.5));
    });
    strips.push({ x: cx0, w: cx1 - cx0, cut: cx1 - cx0 < rw - 0.5, parts: iv.map(([u, v]) => ({ y: u, h: v - u })) });
  }
  return strips;
}
export function buyPaper(all, o) {
  const lens = [];
  all.forEach(st => st.forEach(s => s.parts.forEach(p => { let L = p.h + (o.allow ?? 100); if (o.rap > 0) L = Math.ceil(L / o.rap) * o.rap; p.len = L; lens.push(L); })));
  lens.sort((a, b) => b - a);
  const rolls = [];
  let tooLong = 0;
  for (const L of lens) { if (L > o.rl) { tooLong++; continue; } const i = rolls.findIndex(r => r >= L); if (i >= 0) rolls[i] -= L; else rolls.push(o.rl - L); }
  return { rolls: rolls.length, pieces: lens.length, waste: rolls.reduce((a, r) => a + r, 0), tooLong };
}

export function area(S) { return (S.W * S.H - (S.holes || []).reduce((a, h) => a + (h.x1 - h.x0) * (h.y1 - h.y0), 0)) / 1e6; }

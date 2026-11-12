/* Окно «Раскладка»: схема с меткой старта, поштучный счёт, что резать, сколько покупать. */
import { layPieces, buyTiles, groupCuts, autoMark, layPaper, buyPaper, area } from './laycalc.js';

const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n0 = v => Math.round(v).toLocaleString('ru-RU');
const n2 = v => (Math.round(v * 100) / 100).toLocaleString('ru-RU');
const GC = ['#f2b880', '#9fc5e8', '#b6d7a8', '#f4a6a6', '#d5a6e6', '#ffe599', '#a2c4c9', '#f9cb9c', '#b4a7d6', '#c9daf8', '#d9ead3', '#ead1dc'];
const KIND = m => !m ? 'area' : m.type === 'tile' ? 'tile' : m.type === 'wood' ? 'lam' : m.type === 'paper' ? 'paper' : 'area';

function defaults(m, kind) {
  if (kind === 'tile') return { pw: m.w, ph: m.h, g: m.grout ?? 2, pat: 'grid', rot: false, reuse: true, reserve: 5, packN: 0, packM2: 0 };
  if (kind === 'lam') { const p = m.piece || [m.w, m.h]; return { pw: p[0], ph: p[1], minPiece: 300, minShift: 300, rot: false, reserve: 5, packN: 0, packM2: 0 }; }
  if (kind === 'paper') return { rw: 1060, rl: 10050, rap: m.user ? Math.round(m.h || 0) : 0, allow: 100, reserve: 0 };
  return { rate: m && m.type === 'paint' ? 0.12 : 1.2, unit: m && m.type === 'paint' ? 'л' : 'кг', coats: m && m.type === 'paint' ? 2 : 1, reserve: 5 };
}

/* поворот ламината: считаем в транспонированной поверхности */
const tr = S => ({ W: S.H, H: S.W, holes: (S.holes || []).map(h => ({ x0: h.y0, x1: h.y1, y0: h.x0, y1: h.x1, kind: h.kind })) });
function qOf(o) { return o.kind === 'lam' ? { pat: 'lam', pw: o.pw, ph: o.ph, minPiece: o.minPiece, minShift: o.minShift } : { pat: o.pat, pw: o.pw, ph: o.ph, g: o.g, reuse: o.reuse }; }
/* поворот на 90°: считаем в транспонированной поверхности — поворачивается весь рисунок, включая сдвиг рядов */
function piecesFor(S, o, mk) {
  const q = qOf(o);
  if (!o.rot) return layPieces(S, Object.assign(q, { mx: mk.mx, my: mk.my }));
  const r = layPieces(tr(S), Object.assign(q, { mx: mk.my, my: mk.mx }));
  r.pieces.forEach(p => { [p.x, p.y, p.w, p.h] = [p.y, p.x, p.h, p.w]; });
  return r;
}
function autoFor(S, o, mk, wall) {
  const q = qOf(o), axes = wall && o.kind !== 'lam' ? 'x' : 'xy';
  if (!o.rot) { const a = autoMark(S, Object.assign(q, { mx: mk.mx, my: mk.my }), axes); return { mx: a.mx, my: a.my }; }
  const ax = axes.replace('x', 'Y').replace(/y/, 'x').replace('Y', 'y');
  const a = autoMark(tr(S), Object.assign(q, { mx: mk.my, my: mk.mx }), ax); return { mx: a.my, my: a.mx };
}
function autoPaper(S, o) {   // старт полос: меньше полос, без узкой полосы у угла
  let best = null;
  for (let mx = 0; mx < o.rw; mx += 10) {
    const st = layPaper(S, { rw: o.rw, mx }), edge = Math.min(st[0].w, st[st.length - 1].w), sc = st.length * 1e4 - Math.min(edge, o.rw / 2) * 4 + (mx ? 1 : 0);
    if (!best || sc < best.sc) best = { sc, mx };
  }
  return { mx: best.mx, my: 0 };
}
const dimsS = o => o.rot ? [o.ph, o.pw] : [o.pw, o.ph];   // размер куска в осях поверхности

export function openLayout(ctx) {
  /* ctx: { title, start:'floor'|'w0'..'w3'|'walls', surf:{floor:{W,H,holes,name}, w0..w3:{…}}, mat:{floor:{m,color}, walls:{m,color}}, cfg, save, plan:{W,L} } */
  const cfg = ctx.cfg; cfg.marks = cfg.marks || {}; cfg.opt = cfg.opt || {};
  let cur = ctx.start || 'floor';
  const m = document.createElement('div'); m.className = 'modal'; m.id = 'lay';
  m.innerHTML = '<div class="mi wide lay" role="dialog" aria-modal="true" aria-label="Раскладка"><div class="ih"><b>Раскладка · ' + esc(ctx.title) + '</b><button type="button" class="x" data-lx="close" aria-label="Закрыть">×</button></div>' +
    '<div class="laytop"><div class="seg2" id="laySurf"></div><svg id="layMini" viewBox="0 0 100 100" aria-hidden="true"></svg></div>' +
    '<div class="impgrid"><div><div class="stage laystage"><svg id="laySvg" xmlns="http://www.w3.org/2000/svg"></svg></div><p class="muted" id="layHint"></p></div><div id="layCtl"></div></div><div id="layRes"></div></div>';
  document.body.appendChild(m);
  const $ = s => m.querySelector(s);
  const close = () => { m.remove(); document.removeEventListener('keydown', onKey); ctx.save(); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  m.addEventListener('click', e => { if (e.target === m) close(); });

  const isWall = k => k !== 'floor';
  const keys = () => cur === 'walls' ? ['w0', 'w1', 'w2', 'w3'] : [cur];
  const matOf = k => ctx.mat[isWall(k) ? 'walls' : 'floor'];
  const optKey = () => isWall(cur) ? 'walls' : 'floor';
  function opt() {
    const { m: mt } = matOf(cur), kind = KIND(mt), k = optKey();
    let o = cfg.opt[k];
    if (!o || o.mat !== (mt && mt.id)) { o = cfg.opt[k] = Object.assign({ mat: mt && mt.id }, defaults(mt, kind)); (k === 'walls' ? ['w0', 'w1', 'w2', 'w3'] : ['floor']).forEach(x => { delete cfg.marks[x]; }); }
    o.kind = kind; return o;
  }
  function mark(k, o) {
    const S = ctx.surf[k];
    if (!cfg.marks[k]) {
      if (o.kind === 'area') cfg.marks[k] = { mx: 0, my: 0 };
      else if (o.kind === 'paper') { const st = layPaper(S, { rw: o.rw, mx: 0 }); cfg.marks[k] = st[st.length - 1].w < 150 ? autoPaper(S, o) : { mx: 0, my: 0 }; }
      else { const base = isWall(k) ? { mx: 0, my: S.H } : { mx: 0, my: 0 }; cfg.marks[k] = autoFor(S, o, base, isWall(k)); }
    }
    return cfg.marks[k];
  }

  /* ---------- расчёт ---------- */
  function calc() {
    const o = opt(), ks = keys(), res = { o, ks, list: [] };
    if (o.kind === 'tile' || o.kind === 'lam') {
      ks.forEach(k => res.list.push(Object.assign(piecesFor(ctx.surf[k], o, mark(k, o)), { k })));
      const [pwS, phS] = dimsS(o);
      res.buy = buyTiles(res.list, { pat: o.kind === 'lam' ? 'lam' : o.pat, pw: pwS, ph: phS, reuse: o.reuse });
      const lmin = o.kind === 'lam' ? [o.minPiece || 300, 50] : null;
      res.gc = groupCuts(res.list, Object.assign({ pw: pwS, ph: phS }, lmin ? { limX: o.rot ? lmin[1] : lmin[0], limY: o.rot ? lmin[0] : lmin[1] } : {}));
      res.full = res.list.reduce((a, r) => a + r.pieces.filter(p => p.full).length, 0);
      res.cut = res.list.reduce((a, r) => a + r.pieces.filter(p => !p.full).length, 0);
    } else if (o.kind === 'paper') {
      ks.forEach(k => res.list.push({ k, strips: layPaper(ctx.surf[k], { rw: o.rw, mx: mark(k, o).mx }) }));
      res.paper = buyPaper(res.list.map(r => r.strips), o);
    }
    res.area = ks.reduce((a, k) => a + area(ctx.surf[k]), 0);
    return res;
  }

  /* ---------- схема ---------- */
  const GAP = 300;
  function layoutBoxes() { let x = 0; return keys().map(k => { const S = ctx.surf[k], b = { k, ox: x, S }; x += S.W + GAP; return b; }); }
  function drawSVG(res, forExport) {
    const bx = layoutBoxes(), totW = bx.reduce((a, b) => Math.max(a, b.ox + b.S.W), 0), totH = Math.max(...bx.map(b => b.S.H));
    const fs = Math.max(60, Math.max(totW, totH) / (bx.length > 1 ? 40 : 30)), pad = fs * 2.4;
    let s = '<defs><pattern id="hh" width="' + fs * 0.6 + '" height="' + fs * 0.6 + '" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="' + fs * 0.6 + '" height="' + fs * 0.6 + '" fill="#d9d5ce"/><line x1="0" y1="0" x2="0" y2="' + fs * 0.6 + '" stroke="#a8a299" stroke-width="' + fs * 0.12 + '"/></pattern></defs>';
    const col = {}; if (res.gc) res.gc.groups.forEach((g, i) => { col[g.letter] = GC[i % GC.length]; });
    bx.forEach((b, bi) => {
      const S = b.S, o = res.o, mk = cfg.marks[b.k] || { mx: 0, my: 0 }, sw = fs * 0.05;
      s += '<g data-s="' + bi + '" transform="translate(' + b.ox + ',0)">';
      s += '<rect x="0" y="0" width="' + S.W + '" height="' + S.H + '" fill="#f7f5f1" stroke="#3a3c40" stroke-width="' + fs * 0.12 + '"/>';
      const r = res.list[bi];
      if (r && r.pieces) r.pieces.forEach(p => {
        const fill = p.full ? '#ebe6dd' : o.kind === 'lam' ? (p.from === 'off' ? '#f9d9a8' : '#f2b880') : col[p.grp] || '#f2b880';
        s += '<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" fill="' + fill + '" stroke="#8f887c" stroke-width="' + sw * 1.4 + '"' + (p.from === 'off' && !p.full ? ' stroke-dasharray="' + fs * 0.25 + ' ' + fs * 0.15 + '"' : '') + '/>';
        if (o.kind === 'lam') { const L = Math.round(o.rot ? p.h : p.w), lw = o.rot ? p.h : p.w, th = o.rot ? p.w : p.h; if (!p.full && lw > fs * 1.6 && th > fs * 0.5) s += '<text x="' + (p.x + p.w / 2) + '" y="' + (p.y + p.h / 2) + '" font-size="' + Math.min(fs * 0.75, th * 0.62) + '" text-anchor="middle" dominant-baseline="central" fill="#2b2b2b" font-weight="700"' + (o.rot ? ' transform="rotate(-90 ' + (p.x + p.w / 2) + ' ' + (p.y + p.h / 2) + ')"' : '') + '>' + L + '</text>'; }
        else if (!p.full && p.grp && p.w > fs * 0.9 && p.h > fs * 0.8) s += '<text x="' + (p.x + p.w / 2) + '" y="' + (p.y + p.h / 2) + '" font-size="' + Math.min(fs * 0.9, p.h * 0.7, p.w * 0.6) + '" text-anchor="middle" dominant-baseline="central" fill="#2b2b2b" font-weight="700">' + p.grp + '</text>';
      });
      if (r && r.strips) r.strips.forEach((st, i) => st.parts.forEach(pt => {
        s += '<rect x="' + st.x + '" y="' + pt.y + '" width="' + st.w + '" height="' + pt.h + '" fill="' + (st.cut ? '#f2b880' : i % 2 ? '#e7e1d6' : '#efeae2') + '" stroke="#8f887c" stroke-width="' + sw * 2 + '"/>' +
          (pt.h > fs * 1.2 ? '<text x="' + (st.x + st.w / 2) + '" y="' + (pt.y + pt.h / 2) + '" font-size="' + Math.min(fs, st.w * 0.5) + '" text-anchor="middle" dominant-baseline="central" fill="#2b2b2b" font-weight="700">' + (i + 1) + '</text>' : '');
      }));
      (S.holes || []).forEach(h => { s += '<rect x="' + h.x0 + '" y="' + h.y0 + '" width="' + (h.x1 - h.x0) + '" height="' + (h.y1 - h.y0) + '" fill="url(#hh)" stroke="#6b665e" stroke-width="' + sw * 2 + '"/><text x="' + (h.x0 + h.x1) / 2 + '" y="' + (h.y0 + h.y1) / 2 + '" font-size="' + fs * 0.7 + '" text-anchor="middle" dominant-baseline="central" fill="#4a463f">' + (h.kind === 'door' ? 'дверь' : 'окно') + '</text>'; });
      // метка: линии швов через неё
      if (o.kind !== 'area') {
        const ac = '#d2452f';
        s += '<line x1="0" y1="' + mk.my + '" x2="' + S.W + '" y2="' + mk.my + '" stroke="' + ac + '" stroke-width="' + fs * 0.08 + '" stroke-dasharray="' + fs * 0.4 + ' ' + fs * 0.25 + '"/>' +
          '<line x1="' + mk.mx + '" y1="0" x2="' + mk.mx + '" y2="' + S.H + '" stroke="' + ac + '" stroke-width="' + fs * 0.08 + '" stroke-dasharray="' + fs * 0.4 + ' ' + fs * 0.25 + '"/>' +
          '<circle cx="' + mk.mx + '" cy="' + mk.my + '" r="' + fs * 0.45 + '" fill="' + ac + '" fill-opacity=".18" stroke="' + ac + '" stroke-width="' + fs * 0.1 + '"/><circle cx="' + mk.mx + '" cy="' + mk.my + '" r="' + fs * 0.1 + '" fill="' + ac + '"/>';
      }
      // подписи и размеры
      s += '<text x="' + S.W / 2 + '" y="' + -fs * 0.9 + '" font-size="' + fs + '" text-anchor="middle" fill="#2b2b2b" font-weight="700">' + esc(S.name) + ' · ' + n0(S.W) + '</text>' +
        '<text x="' + -fs * 0.6 + '" y="' + S.H / 2 + '" font-size="' + fs * 0.85 + '" text-anchor="middle" fill="#55524c" transform="rotate(-90 ' + -fs * 0.6 + ' ' + S.H / 2 + ')">' + n0(S.H) + '</text>';
      if (isWall(b.k)) s += '<text x="' + S.W / 2 + '" y="' + (S.H + fs * 1.3) + '" font-size="' + fs * 0.75 + '" text-anchor="middle" fill="#8a857c">пол</text>';
      s += '<rect x="0" y="0" width="' + S.W + '" height="' + S.H + '" fill="transparent" class="hit"/></g>';
    });
    const vb = [-pad, -pad, totW + pad * 1.5, totH + pad * 1.9];
    return { s, vb, fs };
  }

  /* ---------- панель настроек ---------- */
  const num = (id, v, lbl, step) => '<label class="f"><span>' + lbl + '</span><input type="number" inputmode="decimal" id="' + id + '" value="' + (v ?? '') + '" step="' + (step || 1) + '"></label>';
  const segb = (attr, val, list) => '<div class="seg2">' + list.map(([k, l]) => '<button type="button" ' + attr + '="' + k + '" aria-pressed="' + (String(val) === String(k)) + '">' + l + '</button>').join('') + '</div>';
  function renderTop() {
    const ws = ['w0', 'w1', 'w2', 'w3'];
    $('#laySurf').innerHTML = [['floor', 'Пол'], ...ws.map(k => [k, ctx.surf[k].name]), ['walls', 'Все стены']].map(([k, l]) => '<button type="button" data-lsurf="' + k + '" aria-pressed="' + (cur === k) + '">' + esc(l) + '</button>').join('');
    // мини-план: какая стена выбрана
    const P = ctx.plan, s = 58 / Math.max(P.W, P.L), w = P.W * s, h = P.L * s, x = (100 - w) / 2, y = (100 - h) / 2, on = k => cur === k || (cur === 'walls' && k !== 'floor');
    const L = (k, x1, y1, x2, y2) => '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + (on(k) ? '#d2452f' : '#9a948a') + '" stroke-width="' + (on(k) ? 6 : 3) + '" stroke-linecap="round"/>';
    $('#layMini').innerHTML = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + (cur === 'floor' ? 'rgba(210,69,47,.18)' : 'rgba(128,128,128,.12)') + '"/>' +
      L(ctx.wallSides.top, x, y, x + w, y) + L(ctx.wallSides.right, x + w, y, x + w, y + h) + L(ctx.wallSides.bottom, x, y + h, x + w, y + h) + L(ctx.wallSides.left, x, y, x, y + h) +
      ['top', 'right', 'bottom', 'left'].map(sd => { const k = ctx.wallSides[sd], px = sd === 'left' ? x - 12 : sd === 'right' ? x + w + 12 : x + w / 2, py = sd === 'top' ? y - 8 : sd === 'bottom' ? y + h + 18 : y + h / 2 + 5; return '<text x="' + px + '" y="' + py + '" font-size="15" font-weight="700" text-anchor="middle" fill="currentColor">' + esc(ctx.surf[k].name.replace('Стена ', '')) + '</text>'; }).join('');
  }
  function renderCtl() {
    const o = opt(), { m: mt } = matOf(cur);
    let h = '<p class="cur">' + esc(mt ? mt.name : '—') + '</p>';
    if (o.kind === 'tile') {
      h += '<div class="f2">' + num('lPw', o.pw, 'Плитка, ширина мм') + num('lPh', o.ph, 'высота мм') + '</div><div class="f2">' + num('lG', o.g, 'Шов, мм', 0.5) + num('lRes', o.reserve, 'Запас, %') + '</div>' +
        '<p class="sub">Рисунок</p>' + segb('data-lpat', o.pat, [['grid', 'Прямо'], ['half', 'Сдвиг ½'], ['third', 'Сдвиг ⅓']]) +
        '<p class="sub">Ориентация</p>' + segb('data-lrot', o.rot ? 1 : 0, [[0, o.pw + '×' + o.ph], [1, o.ph + '×' + o.pw]]) +
        '<label class="chk"><input type="checkbox" id="lReuse"' + (o.reuse ? ' checked' : '') + '> Пускать обрезки в дело</label>' +
        '<div class="f2">' + num('lPackN', o.packN || '', 'В упаковке, шт') + num('lPackM', o.packM2 || '', 'или м² в упаковке', 0.01) + '</div>';
    } else if (o.kind === 'lam') {
      h += '<div class="f2">' + num('lPw', o.pw, 'Доска, длина мм') + num('lPh', o.ph, 'ширина мм') + '</div><div class="f2">' + num('lMinP', o.minPiece, 'Мин. кусок, мм') + num('lMinS', o.minShift, 'Разбег стыков, мм') + '</div>' +
        '<p class="sub">Направление досок</p>' + segb('data-lrot', o.rot ? 1 : 0, [[0, isWall(cur) ? 'Горизонтально' : 'Вдоль ←→'], [1, isWall(cur) ? 'Вертикально' : 'Вдоль ↑↓']]) +
        '<div class="f2">' + num('lPackN', o.packN || '', 'В упаковке, шт') + num('lRes', o.reserve, 'Запас, %') + '</div>';
    } else if (o.kind === 'paper') {
      h += '<div class="f2">' + num('lRw', o.rw, 'Ширина рулона, мм') + num('lRl', o.rl, 'Длина рулона, мм') + '</div><div class="f2">' + num('lRap', o.rap, 'Раппорт, мм') + num('lAllow', o.allow, 'Припуск, мм') + '</div>';
    } else {
      h += '<div class="f2">' + num('lRate', o.rate, 'Расход на м² (' + o.unit + ')', 0.01) + num('lCoats', o.coats, 'Слоёв') + '</div>' + num('lRes', o.reserve, 'Запас, %');
    }
    if (o.kind !== 'area') {
      const one = cur !== 'walls', mk = one ? mark(cur, o) : null;
      h += '<p class="sub">Метка старта ' + (o.kind === 'paper' ? '(край первой полосы)' : '(через неё идут швы)') + '</p>' +
        '<div class="seg2 mk">' + (o.kind === 'paper' ? [['l', '⇤ От левого угла'], ['r', 'От правого ⇥'], ['c', 'Шов по центру'], ['auto', 'Авто']] : [['tl', '↖'], ['tr', '↗'], ['bl', '↙'], ['br', '↘'], ['cj', '✛ шов в центре'], ...(o.kind === 'lam' ? [] : [['ct', '▣ плитка в центре']]), ['auto', 'Авто']]).map(([k, l]) => '<button type="button" data-lmk="' + k + '">' + l + '</button>').join('') + '</div>' +
        (one ? '<div class="f2">' + num('lMx', Math.round(mk.mx), 'От левого края, мм') + (o.kind === 'paper' ? '' : num('lMy', Math.round(isWall(cur) ? ctx.surf[cur].H - mk.my : mk.my), isWall(cur) ? 'От пола, мм' : 'От верхнего края, мм')) + '</div>' : '<p class="muted">На «Все стены» кнопки ставят метку сразу на всех четырёх стенах. Точно двигать — на каждой стене отдельно.</p>');
    }
    $('#layCtl').innerHTML = h;
    $('#layHint').textContent = o.kind === 'area' ? 'Для краски и штукатурки считаем площадь без проёмов и расход.' : o.kind === 'paper' ? 'Нажмите или тяните на схеме — так ставится край первой полосы. Оранжевые полосы режутся по ширине.' : (o.kind === 'lam' ? 'Нажмите или тяните на схеме — метка задаёт первый стык и линию рядов. Серые — целые доски, оранжевые — резаные (число = длина, мм), светлые — из обрезка.' : 'Нажмите или тяните на схеме — красная метка показывает, где пройдут швы. Серые — целые, цветные — резаные (буква = размер реза), пунктир — из обрезка.');
  }
  function renderRes(res) {
    const o = res.o; let h = '';
    const pack = (n, pieceM2) => { const pn = o.packN > 0 ? o.packN : o.packM2 > 0 && pieceM2 ? Math.max(1, Math.round(o.packM2 / pieceM2)) : 0; return pn ? ' · <b>' + Math.ceil(n / pn) + ' уп.</b> по ' + pn + ' шт' : ''; };
    if (o.kind === 'tile' || o.kind === 'lam') {
      const pieceM2 = o.pw * o.ph / 1e6, withRes = Math.ceil(res.buy.buy * (1 + (o.reserve || 0) / 100));
      h += '<div class="lres"><div class="big"><span>Купить</span><b>' + n0(withRes) + ' шт</b><small>' + n2(withRes * pieceM2) + ' м²' + pack(withRes, pieceM2) + '</small></div>' +
        '<div><span>Площадь</span><b>' + n2(res.area) + ' м²</b></div><div><span>Целых</span><b>' + res.full + '</b></div><div><span>Резаных</span><b>' + res.cut + '</b></div><div><span>Из обрезков</span><b>' + res.buy.fromOff + '</b></div>' +
        '<div><span>Без запаса</span><b>' + res.buy.buy + '</b></div><div><span>Отход</span><b>' + Math.max(0, Math.round((1 - res.area / (res.buy.buy * pieceM2)) * 100)) + '%</b></div></div>';
      if (res.gc.slivers) h += '<p class="warn">Узких подрезок: ' + res.gc.slivers + ' (уже ' + Math.round(res.gc.lim) + ' мм). Их трудно резать и они смотрятся плохо — подвиньте метку или нажмите «Авто».</p>';
      if (o.kind === 'lam') h += lamRows(res);
      else if (res.gc.groups.length) h += '<p class="sub">Что резать</p><div class="cuts">' + res.gc.groups.map((g, i) => '<div><i style="background:' + GC[i % GC.length] + '">' + g.letter + '</i><span>' + n0(g.w) + ' × ' + n0(g.h) + ' мм' + (g.shape ? ' · с вырезом' : '') + '</span><b>' + g.n + ' шт</b></div>').join('') + '</div>';
    } else if (o.kind === 'paper') {
      const P = res.paper, strips = res.list.reduce((a, r) => a + r.strips.length, 0), cuts = [];
      res.list.forEach(r => r.strips.forEach((s, i) => { if (s.cut) cuts.push(esc(ctx.surf[r.k].name) + ': полоса ' + (i + 1) + ' → ' + n0(s.w) + ' мм'); }));
      h += '<div class="lres"><div class="big"><span>Купить</span><b>' + P.rolls + ' рул.</b><small>' + n2(o.rw / 1000) + ' × ' + n2(o.rl / 1000) + ' м</small></div><div><span>Площадь</span><b>' + n2(res.area) + ' м²</b></div><div><span>Полос</span><b>' + strips + '</b></div><div><span>Кусков</span><b>' + P.pieces + '</b></div><div><span>Остаток</span><b>' + n2(P.waste / 1000) + ' м</b></div></div>';
      if (P.tooLong) h += '<p class="warn">Полоса длиннее рулона — проверьте длину рулона и раппорт.</p>';
      const thin = res.list.reduce((a, r) => a + r.strips.filter(s => s.w < 150).length, 0);
      if (thin) h += '<p class="warn">Узких полос у углов: ' + thin + ' (уже 150 мм) — нажмите «Авто» или сдвиньте старт.</p>';
      if (cuts.length) h += '<p class="sub">Подрезать по ширине</p><div class="cuts">' + cuts.map(c => '<div><span>' + c + '</span></div>').join('') + '</div>';
    } else {
      const tot = res.area * (o.rate || 0) * (o.coats || 1) * (1 + (o.reserve || 0) / 100);
      h += '<div class="lres"><div class="big"><span>Нужно</span><b>' + n2(tot) + ' ' + o.unit + '</b><small>' + (o.coats || 1) + ' сл. × ' + n2(o.rate) + ' ' + o.unit + '/м²</small></div><div><span>Площадь без проёмов</span><b>' + n2(res.area) + ' м²</b></div></div>';
    }
    h += '<div class="lbtns"><button type="button" class="btn ghost" data-lx="png">Скачать схему (PNG)</button><button type="button" class="btn" data-lx="close">Готово</button></div>';
    $('#layRes').innerHTML = h;
  }
  function lamRows(res) {
    const o = res.o, out = [];
    res.list.forEach(r => {
      const rows = new Map(); r.pieces.forEach(p => { if (!rows.has(p.row)) rows.set(p.row, []); rows.get(p.row).push(p); });
      [...rows.keys()].sort((a, b) => a - b).forEach(j => {
        const ps = rows.get(j).sort((a, b) => o.rot ? a.y - b.y : a.x - b.x), wd = Math.round(o.rot ? ps[0].w : ps[0].h);
        out.push('<div><i style="background:#ebe6dd">' + (out.length + 1) + '</i><span>' + ps.map(p => { const L = Math.round(o.rot ? p.h : p.w); return p.full ? L : '<b>' + L + '</b>' + (p.from === 'off' ? '*' : ''); }).join(' + ') + (wd < o.ph - 0.5 ? ' · распил до ' + wd + ' мм' : '') + '</span></div>');
      });
    });
    return '<p class="sub">По рядам, мм (жирным — резать, * — из обрезка)</p><div class="cuts rows">' + out.join('') + '</div>';
  }
  let last = null;
  function draw() {
    const res = calc(), d = drawSVG(res); last = { res, d };
    const svg = $('#laySvg'); svg.setAttribute('viewBox', d.vb.join(' ')); svg.innerHTML = d.s;
    renderRes(res);
  }
  function all() { renderTop(); renderCtl(); draw(); }
  let saveT = 0; const saveSoon = () => { clearTimeout(saveT); saveT = setTimeout(() => ctx.save(), 400); };

  /* ---------- события ---------- */
  m.addEventListener('click', e => {
    const b = e.target.closest('[data-lsurf],[data-lpat],[data-lrot],[data-lmk],[data-lx]'); if (!b) return;
    const o = opt();
    if (b.dataset.lx === 'close') return close();
    if (b.dataset.lx === 'png') return exportPNG();
    if (b.dataset.lsurf) { cur = b.dataset.lsurf; return all(); }
    if (b.dataset.lpat) { o.pat = b.dataset.lpat; }
    else if (b.dataset.lrot) { o.rot = b.dataset.lrot === '1'; keysAll().forEach(k => { delete cfg.marks[k]; }); }
    else if (b.dataset.lmk) {
      const a = b.dataset.lmk;
      keys().forEach(k => {
        const S = ctx.surf[k], [pw, ph] = dimsS(o), g = o.kind === 'tile' ? o.g || 0 : 0;
        const mk = { tl: [0, 0], tr: [S.W, 0], bl: [0, S.H], br: [S.W, S.H], cj: [S.W / 2, S.H / 2], ct: [S.W / 2 - (pw + g) / 2, S.H / 2 - (ph + g) / 2], l: [0, 0], r: [S.W, 0], c: [S.W / 2, 0] }[a];
        if (a === 'auto' && o.kind === 'paper') cfg.marks[k] = autoPaper(S, o);
        else if (a === 'auto') cfg.marks[k] = autoFor(S, o, cfg.marks[k] || { mx: 0, my: isWall(k) ? S.H : 0 }, isWall(k));
        else if (mk) cfg.marks[k] = { mx: Math.round(mk[0]), my: Math.round(mk[1]) };
      });
    }
    renderCtl(); draw(); saveSoon();
  });
  const keysAll = () => isWall(cur) ? ['w0', 'w1', 'w2', 'w3'] : ['floor'];
  m.addEventListener('change', e => {
    const t = e.target; if (!t.id || !t.id.startsWith('l')) return;
    const o = opt(), v = +t.value, ok = isFinite(v);
    const map = { lPw: 'pw', lPh: 'ph', lG: 'g', lRes: 'reserve', lPackN: 'packN', lPackM: 'packM2', lMinP: 'minPiece', lMinS: 'minShift', lRw: 'rw', lRl: 'rl', lRap: 'rap', lAllow: 'allow', lRate: 'rate', lCoats: 'coats' };
    if (t.id === 'lReuse') o.reuse = t.checked;
    else if (map[t.id]) { if (!ok || v < 0) return; if ((t.id === 'lPw' || t.id === 'lPh' || t.id === 'lRw' || t.id === 'lRl') && v < 20) return; o[map[t.id]] = v; }
    else if (t.id === 'lMx' || t.id === 'lMy') { const S = ctx.surf[cur], mk = mark(cur, o); if (!ok) return; if (t.id === 'lMx') mk.mx = Math.max(0, Math.min(S.W, v)); else mk.my = isWall(cur) ? Math.max(0, Math.min(S.H, S.H - v)) : Math.max(0, Math.min(S.H, v)); }
    if (t.id === 'lPw' || t.id === 'lPh') renderCtl();
    draw(); saveSoon();
  });
  // метка мышью / пальцем
  const svg = $('#laySvg'); let drag = null;
  const pick = e => {
    const g = e.target.closest('g[data-s]'); const bi = g ? +g.dataset.s : drag ? drag.bi : -1; if (bi < 0) return null;
    const b = layoutBoxes()[bi], pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return { bi, k: b.k, x: Math.max(0, Math.min(b.S.W, Math.round((p.x - b.ox) / 5) * 5)), y: Math.max(0, Math.min(b.S.H, Math.round(p.y / 5) * 5)) };
  };
  let raf = 0;
  const setMk = q => { const o = opt(); if (o.kind === 'area') return; const mk = cfg.marks[q.k] = cfg.marks[q.k] || { mx: 0, my: 0 }; mk.mx = q.x; if (o.kind !== 'paper') mk.my = q.y; cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { draw(); const a = $('#lMx'), c = $('#lMy'); if (a) a.value = Math.round(mk.mx); if (c) c.value = Math.round(isWall(q.k) ? ctx.surf[q.k].H - mk.my : mk.my); }); };
  svg.addEventListener('pointerdown', e => { const q = pick(e); if (!q) return; drag = { bi: q.bi }; svg.setPointerCapture(e.pointerId); setMk(q); });
  svg.addEventListener('pointermove', e => { if (!drag) return; const q = pick(e); if (q) setMk(q); });
  svg.addEventListener('pointerup', () => { if (drag) { drag = null; saveSoon(); } });

  /* ---------- PNG для мастера ---------- */
  function exportPNG() {
    const { res, d } = last, [vx, vy, vw, vh] = d.vb, fs = d.fs, lines = [];
    const o = res.o, mt = matOf(cur).m;
    lines.push('Раскладка · ' + ctx.title + ' · ' + (cur === 'floor' ? 'пол' : cur === 'walls' ? 'все стены' : ctx.surf[cur].name));
    lines.push((mt ? mt.name : '') + (o.kind === 'tile' ? ' · ' + o.pw + '×' + o.ph + ' мм, шов ' + o.g + ' мм' : o.kind === 'lam' ? ' · доска ' + o.pw + '×' + o.ph + ' мм' : ''));
    if (o.kind === 'tile' || o.kind === 'lam') {
      lines.push('Купить: ' + Math.ceil(res.buy.buy * (1 + (o.reserve || 0) / 100)) + ' шт (с запасом ' + (o.reserve || 0) + '%). Целых ' + res.full + ', резаных ' + res.cut + ', из обрезков ' + res.buy.fromOff + '.');
      keys().forEach(k => { const mk = cfg.marks[k], S = ctx.surf[k]; if (mk) lines.push('Метка ' + (k === 'floor' ? 'пола' : S.name) + ': ' + Math.round(mk.mx) + ' мм от левого края, ' + (isWall(k) ? Math.round(S.H - mk.my) + ' мм от пола' : Math.round(mk.my) + ' мм от верхнего края')); });
      res.gc.groups.forEach(g => lines.push(g.letter + ' — ' + g.w + ' × ' + g.h + ' мм' + (g.shape ? ' (с вырезом)' : '') + ' — ' + g.n + ' шт'));
    } else if (o.kind === 'paper') lines.push('Купить: ' + res.paper.rolls + ' рул. · полос ' + res.list.reduce((a, r) => a + r.strips.length, 0) + ' · кусков ' + res.paper.pieces);
    const lh = fs * 1.35, extra = lines.length * lh + fs;
    const svgS = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vx + ' ' + vy + ' ' + vw + ' ' + (vh + extra) + '" font-family="-apple-system,Segoe UI,Roboto,sans-serif"><rect x="' + vx + '" y="' + vy + '" width="' + vw + '" height="' + (vh + extra) + '" fill="#fff"/>' + d.s +
      lines.map((l, i) => '<text x="' + vx + fs + '" y="' + (vy + vh + fs * 0.5 + i * lh) + '" font-size="' + fs * (i ? 0.9 : 1.1) + '" fill="#222"' + (i ? '' : ' font-weight="700"') + '>' + esc(l) + '</text>').join('') + '</svg>';
    const img = new Image(), url = URL.createObjectURL(new Blob([svgS], { type: 'image/svg+xml' }));
    img.onload = () => { const W = 2400, H = Math.round(W * (vh + extra) / vw), c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').drawImage(img, 0, 0, W, H); URL.revokeObjectURL(url); const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = 'raskladka-' + ctx.title.replace(/[^\wА-яЁё]+/g, '-') + '.png'; a.click(); };
    img.src = url;
  }
  all();
}

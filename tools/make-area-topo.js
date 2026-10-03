/* tools/make-area.py から呼ぶ：切り出した市区町村の形（GeoJSON）を、隣どうしの境目を共有した形（TopoJSON の arcs）にして軽くする。
   node tools/make-area-topo.js clip.json 境目の面積の下限 海岸などの面積の下限
   → 標準出力に { tf: [sx, sy, tx, ty], arcs: ["1つの線を文字にしたもの"], geoms: [{ id, col, arcs }] }
   - 軽くし方：Visvalingam（点を消したときに失う三角形の面積が下限より小さい点から消す）。隣と共有する境目（境界線として描く）は細かく、
     海岸と切り出しの縁（色分けの縁にしかならない）は粗く。
   - 線の書き方：座標を約5m の格子にそろえ、点ごとの差を Google の polyline と同じ方法で文字にする（JSON の数の列より3分の1ほどに小さい）
   - col は色分けの番号（隣どうしが同じ色にならないように） */
const fs = require('fs');
const { topology } = require('topojson-server');
const { presimplify, planarTriangleArea, filter, filterWeight } = require('topojson-simplify');
const { quantize, neighbors } = require('topojson-client');

const [file, wB, wC] = [process.argv[2], +process.argv[3], +process.argv[4]];
const fc = JSON.parse(fs.readFileSync(file, 'utf8'));
/* 切り出しの計算で生まれた点のわずかな違いで、隣と境目を共有できなくならないよう、0.1m ほどにそろえる */
const r6 = v => Math.round(v * 1e6) / 1e6;
const fix = c => (typeof c[0] === 'number' ? [r6(c[0]), r6(c[1])] : c.map(fix));
fc.features.forEach(f => { f.geometry.coordinates = fix(f.geometry.coordinates); });
let t = topology({ m: fc });
t = presimplify(t, planarTriangleArea);
/* arc を使う形の数（2＝隣どうしの境目、1＝海岸か切り出しの縁） */
const owners = new Array(t.arcs.length).fill(0);
const walk = a => (Array.isArray(a) ? a.forEach(walk) : owners[a < 0 ? ~a : a]++);
t.objects.m.geometries.forEach(g => walk(g.arcs));
t.arcs = t.arcs.map((arc, i) => { const w = owners[i] >= 2 ? wB : wC; return arc.filter(p => p[2] >= w); });
t = filter(t, filterWeight(t, 5e-6));   // 軽くしたあと、ごく小さい島（0.05km² ほど未満）は消す
t.arcs = t.arcs.map(arc => arc.map(p => [p[0], p[1]]));
t = quantize(t, 1e5);
const G = t.objects.m.geometries.filter(g => g.type);
/* 色分け：隣（境目を共有）の多いものから、隣で使っていない一番小さい番号 */
const nb = neighbors(G);
const order = G.map((g, i) => i).sort((a, b) => nb[b].length - nb[a].length);
const col = [];
order.forEach(i => { const used = new Set(nb[i].map(j => col[j])); let c = 0; while (used.has(c)) c++; col[i] = c; });
const geoms = G.map((g, i) => ({ id: g.properties.id, col: col[i], arcs: g.type === 'Polygon' ? [g.arcs] : g.arcs }));
/* 使われなくなった arc を詰める */
const used = new Map(), arcs = [];
const ix = a => { const k = a < 0 ? ~a : a; if (!used.has(k)) { used.set(k, arcs.length); arcs.push(t.arcs[k]); } const n = used.get(k); return a < 0 ? ~n : n; };
geoms.forEach(g => { g.arcs = g.arcs.map(poly => poly.map(ring => ring.map(ix))); });
/* polyline の書き方（差分の整数を5ビットずつ。値は ? から始まる文字） */
const enc = v => { v = v < 0 ? ~(v << 1) : v << 1; let s = ''; while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } return s + String.fromCharCode(v + 63); };
const str = arcs.map(a => a.map(([dx, dy]) => enc(dx) + enc(dy)).join(''));
const { scale, translate } = t.transform;
process.stdout.write(JSON.stringify({ tf: [scale[0], scale[1], translate[0], translate[1]], arcs: str, geoms, ncol: Math.max(...col) + 1,
  pts: arcs.reduce((s, a) => s + a.length, 0), shared: arcs.filter((a, i) => true).length }));

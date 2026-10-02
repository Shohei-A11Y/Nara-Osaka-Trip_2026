/* いまどのへん？の3D地形で、トンネルを「山を透かして見る」線で描くための、トンネルの入口と出口の標高を求める。
   路線のデータ（例：assets/line-data.js の LINE.tunnels）のトンネルを [入口km, 出口km, 名前] → [入口km, 出口km, 名前, 入口の標高m, 出口の標高m] に書き換える。
   標高は、地図の立体表示と同じ地理院の標高タイル（dem_png）のズーム12を、入口・出口の位置で読む（4画素の線形補間。海などの無効値は 0m）。
   地表に貼った線と、トンネルの立体の線が、入口・出口でつながるように、地図が描く地形と同じ高さにそろえる。
   ほかの路線でも使える：  node tools/make-tunnel-portals.js <路線のデータ.js> <線路の形.json>
   （省略すると assets/line-data.js と assets/line-sanyo.json。km は線路の形の先頭からの実測長で、livemap.js と同じ計算）
   地理院タイルは curl で取り寄せ、/tmp/dem12 に置いて2回目から使い回す。
   出典：国土地理院 標高タイル（地理院タイル）。線路の形：© OpenStreetMap contributors */
const fs = require('fs'), path = require('path'), zlib = require('zlib'), vm = require('vm'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const DATA = path.resolve(process.argv[2] || path.join(ROOT, 'assets', 'line-data.js'));
const GEOM = path.resolve(process.argv[3] || path.join(ROOT, 'assets', 'line-sanyo.json'));
const CACHE = process.env.DEM_CACHE || '/tmp/dem12';
const Z = 12;

/* 路線のデータを読む（window.○○ に入る形。tunnels を持つものを探す） */
const src = fs.readFileSync(DATA, 'utf8'), box = { window: {} };
vm.runInNewContext(src, box);
const [name, LINE] = Object.entries(box.window).find(([, v]) => v && Array.isArray(v.tunnels)) || [];
if (!LINE) throw new Error('tunnels のある路線のデータが見つかりません: ' + DATA);
const coords = JSON.parse(fs.readFileSync(GEOM, 'utf8')).features[0].geometry.coordinates;

/* 線路の km → 緯度経度（livemap.js と同じ計算） */
const R = 6371.0088, rad = d => d * Math.PI / 180;
const hav = (a, b) => { const la1 = rad(a[1]), la2 = rad(b[1]); const h = Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(rad(b[0] - a[0]) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const cum = [0]; for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + hav(coords[i - 1], coords[i]));
const len = cum[cum.length - 1];
function pointAt(km) {
  if (km <= 0) return coords[0];
  if (km >= len) return coords[coords.length - 1];
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; cum[m] <= km ? (lo = m) : (hi = m); }
  const t = (km - cum[lo]) / ((cum[hi] - cum[lo]) || 1);
  return [coords[lo][0] + (coords[hi][0] - coords[lo][0]) * t, coords[lo][1] + (coords[hi][1] - coords[lo][1]) * t];
}

/* PNG（8bit RGB/RGBA・インターレースなし）を読む最小限の読み手 */
function decodePNG(buf) {
  let p = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (p < buf.length) {
    const n = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + n);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; if (d[8] !== 8 || d[12]) throw new Error('未対応のPNG'); }
    if (type === 'IDAT') idat.push(d);
    p += 12 + n;
  }
  const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 0; if (!bpp) throw new Error('未対応の色の型 ' + ct);
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), row = out.subarray(y * stride, (y + 1) * stride), up = y ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? row[x - bpp] : 0, b = up ? up[x] : 0, c = up && x >= bpp ? up[x - bpp] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      row[x] = v & 255;
    }
  }
  return { w, h, bpp, px: out };
}

/* 標高タイル（取れないタイル＝海などは null） */
fs.mkdirSync(CACHE, { recursive: true });
const tiles = new Map();
function tile(x, y) {
  const k = `${x}/${y}`;
  if (tiles.has(k)) return tiles.get(k);
  const f = path.join(CACHE, `${Z}-${x}-${y}.png`);
  if (!fs.existsSync(f)) {
    try { fs.writeFileSync(f, execFileSync('curl', ['-sSf', '--retry', '3', '--max-time', '30', `https://cyberjapandata.gsi.go.jp/xyz/dem_png/${Z}/${x}/${y}.png`], { maxBuffer: 8 << 20 })); }
    catch { fs.writeFileSync(f, ''); }
  }
  const b = fs.readFileSync(f);
  const t = b.length ? decodePNG(b) : null;
  tiles.set(k, t);
  return t;
}
/* 画素（タイルをまたいでよい）の標高 */
function px(gx, gy) {
  const tx = Math.floor(gx / 256), ty = Math.floor(gy / 256), t = tile(tx, ty);
  if (!t) return 0;
  const i = ((gy - ty * 256) * t.w + (gx - tx * 256)) * t.bpp, v = t.px[i] * 65536 + t.px[i + 1] * 256 + t.px[i + 2];
  return v === 8388608 ? 0 : (v > 8388608 ? v - 16777216 : v) * 0.01;
}
function elev(lon, lat) {
  const n = 2 ** Z * 256, s = Math.sin(rad(lat));
  const fx = (lon + 180) / 360 * n - 0.5, fy = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n - 0.5;
  const x0 = Math.floor(fx), y0 = Math.floor(fy), u = fx - x0, v = fy - y0;
  return (px(x0, y0) * (1 - u) + px(x0 + 1, y0) * u) * (1 - v) + (px(x0, y0 + 1) * (1 - u) + px(x0 + 1, y0 + 1) * u) * v;
}

const out = LINE.tunnels.map(([a, b, nm]) => {
  const pa = pointAt(a), pb = pointAt(b);
  return [a, b, nm || '', Math.max(0, Math.round(elev(pa[0], pa[1]))), Math.max(0, Math.round(elev(pb[0], pb[1])))];
});
out.forEach(t => console.log(`${String(t[0]).padStart(7)}〜${String(t[1]).padEnd(7)} ${(t[2] || '（名前なし）').padEnd(9, '　')} 入口 ${String(t[3]).padStart(4)}m  出口 ${String(t[4]).padStart(4)}m`));
/* 路線のデータの tunnels: [ … ] を書き換える（ほかの部分はそのまま） */
const re = /(\n(\s*)tunnels:\s*\[[ \t]*(?=\n))([\s\S]*?)(\n\s*\])/;   // データの行（「tunnels: [」で行が終わる）だけ。説明書きの中の tunnels: には合わせない
const m = re.exec(src); if (!m) throw new Error('tunnels: [ … ] の書き方が見つかりません');
const ind = m[2] + '  ';
const body = out.map(t => `\n${ind}${JSON.stringify(t)}`).join(',');
fs.writeFileSync(DATA, src.replace(re, `$1${body}$4`));
console.log(`${path.relative(ROOT, DATA)}（${name}.tunnels）の ${out.length}本に、入口・出口の標高を書き込みました`);

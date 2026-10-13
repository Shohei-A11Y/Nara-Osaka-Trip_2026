#!/usr/bin/env python3
"""線路の形（assets/line-*.json）に沿ったトンネルを、長さにかかわらず全部抜き出し、路線のデータ（assets/line-data.js）の tunnels に書く道具。

  出典：線路の形・トンネル：© OpenStreetMap contributors（ODbL）。
        Overture Maps Foundation 配布データ（release 2026-09-23.0）の transportation/segment（subtype=rail）の rail_flags（is_tunnel）。
        線路の形（line-sanyo.json・line-relay.json）と同じ出どころ。

  使い方（リポジトリの一番上で）
    pip install pyarrow shapely
    python3 tools/make-line-tunnels.py sanyo     # 山陽新幹線（window.LINE）
    python3 tools/make-line-tunnels.py relay     # リレーかもめ（window.LINES.relay）。こちらは tools/make-relay-line.py と同じ結果になる
    node tools/make-tunnel-portals.js            # 山陽新幹線は、このあと入口・出口の標高を付け直す（リレーかもめは assets/line-relay.json を渡す）

  やること
  - 線路の形の左右 BUF_M（60m）に入る、鉄道の線（Overture の segment, subtype=rail）のうち、名前が路線に合うもの（NAME）を集める。
    範囲は線路の形を数kmごとの小さな四角に分けて、その四角に入る行グループだけを読む（--cache に置き、2回目からはそれを使う）。
  - そのうちトンネルの区間（rail_flags の is_tunnel。between があればその割合だけ）を、線路の形の km に直す（livemap.js と同じ計算）。
  - 上り線・下り線が別々の線で入っていて km が重なるもの、GAP_KM（30m）より近く続くものは1本にまとめる。
  - 前のデータ（2km以上のもの）の名前は、km が重なるものにそのまま引き継ぐ。名前のないものは空（地図では「トンネル内」）。
  - 2回流しても同じ結果になる（--cache を使い、並べ方・丸め方を決めている）。
"""
import argparse, json, math, os, re, subprocess, sys

R = 6371.0088
REL = 'overturemaps-us-west-2/release/2026-09-23.0/theme=transportation/type=segment/'
LINES = {
    'sanyo': {'geom': 'assets/line-sanyo.json', 'var': 'LINE', 'name': re.compile(r'山陽新幹線|San\W?y[oō]\W?Shinkansen', re.I)},   # OSM の名前は「Sanyō-Shinkansen」「San’yō Shinkansen」などいろいろ
    # リレーかもめ：make-relay-line.py と同じ線（鹿児島本線・長崎本線・佐世保線。名前のない線も含める＝線路の形と同じ選び方）
    'relay': {'geom': 'assets/line-relay.json', 'var': 'relay', 'name': None,
              'skip': re.compile(r'新幹線|西鉄|西日本鉄道|地下鉄|跡|旧|国鉄|博多南線|臨港')},
}
BUF_M = 60       # 線路の形からこの距離の中にある線だけ（上り・下りの2本や、形の間引きのずれを含める）
NEAR_M = 25      # トンネルの区間の点は、すべて線路の形からこの距離の中にあること（並行するほかの線のトンネルを拾わない）
GAP_KM = 0.03    # この長さより近いトンネルは、1本にまとめる
MIN_KM = 0.02    # これより短い記録は、データの切れ端として捨てる


def hav(a, b):
    la1, la2 = math.radians(a[1]), math.radians(b[1])
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin(math.radians(b[0] - a[0]) / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


class Line:
    """線路の形と、点 → km（線に吸着）"""
    def __init__(self, coords):
        self.c = coords
        self.cum = [0.0]
        for a, b in zip(coords, coords[1:]):
            self.cum.append(self.cum[-1] + hav(a, b))
        self.len = self.cum[-1]
        # 吸着を速くするための格子（0.02度ごと）
        self.grid = {}
        for i in range(len(coords) - 1):
            (x0, y0), (x1, y1) = coords[i], coords[i + 1]
            for gx in range(int(min(x0, x1) / .02) - 1, int(max(x0, x1) / .02) + 2):
                for gy in range(int(min(y0, y1) / .02) - 1, int(max(y0, y1) / .02) + 2):
                    self.grid.setdefault((gx, gy), []).append(i)

    def snap(self, p):
        """(km, 線からの距離 m)"""
        best = (1e18, 0.0)
        kx, ky = math.cos(math.radians(p[1])) * 111320, 110574
        for i in self.grid.get((int(p[0] / .02), int(p[1] / .02)), ()):
            ax, ay = (self.c[i][0] - p[0]) * kx, (self.c[i][1] - p[1]) * ky
            bx, by = (self.c[i + 1][0] - p[0]) * kx, (self.c[i + 1][1] - p[1]) * ky
            dx, dy = bx - ax, by - ay; l2 = dx * dx + dy * dy
            t = max(0, min(1, -(ax * dx + ay * dy) / l2)) if l2 else 0
            d = math.hypot(ax + t * dx, ay + t * dy)
            if d < best[0]:
                best = (d, self.cum[i] + t * (self.cum[i + 1] - self.cum[i]))
        return best[1], best[0]

    def boxes(self, step_km=4.0, pad=0.01):
        """線を数kmごとに区切った四角（経度・緯度）"""
        out, s, i0 = [], 0.0, 0
        for i in range(1, len(self.c)):
            if self.cum[i] - self.cum[i0] >= step_km or i == len(self.c) - 1:
                xs = [p[0] for p in self.c[i0:i + 1]]; ys = [p[1] for p in self.c[i0:i + 1]]
                out.append((min(xs) - pad, max(xs) + pad, min(ys) - pad, max(ys) + pad)); i0 = i
        return out


def extract(line, cache):
    fn = os.path.join(cache, 'rail.geojson')
    if os.path.exists(fn):
        return json.load(open(fn))['features']
    import pyarrow.fs as pfs, pyarrow.parquet as pq
    from concurrent.futures import ThreadPoolExecutor
    from shapely import wkb
    os.makedirs(cache, exist_ok=True)
    proxy = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
    fs = pfs.S3FileSystem(anonymous=True, region='us-west-2', **({'proxy_options': proxy} if proxy else {}))
    paths = sorted(i.path for i in fs.get_file_info(pfs.FileSelector(REL)) if i.path.endswith('.parquet'))
    boxes = line.boxes()
    hit = lambda x0, x1, y0, y1: any(x0 <= b[1] and x1 >= b[0] and y0 <= b[3] and y1 >= b[2] for b in boxes)

    def stat(md, rg, name):
        for c in range(md.num_columns):
            col = md.row_group(rg).column(c)
            if col.path_in_schema == name:
                return col.statistics

    def one(p):
        f = pq.ParquetFile(fs.open_input_file(p)); md = f.metadata; rgs = []
        for rg in range(md.num_row_groups):
            a, b, c, d = (stat(md, rg, 'bbox.' + k) for k in ('xmin', 'xmax', 'ymin', 'ymax'))
            if a is None or not a.has_min_max or hit(a.min, b.max, c.min, d.max):
                rgs.append(rg)
        res = []
        for rg in rgs:
            # 先に subtype と bbox だけ読み、鉄道の行があるときだけ形を読む
            t = f.read_row_group(rg, columns=['subtype', 'bbox'])
            sub = t.column('subtype').to_pylist(); bb = t.column('bbox').to_pylist()
            idx = [i for i, (s, b) in enumerate(zip(sub, bb)) if s == 'rail' and hit(b['xmin'], b['xmax'], b['ymin'], b['ymax'])]
            if not idx:
                continue
            want = [n for n in ('id', 'names', 'class', 'geometry', 'rail_flags') if n in f.schema_arrow.names]
            rows = f.read_row_group(rg, columns=want).take(idx).to_pylist()
            for r in rows:
                g = wkb.loads(r.pop('geometry'))
                res.append({'type': 'Feature', 'properties': r, 'geometry': g.__geo_interface__})
        return res

    with ThreadPoolExecutor(8) as ex:
        feats = [x for lst in ex.map(one, paths) for x in lst]
    feats.sort(key=lambda f: f['properties']['id'])
    json.dump({'type': 'FeatureCollection', 'features': feats}, open(fn, 'w'), ensure_ascii=False, default=str)
    return feats


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('line', choices=list(LINES))
    ap.add_argument('--cache', default=None)
    ap.add_argument('--data', default='assets/line-data.js')
    ap.add_argument('--dry', action='store_true', help='書き込まずに表示だけ')
    a = ap.parse_args()
    cfg = LINES[a.line]
    cache = a.cache or f'tools/.tunnel-cache/{a.line}'
    line = Line(json.load(open(cfg['geom']))['features'][0]['geometry']['coordinates'])
    feats = extract(line, cache)
    print(f'{a.line}: 線路の形 {line.len:.2f} km、鉄道の線 {len(feats)} 本を読みました', file=sys.stderr)
    spans = []
    for f in feats:
        p = f['properties']; nm = ((p.get('names') or {}).get('primary') or '')
        if cfg['name'] and not cfg['name'].search(nm):
            continue
        if cfg.get('skip') and cfg['skip'].search(nm):
            continue
        flags = p.get('rail_flags') or []
        tun = [x.get('between') or [0, 1] for x in flags if 'is_tunnel' in (x.get('values') or [])]
        if not tun:
            continue
        g = f['geometry']
        for ln in ([g['coordinates']] if g['type'] == 'LineString' else g['coordinates'] if g['type'] == 'MultiLineString' else []):
            cum = [0.0]
            for x, y in zip(ln, ln[1:]):
                cum.append(cum[-1] + hav(x, y))
            tot = cum[-1] or 1
            for lo, hi in tun:
                # トンネルの区間の点（両端は割合の位置に補間）
                pts = []
                for i in range(len(ln)):
                    fr = cum[i] / tot
                    if lo <= fr <= hi:
                        pts.append(ln[i])
                def at(fr):
                    d = fr * tot
                    for i in range(len(cum) - 1):
                        if cum[i] <= d <= cum[i + 1]:
                            t = (d - cum[i]) / ((cum[i + 1] - cum[i]) or 1)
                            return [ln[i][0] + (ln[i + 1][0] - ln[i][0]) * t, ln[i][1] + (ln[i + 1][1] - ln[i][1]) * t]
                    return ln[-1]
                pts = [at(lo)] + pts + [at(hi)]
                sn = [line.snap(q) for q in pts]
                if max(d for _, d in sn) > NEAR_M:
                    continue
                k0, k1 = min(k for k, _ in sn), max(k for k, _ in sn)
                if k1 - k0 >= MIN_KM:
                    spans.append([k0, k1])
    spans.sort()
    merged = []
    for s in spans:
        if merged and s[0] <= merged[-1][1] + GAP_KM:
            merged[-1][1] = max(merged[-1][1], s[1])
        else:
            merged.append(list(s))
    # 前のデータの名前を引き継ぐ
    src = open(a.data, encoding='utf8').read()
    import ast
    blk = re.search(r'\n(\s*)tunnels:\s*\[[ \t]*\n([\s\S]*?)\n\s*\]', src[src.find('window.LINE =') if cfg['var'] == 'LINE' else src.find('relay: {'):])
    old = []
    if blk:
        for row in re.findall(r'\[[^\[\]]*\]', blk.group(2)):
            try:
                old.append(json.loads(row))
            except Exception:
                old.append(ast.literal_eval(row))
    out = []
    for k0, k1 in merged:
        nm = ''
        for o in old:
            if len(o) > 2 and o[2] and min(k1, o[1]) - max(k0, o[0]) > 0.5 * min(k1 - k0, o[1] - o[0]):
                nm = o[2]
        out.append([round(k0, 2), round(k1, 2), nm])
    tot = sum(y - x for x, y, _ in out)
    print(f'トンネル {len(out)} 本（合計 {tot:.1f} km。2km以上 {sum(1 for x, y, _ in out if y - x >= 2)} 本・1km未満 {sum(1 for x, y, _ in out if y - x < 1)} 本）', file=sys.stderr)
    for t in out:
        print(f'  {t[0]:7.2f}〜{t[1]:7.2f}（{t[1] - t[0]:5.2f} km）{t[2]}', file=sys.stderr)
    if a.dry:
        return
    # tunnels: [ … ] を書き換える（山陽新幹線は window.LINE の、リレーかもめは relay: { … } の中のもの）
    start = src.find('window.LINE =') if cfg['var'] == 'LINE' else src.find('relay: {')
    re_t = re.compile(r'(\n(\s*)tunnels:\s*\[)([ \t]*\n[\s\S]*?\n\s*\]|\])')
    m = re_t.search(src, start)
    if not m:
        raise SystemExit('tunnels: [ … ] が見つかりません')
    ind = m.group(2) + '  '
    body = ''.join(f'\n{ind}{json.dumps(t, ensure_ascii=False)}' + (',' if i < len(out) - 1 else '') for i, t in enumerate(out))
    new = f'{m.group(1)}{body}\n{m.group(2)}]'
    src = src[:m.start()] + new + src[m.end():]
    open(a.data, 'w', encoding='utf8').write(src)
    print(f'{a.data} の {a.line} の tunnels を {len(out)} 本に書き換えました', file=sys.stderr)


if __name__ == '__main__':
    main()
